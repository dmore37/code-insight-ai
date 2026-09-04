import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AnalysisHistoryPort } from '../../core/code-analysis/domain/ports/analysis-history.port';
import { AnalysisRecord } from '../../core/code-analysis/domain/models/analysis-record.model';
import {
  extractZipDisplayName,
  sanitizeZipReferences,
} from '../../core/code-analysis/domain/utils/zip-display-name.util';
import { AnalysisStateService } from '../analysis-result/analysis-state.service';
import { AuthPort } from '../../core/auth/domain/ports/auth.port';

const PAGE_SIZE = 20;
/** Intervalo de polling mientras haya análisis en estado "processing". */
const POLLING_INTERVAL_MS = 5000;

/**
 * Historial de análisis (leído desde DynamoDB vía `GET /analysis`).
 * Se embebe directamente en la pantalla principal, debajo del formulario
 * de carga de repositorio. Permite ver el resultado completo de un
 * análisis ya finalizado, o refrescar la lista para ver el progreso de
 * los que aún están en estado "processing" (procesados de forma
 * asíncrona vía SQS).
 *
 * El historial depende de la sesión activa (feed público + privados del
 * dueño autenticado), así que se recarga automáticamente cada vez que
 * cambia el estado de login/logout (ver el `effect` en el constructor),
 * sin necesidad de que otro componente lo dispare manualmente. Además,
 * hace polling automático mientras existan registros "processing", para
 * no depender de que el usuario pulse "Refrescar" manualmente.
 */
@Component({
  selector: 'app-analysis-history',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './analysis-history.component.html',
  styleUrl: './analysis-history.component.scss',
})
export class AnalysisHistoryComponent {
  private readonly analysisHistory = inject(AnalysisHistoryPort);
  private readonly analysisState = inject(AnalysisStateService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthPort);

  readonly records = signal<AnalysisRecord[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly pageSize = signal(PAGE_SIZE);
  /** Ids que se están reintentando (para deshabilitar su botón mientras se procesa). */
  readonly retryingIds = signal<Set<string>>(new Set());

  private pollingHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Se ejecuta de inmediato (carga inicial) y cada vez que cambia
    // `currentUser` (login o logout), para que el historial refleje
    // siempre lo que el usuario actual puede ver.
    effect(() => {
      this.auth.currentUser();
      this.load();
    });
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const response = await this.analysisHistory.getHistory(this.pageSize());
      if (response.success) {
        this.records.set(response.data);
        this.syncPolling();
      } else {
        this.errorMessage.set(
          `[${response.error.code}] ${response.error.message}`,
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

  /** Trae más registros del historial (paginación simple aumentando el límite). */
  async loadMore(): Promise<void> {
    this.pageSize.update((size) => size + PAGE_SIZE);
    await this.load();
  }

  viewResult(record: AnalysisRecord): void {
    if (!record.result) return;
    this.analysisState.setResult(record.result);
    this.router.navigateByUrl('/resultado');
  }

  /** Reenvía el mismo origen (URL o ZIP) de un análisis fallido. */
  async retry(record: AnalysisRecord): Promise<void> {
    if (this.retryingIds().has(record.id)) return;
    this.retryingIds.update((ids) => new Set(ids).add(record.id));
    try {
      const response = await this.analysisHistory.submitAsync({
        gitUrl: record.gitUrl,
        zipS3Key: record.zipS3Key,
        zipHash: record.zipHash,
      });
      if (response.success) {
        // Inserta el nuevo intento al inicio de la lista sin esperar al
        // próximo polling/refresh.
        this.records.update((current) => [response.data, ...current]);
        this.syncPolling();
      } else {
        this.errorMessage.set(
          `[${response.error.code}] ${response.error.message}`,
        );
      }
    } finally {
      this.retryingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(record.id);
        return next;
      });
    }
  }

  isRetrying(record: AnalysisRecord): boolean {
    return this.retryingIds().has(record.id);
  }

  /** Solo se puede reintentar si conocemos un origen reproducible (URL o key en S3). */
  canRetry(record: AnalysisRecord): boolean {
    return Boolean(record.gitUrl || record.zipS3Key);
  }

  sourceLabel(record: AnalysisRecord): string {
    if (record.gitUrl) return record.gitUrl;
    if (record.zipS3Key) return extractZipDisplayName(record.zipS3Key);
    return record.zipFilePath ?? '—';
  }

  /**
   * Limpia el key completo de S3 que pueda venir embebido en un mensaje
   * de error (incluye registros antiguos guardados antes de que el
   * backend generara mensajes con el nombre legible del ZIP).
   */
  formatErrorMessage(errorMessage: string | undefined): string {
    return sanitizeZipReferences(errorMessage);
  }

  /** Activa o detiene el polling según si quedan registros "processing". */
  private syncPolling(): void {
    const hasProcessing = this.records().some(
      (record) => record.status === 'processing',
    );
    if (hasProcessing && !this.pollingHandle) {
      this.pollingHandle = setInterval(() => this.load(), POLLING_INTERVAL_MS);
    } else if (!hasProcessing && this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
  }

  statusLabel(status: AnalysisRecord['status']): string {
    switch (status) {
      case 'processing':
        return 'Procesando…';
      case 'completed':
        return 'Completado';
      case 'failed':
        return 'Falló';
    }
  }
}
