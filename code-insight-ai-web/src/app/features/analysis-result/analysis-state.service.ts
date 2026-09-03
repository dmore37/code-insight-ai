import { Injectable, signal } from '@angular/core';
import { AnalysisResult } from '../../core/code-analysis/domain/models/analysis-result.model';

/**
 * Estado compartido en memoria entre la pantalla de carga (Sección 1) y
 * la pantalla de resultados (Secciones 2 y 3). Se usa un signal simple en
 * vez de un state manager completo (NgRx, etc.) por ser un MVP con un
 * único flujo lineal de navegación.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisStateService {
  private readonly _result = signal<AnalysisResult | null>(null);
  readonly result = this._result.asReadonly();

  setResult(result: AnalysisResult): void {
    this._result.set(result);
  }

  clear(): void {
    this._result.set(null);
  }
}
