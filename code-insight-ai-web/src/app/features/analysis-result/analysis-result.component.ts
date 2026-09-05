import { Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AnalysisStateService } from './analysis-state.service';
import { DetectedComponent } from '../../core/code-analysis/domain/models/analysis-result.model';

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

  constructor() {
    effect(() => {
      if (!this.result()) {
        this.router.navigateByUrl('/');
      }
    });
  }

  readonly confidencePercent = computed(() => {
    const r = this.result();
    return r ? Math.round(r.architecture.confidence * 100) : 0;
  });

  readonly componentsByType = computed(() => {
    const r = this.result();
    if (!r) return [];
    const groups = new Map<string, DetectedComponent[]>();
    for (const c of r.components) {
      const list = groups.get(c.type) ?? [];
      list.push(c);
      groups.set(c.type, list);
    }
    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      count: items.length,
      items,
    }));
  });

  goBack(): void {
    this.analysisState.clear();
    this.router.navigateByUrl('/');
  }

  exportToPdf(): void {
    window.print();
  }
}
