import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { codeAnalysisProviders } from './core/code-analysis/config/code-analysis.providers';
import { authProviders } from './core/auth/config/auth.providers';
import { authInterceptor } from './core/auth/infrastructure/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    ...codeAnalysisProviders,
    ...authProviders,
  ],
};
