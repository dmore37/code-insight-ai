import { Component, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AnalysisHistoryPort } from '../../core/code-analysis/domain/ports/analysis-history.port';
import { AnalysisStateService } from '../analysis-result/analysis-state.service';
import { AnalysisHistoryComponent } from '../analysis-history/analysis-history.component';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

/**
 * Sección 1 del reto: carga de repositorio.
 * MVP: solo soporta URL git pública (opción 1). La carga de ZIP (opción 2)
 * queda planificada para una iteración futura (requiere subida a S3).
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
  imports: [FormsModule, AnalysisHistoryComponent],
  templateUrl: './repo-upload.component.html',
  styleUrl: './repo-upload.component.scss',
})
export class RepoUploadComponent {
  private readonly analysisHistory = inject(AnalysisHistoryPort);
  private readonly analysisState = inject(AnalysisStateService);
  private readonly router = inject(Router);

  @ViewChild('historyList') historyList?: AnalysisHistoryComponent;

  gitUrl = '';
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (!this.gitUrl.trim()) {
      this.errorMessage.set('Debes ingresar una URL de repositorio git pública.');
      return;
    }

    this.errorMessage.set(null);
    this.isLoading.set(true);

    try {
      const submitResponse = await this.analysisHistory.submitAsync({
        gitUrl: this.gitUrl.trim(),
      });

      if (!submitResponse.success) {
        this.errorMessage.set(
          `[${submitResponse.error.code}] ${submitResponse.error.message}`,
        );
        return;
      }

      // Si ya vino resuelto (cache hit: completed/failed de inmediato),
      // no hace falta refrescar el historial dos veces ni hacer polling.
      const record =
        submitResponse.data.status === 'processing'
          ? await this.pollAndRefresh(submitResponse.data.id)
          : submitResponse.data;

      this.historyList?.load();

      if (record.status === 'completed' && record.result) {
        this.analysisState.setResult(record.result);
        this.router.navigateByUrl('/resultado');
      } else if (record.status === 'failed') {
        this.errorMessage.set(
          record.errorMessage ?? 'El análisis falló sin detalle adicional.',
        );
      } else {
        this.errorMessage.set(
          'El análisis sigue procesándose; revisa el historial más abajo.',
        );
      }
    } catch (err) {
      this.errorMessage.set(
        'No fue posible conectar con el servidor. Intenta nuevamente.',
      );
      console.error(err);
    } finally {
      this.isLoading.set(false);
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
    return this.pollUntilFinished(id);
  }

  private async pollUntilFinished(id: string) {
    const start = Date.now();

    while (Date.now() - start < POLL_TIMEOUT_MS) {
      const response = await this.analysisHistory.getStatus(id);
      if (response.success && response.data.status !== 'processing') {
        return response.data;
      }
      if (response.success) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
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
