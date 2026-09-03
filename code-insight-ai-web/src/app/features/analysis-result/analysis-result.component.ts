import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AnalysisStateService } from './analysis-state.service';

@Component({
  selector: 'app-analysis-result',
  standalone: true,
  templateUrl: './analysis-result.component.html',
  styleUrl: './analysis-result.component.scss',
})
export class AnalysisResultComponent {
  private readonly analysisState = inject(AnalysisStateService);
  private readonly router = inject(Router);

  readonly result = this.analysisState.result;

  readonly confidencePercent = computed(() => {
    const r = this.result();
    return r ? Math.round(r.architecture.confidence * 100) : 0;
  });

  readonly componentsByType = computed(() => {
    const r = this.result();
    if (!r) return [];
    const groups = new Map<string, number>();
    for (const c of r.components) {
      groups.set(c.type, (groups.get(c.type) ?? 0) + 1);
    }
    return Array.from(groups.entries()).map(([type, count]) => ({
      type,
      count,
    }));
  });

  goBack(): void {
    this.analysisState.clear();
    this.router.navigateByUrl('/');
  }
}
