import { Injectable, signal } from '@angular/core';
import { AnalysisResult } from '../../domain/models/analysis-result.model';

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
