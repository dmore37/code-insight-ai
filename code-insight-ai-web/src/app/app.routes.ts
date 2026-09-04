import { Routes } from '@angular/router';
import { RepoUploadComponent } from './features/repo-upload/repo-upload.component';
import { AnalysisResultComponent } from './features/analysis-result/analysis-result.component';
import { LoginComponent } from './features/auth/login.component';

export const routes: Routes = [
  { path: '', component: RepoUploadComponent },
  { path: 'resultado', component: AnalysisResultComponent },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: '' },
];
