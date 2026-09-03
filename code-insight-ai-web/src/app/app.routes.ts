import { Routes } from '@angular/router';
import { RepoUploadComponent } from './features/repo-upload/repo-upload.component';
import { AnalysisResultComponent } from './features/analysis-result/analysis-result.component';

export const routes: Routes = [
  { path: '', component: RepoUploadComponent },
  { path: 'resultado', component: AnalysisResultComponent },
  { path: '**', redirectTo: '' },
];
