import { Signal } from '@angular/core';
import { AuthUser } from '../models/auth-user.model';

/** Resultado genérico de una operación de autenticación fallida/exitosa. */
export type AuthResult =
  | { success: true }
  | { success: false; message: string };

/**
 * Puerto de salida: operaciones de autenticación contra Cognito (o el
 * proveedor que corresponda). El estado de sesión se expone como signal
 * reactiva (`currentUser`) para que los componentes puedan reaccionar a
 * login/logout sin polling manual.
 */
export abstract class AuthPort {
  /** Usuario actual (null si no hay sesión activa). */
  abstract readonly currentUser: Signal<AuthUser | null>;

  abstract signUp(email: string, password: string): Promise<AuthResult>;
  abstract confirmSignUp(email: string, code: string): Promise<AuthResult>;
  abstract login(email: string, password: string): Promise<AuthResult>;
  abstract logout(): void;

  /** Inicia el flujo de recuperación de contraseña (envía código por email). */
  abstract forgotPassword(email: string): Promise<AuthResult>;
  /** Confirma el código de recuperación y establece la nueva contraseña. */
  abstract confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<AuthResult>;

  /** Token de identidad (JWT) de la sesión activa, o null si no hay sesión. */
  abstract getIdToken(): string | null;
}
