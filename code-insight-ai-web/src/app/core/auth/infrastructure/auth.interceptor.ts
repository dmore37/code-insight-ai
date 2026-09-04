import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthPort } from '../domain/ports/auth.port';
import { environment } from '../../../../environments/environment';

/**
 * Interceptor funcional: adjunta `Authorization: Bearer <idToken>` y
 * `x-user-id: <sub>` a las peticiones dirigidas a la API propia, si hay
 * una sesión de Cognito activa. `x-user-id` es un mecanismo temporal
 * (ver TODO(cognito) en el backend) mientras el JWT authorizer de API
 * Gateway no esté habilitado; el backend ya puede leer el claim `sub`
 * directamente del token una vez se active la verificación JWT.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const auth = inject(AuthPort);
  const idToken = auth.getIdToken();
  const user = auth.currentUser();

  if (!idToken || !user) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${idToken}`,
      'x-user-id': user.sub,
    },
  });
  return next(authReq);
};
