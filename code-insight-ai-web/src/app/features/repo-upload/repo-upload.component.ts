import { Component, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AnalysisHistoryPort } from '../../core/code-analysis/domain/ports/analysis-history.port';
import { AnalysisStatus } from '../../core/code-analysis/domain/models/analysis-record.model';
import { AnalysisStateService } from '../analysis-result/analysis-state.service';
import { AnalysisHistoryComponent } from '../analysis-history/analysis-history.component';
import { AuthPort } from '../../core/auth/domain/ports/auth.port';
import { computeFileSha256 } from '../../core/code-analysis/domain/utils/file-hash.util';
import {
  SUBMIT_POLL_INTERVAL_MS,
  SUBMIT_POLL_TIMEOUT_MS,
} from '../../core/code-analysis/config/ui.constants';

type UploadMode = 'url' | 'zip';

/** Pasos del progreso mostrado mientras `isLoading()` es true. */
export enum AnalysisStep {
  Uploading = 'uploading',
  Queued = 'queued',
  Processing = 'processing',
  Finishing = 'finishing',
}

const STEP_ORDER: AnalysisStep[] = [
  AnalysisStep.Uploading,
  AnalysisStep.Queued,
  AnalysisStep.Processing,
  AnalysisStep.Finishing,
];


/**
 * Sección 1 del reto: carga de repositorio.
 * Soporta dos modos, alternables con un toggle: URL de un repositorio git
 * público (análisis "público", visible para todos en el historial) o
 * archivo ZIP (análisis "privado", visible solo para su dueño), subido
 * directamente a S3 mediante una URL prefirmada (evita el límite de
 * payload de API Gateway/Lambda).
 *
 * El envío usa el flujo asíncrono (POST /analysis/async + SQS): se
 * encola el trabajo y se hace polling de su estado hasta que termina
 * (completed/failed). El historial (DynamoDB) se muestra debajo del
 * formulario, en la misma pantalla, y se refresca automáticamente al
 * terminar cada análisis.
 */
@Component({
  selector: 'app-repo-upload',
  standalone: true,
  imports: [FormsModule, RouterLink, AnalysisHistoryComponent],
  templateUrl: './repo-upload.component.html',
  styleUrl: './repo-upload.component.scss',
})
export class RepoUploadComponent {
  private readonly analysisHistory = inject(AnalysisHistoryPort);
  private readonly analysisState = inject(AnalysisStateService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthPort);

  @ViewChild('historyList') historyList?: AnalysisHistoryComponent;

  readonly currentUser = this.auth.currentUser;

  mode = signal<UploadMode>('url');
  gitUrl = '';
  zipFile: File | null = null;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  /** Paso actual del progreso, mostrado mientras `isLoading()` es true. */
  currentStep = signal<AnalysisStep>(AnalysisStep.Queued);

  /** Pasos a mostrar según el modo (por URL no hay paso de "subiendo"). */
  stepsForMode(): AnalysisStep[] {
    return this.mode() === 'zip'
      ? STEP_ORDER
      : STEP_ORDER.filter((step) => step !== AnalysisStep.Uploading);
  }

  stepLabel(step: AnalysisStep): string {
    switch (step) {
      case AnalysisStep.Uploading:
        return 'Subiendo ZIP';
      case AnalysisStep.Queued:
        return 'Encolando análisis';
      case AnalysisStep.Processing:
        return 'Analizando (estático + IA)';
      case AnalysisStep.Finishing:
        return 'Finalizando';
    }
  }

  /** true si `step` ya se completó (está antes del paso actual en el orden). */
  isStepDone(step: AnalysisStep): boolean {
    return STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(this.currentStep());
  }

  isStepActive(step: AnalysisStep): boolean {
    return step === this.currentStep();
  }

  setMode(mode: UploadMode): void {
    if (this.isLoading()) return;
    this.mode.set(mode);
    this.errorMessage.set(null);
  }

  onZipFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.zipFile = input.files?.[0] ?? null;
  }

  async onSubmit(): Promise<void> {
    if (this.mode() === 'url') {
      await this.submitByUrl();
    } else {
      await this.submitByZip();
    }
  }

  private async submitByUrl(): Promise<void> {
    if (!this.gitUrl.trim()) {
      this.errorMessage.set('Debes ingresar una URL de repositorio git pública.');
      return;
    }

    this.errorMessage.set(null);
    this.isLoading.set(true);
    this.currentStep.set(AnalysisStep.Queued);

    try {
      const submitResponse = await this.analysisHistory.submitAsync({
        gitUrl: this.gitUrl.trim(),
      });
      await this.handleSubmitResponse(submitResponse);
    } catch (err) {
      this.errorMessage.set(
        'No fue posible conectar con el servidor. Intenta nuevamente.',
      );
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async submitByZip(): Promise<void> {
    if (!this.auth.currentUser()) {
      this.errorMessage.set(
        'Analizar un archivo ZIP requiere iniciar sesión (protege tu código de subidas anónimas).',
      );
      this.router.navigateByUrl('/login');
      return;
    }

    if (!this.zipFile) {
      this.errorMessage.set('Debes seleccionar un archivo ZIP.');
      return;
    }

    this.errorMessage.set(null);
    this.isLoading.set(true);
    this.currentStep.set(AnalysisStep.Uploading);

    try {
      // Hash del contenido ANTES de subir: permite al backend detectar
      // si ya se analizó este mismo ZIP recientemente (cache hit) sin
      // depender del nombre de archivo ni de la key en S3 (que siempre
      // es distinta por incluir un UUID).
      const zipHash = await computeFileSha256(this.zipFile);

      const urlResponse = await this.analysisHistory.requestZipUploadUrl(
        this.zipFile.name,
      );
      if (!urlResponse.success) {
        this.errorMessage.set(
          `[${urlResponse.error.code}] ${urlResponse.error.message}`,
        );
        return;
      }

      const { uploadUrl, key } = urlResponse.data;
      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/zip' },
        body: this.zipFile,
      });
      if (!uploadResult.ok) {
        this.errorMessage.set('No fue posible subir el archivo ZIP a S3.');
        return;
      }

      this.currentStep.set(AnalysisStep.Queued);
      const submitResponse = await this.analysisHistory.submitAsync({
        zipS3Key: key,
        zipHash,
      });
      await this.handleSubmitResponse(submitResponse);
    } catch (err) {
      this.errorMessage.set(
        'No fue posible conectar con el servidor. Intenta nuevamente.',
      );
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async handleSubmitResponse(
    submitResponse: Awaited<ReturnType<AnalysisHistoryPort['submitAsync']>>,
  ): Promise<void> {
    if (!submitResponse.success) {
      this.errorMessage.set(
        `[${submitResponse.error.code}] ${submitResponse.error.message}`,
      );
      return;
    }

    // Si ya vino resuelto (cache hit: completed/failed de inmediato),
    // no hace falta refrescar el historial dos veces ni hacer polling.
    const record =
      submitResponse.data.status === AnalysisStatus.Processing
        ? await this.pollAndRefresh(submitResponse.data.id)
        : submitResponse.data;

    this.currentStep.set(AnalysisStep.Finishing);
    this.historyList?.load();

    if (record.status === AnalysisStatus.Completed && record.result) {
      this.analysisState.setResult(record.result);
      this.router.navigateByUrl('/resultado');
    } else if (record.status === AnalysisStatus.Failed) {
      this.errorMessage.set(
        record.errorMessage ?? 'El análisis falló sin detalle adicional.',
      );
    } else {
      this.errorMessage.set(
        'El análisis sigue procesándose; revisa el historial más abajo.',
      );
    }
  }

  /**
   * Refresca el historial (para que aparezca el registro "processing"
   * recién creado) y espera (polling) a que pase a un estado final. Si
   * se agota el tiempo, devuelve el último estado conocido (seguirá
   * "processing", y el usuario puede revisarlo en el historial).
   */
  private async pollAndRefresh(id: string) {
    this.historyList?.load();
    this.currentStep.set(AnalysisStep.Processing);
    return this.pollUntilFinished(id);
  }

  private async pollUntilFinished(id: string) {
    const start = Date.now();

    while (Date.now() - start < SUBMIT_POLL_TIMEOUT_MS) {
      const response = await this.analysisHistory.getStatus(id);
      if (response.success && response.data.status !== AnalysisStatus.Processing) {
        return response.data;
      }
      if (response.success) {
        await new Promise((resolve) => setTimeout(resolve, SUBMIT_POLL_INTERVAL_MS));
        continue;
      }
      // Error de negocio consultando el estado: se detiene el polling.
      throw new Error(response.error.message);
    }

    // Se agotó el tiempo: devuelve el último estado consultado (processing).
    const last = await this.analysisHistory.getStatus(id);
    if (last.success) return last.data;
    throw new Error(last.error.message);
  }
}
