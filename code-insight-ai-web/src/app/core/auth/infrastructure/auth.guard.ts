import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthPort } from '../domain/ports/auth.port';

/**
 * Guard funcional: exige una sesión de Cognito activa para acceder a la
 * ruta. Complementa (no reemplaza) la protección real, que es el JWT
 * Authorizer de API Gateway; esto solo evita mostrarle al usuario una
 * pantalla que de todas formas fallaría al llamar a la API.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthPort);
  const router = inject(Router);

  if (auth.currentUser()) return true;

  router.navigateByUrl('/login');
  return false;
};
