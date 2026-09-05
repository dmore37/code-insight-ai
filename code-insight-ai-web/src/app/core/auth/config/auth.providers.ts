import { Provider } from '@angular/core';
import { AuthPort } from '../application/ports/auth.port';
import { CognitoAuthAdapter } from '../infrastructure/cognito-auth.adapter';

export const authProviders: Provider[] = [
  { provide: AuthPort, useClass: CognitoAuthAdapter },
];
