import { Routes } from '@angular/router';
import { RepoUploadComponent } from './features/repo-upload/repo-upload.component';
import { AnalysisResultComponent } from './features/analysis-result/analysis-result.component';
import { LoginComponent } from './features/auth/login.component';

// Nota: analizar por URL git pública NO requiere sesión, así que la
// pantalla principal y el resultado quedan sin `authGuard`. Solo el modo
// ZIP exige login, y esa validación se hace dentro de
// `RepoUploadComponent` (y, de forma definitiva, en el backend).
export const routes: Routes = [
  { path: '', component: RepoUploadComponent },
  { path: 'resultado', component: AnalysisResultComponent },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: '' },
];
