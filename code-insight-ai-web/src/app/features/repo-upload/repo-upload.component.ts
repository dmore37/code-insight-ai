import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AnalysisRepositoryPort } from '../../core/code-analysis/domain/ports/analysis-repository.port';
import { AnalysisStateService } from '../analysis-result/analysis-state.service';

/**
 * Sección 1 del reto: carga de repositorio.
 * MVP: solo soporta URL git pública (opción 1). La carga de ZIP (opción 2)
 * queda planificada para una iteración futura (requiere subida a S3).
 */
@Component({
  selector: 'app-repo-upload',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './repo-upload.component.html',
  styleUrl: './repo-upload.component.scss',
})
export class RepoUploadComponent {
  private readonly analysisRepository = inject(AnalysisRepositoryPort);
  private readonly analysisState = inject(AnalysisStateService);
  private readonly router = inject(Router);

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
      const response = await this.analysisRepository.analyze({
        gitUrl: this.gitUrl.trim(),
      });

      if (response.success) {
        this.analysisState.setResult(response.data);
        this.router.navigateByUrl('/resultado');
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
}
