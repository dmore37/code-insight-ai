import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AnalysisHistoryPort } from '../../core/code-analysis/domain/ports/analysis-history.port';
import { AnalysisRecord } from '../../core/code-analysis/domain/models/analysis-record.model';
import { AnalysisStateService } from '../analysis-result/analysis-state.service';

/**
 * Historial de análisis (leído desde DynamoDB vía `GET /analysis`).
 * Se embebe directamente en la pantalla principal, debajo del formulario
 * de carga de repositorio. Permite ver el resultado completo de un
 * análisis ya finalizado, o refrescar la lista para ver el progreso de
 * los que aún están en estado "processing" (procesados de forma
 * asíncrona vía SQS).
 */
@Component({
  selector: 'app-analysis-history',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './analysis-history.component.html',
  styleUrl: './analysis-history.component.scss',
})
export class AnalysisHistoryComponent implements OnInit {
  private readonly analysisHistory = inject(AnalysisHistoryPort);
  private readonly analysisState = inject(AnalysisStateService);
  private readonly router = inject(Router);

  readonly records = signal<AnalysisRecord[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const response = await this.analysisHistory.getHistory(20);
      if (response.success) {
        this.records.set(response.data);
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

  viewResult(record: AnalysisRecord): void {
    if (!record.result) return;
    this.analysisState.setResult(record.result);
    this.router.navigateByUrl('/resultado');
  }

  sourceLabel(record: AnalysisRecord): string {
    return record.gitUrl ?? record.zipFilePath ?? '—';
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
