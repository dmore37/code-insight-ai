import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthPort } from '../domain/ports/auth.port';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthPort);
  const router = inject(Router);

  if (auth.currentUser()) return true;

  router.navigateByUrl('/login');
  return false;
};
