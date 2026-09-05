import { Signal } from '@angular/core';
import { AuthUser } from '../../domain/models/auth-user.model';

export type AuthResult =
  | { success: true }
  | { success: false; message: string };

export abstract class AuthPort {

  abstract readonly currentUser: Signal<AuthUser | null>;

  abstract signUp(email: string, password: string): Promise<AuthResult>;
  abstract confirmSignUp(email: string, code: string): Promise<AuthResult>;
  abstract login(email: string, password: string): Promise<AuthResult>;
  abstract logout(): void;

  abstract forgotPassword(email: string): Promise<AuthResult>;

  abstract confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<AuthResult>;

  abstract getIdToken(): string | null;
}
