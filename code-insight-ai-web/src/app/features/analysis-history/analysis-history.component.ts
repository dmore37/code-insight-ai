import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AnalysisHistoryPort } from '../../core/code-analysis/domain/ports/analysis-history.port';
import {
  AnalysisRecord,
  AnalysisStatus,
} from '../../core/code-analysis/domain/models/analysis-record.model';
import {
  extractZipDisplayName,
  sanitizeZipReferences,
} from '../../core/code-analysis/domain/utils/zip-display-name.util';
import { AnalysisStateService } from '../analysis-result/analysis-state.service';
import { AuthPort } from '../../core/auth/domain/ports/auth.port';
import {
  HISTORY_PAGE_SIZE,
  HISTORY_POLLING_INTERVAL_MS,
} from '../../core/code-analysis/config/ui.constants';

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
  readonly pageSize = HISTORY_PAGE_SIZE;

  // Paginación con cursor: `cursorStack` guarda el cursor usado para
  // llegar a cada página anterior (permite "Anterior" sin re-consultar
  // desde cero); `currentCursor` es el cursor de la página visible;
  // `nextCursor` es el que devolvió el backend para pedir la siguiente
  // página (undefined si ya no hay más).
  private cursorStack: (string | undefined)[] = [];
  private currentCursor: string | undefined = undefined;
  readonly nextCursor = signal<string | undefined>(undefined);

  readonly retryingIds = signal<Set<string>>(new Set());

  private pollingHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {

    effect(() => {
      this.auth.currentUser();
      this.resetToFirstPage();
    });
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const response = await this.analysisHistory.getHistory(
        this.pageSize,
        this.currentCursor,
      );
      if (response.success) {
        this.records.set(response.data.items);
        this.nextCursor.set(response.data.nextCursor);
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

  resetToFirstPage(): void {
    this.cursorStack = [];
    this.currentCursor = undefined;
    this.nextCursor.set(undefined);
    void this.load();
  }

  hasNextPage(): boolean {
    return this.nextCursor() !== undefined;
  }

  hasPreviousPage(): boolean {
    return this.cursorStack.length > 0;
  }

  async goToNextPage(): Promise<void> {
    if (!this.hasNextPage()) return;
    this.cursorStack.push(this.currentCursor);
    this.currentCursor = this.nextCursor();
    await this.load();
  }

  async goToPreviousPage(): Promise<void> {
    if (!this.hasPreviousPage()) return;
    this.currentCursor = this.cursorStack.pop();
    await this.load();
  }

  viewResult(record: AnalysisRecord): void {
    if (!record.result) return;
    this.analysisState.setResult(record.result);
    this.router.navigateByUrl('/resultado');
  }

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

  canRetry(record: AnalysisRecord): boolean {
    return Boolean(record.gitUrl || record.zipS3Key);
  }

  sourceLabel(record: AnalysisRecord): string {
    if (record.gitUrl) return record.gitUrl;
    if (record.zipS3Key) return extractZipDisplayName(record.zipS3Key);
    return record.zipFilePath ?? '—';
  }

  formatErrorMessage(errorMessage: string | undefined): string {
    return sanitizeZipReferences(errorMessage);
  }

  private syncPolling(): void {
    const hasProcessing = this.records().some(
      (record) => record.status === AnalysisStatus.Processing,
    );
    if (hasProcessing && !this.pollingHandle) {
      this.pollingHandle = setInterval(() => this.load(), HISTORY_POLLING_INTERVAL_MS);
    } else if (!hasProcessing && this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
  }

  statusLabel(status: AnalysisRecord['status']): string {
    switch (status) {
      case AnalysisStatus.Processing:
        return 'Procesando…';
      case AnalysisStatus.Completed:
        return 'Completado';
      case AnalysisStatus.Failed:
        return 'Falló';
    }
  }
}
