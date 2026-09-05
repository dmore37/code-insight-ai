import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthPort } from '../application/ports/auth.port';
import { environment } from '../../../../environments/environment';

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
