/** Usuario autenticado, derivado del claim `sub` y `email` del idToken de Cognito. */
export interface AuthUser {
  sub: string;
  email?: string;
}
