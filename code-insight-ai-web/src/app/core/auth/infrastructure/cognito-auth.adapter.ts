import { Injectable, signal } from '@angular/core';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  AuthFlowType,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { environment } from '../../../../environments/environment';
import { AuthPort, AuthResult } from '../domain/ports/auth.port';
import { AuthUser } from '../domain/models/auth-user.model';

const ID_TOKEN_STORAGE_KEY = 'codeInsightAi.idToken';

/**
 * Adaptador de infraestructura: implementa el login/registro contra el
 * User Pool de Cognito usando el SDK directamente desde el navegador
 * (App Client sin secreto, apto para SPA). El idToken (JWT) se persiste
 * en localStorage para sobrevivir recargas de página.
 */
@Injectable({ providedIn: 'root' })
export class CognitoAuthAdapter implements AuthPort {
  private readonly client = new CognitoIdentityProviderClient({
    region: environment.cognito.region,
  });
  private readonly clientId = environment.cognito.clientId;

  private readonly userSignal = signal<AuthUser | null>(this.restoreUser());
  readonly currentUser = this.userSignal.asReadonly();

  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      await this.client.send(
        new SignUpCommand({
          ClientId: this.clientId,
          Username: email,
          Password: password,
          UserAttributes: [{ Name: 'email', Value: email }],
        }),
      );
      return { success: true };
    } catch (err) {
      return { success: false, message: this.toMessage(err) };
    }
  }

  async confirmSignUp(email: string, code: string): Promise<AuthResult> {
    try {
      await this.client.send(
        new ConfirmSignUpCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: code,
        }),
      );
      return { success: true };
    } catch (err) {
      return { success: false, message: this.toMessage(err) };
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const response = await this.client.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: this.clientId,
          AuthParameters: { USERNAME: email, PASSWORD: password },
        }),
      );

      const idToken = response.AuthenticationResult?.IdToken;
      if (!idToken) {
        return { success: false, message: 'No se recibió token de sesión.' };
      }

      localStorage.setItem(ID_TOKEN_STORAGE_KEY, idToken);
      this.userSignal.set(this.decodeUser(idToken));
      return { success: true };
    } catch (err) {
      return { success: false, message: this.toMessage(err) };
    }
  }

  logout(): void {
    localStorage.removeItem(ID_TOKEN_STORAGE_KEY);
    this.userSignal.set(null);
  }

  async forgotPassword(email: string): Promise<AuthResult> {
    try {
      await this.client.send(
        new ForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
        }),
      );
      return { success: true };
    } catch (err) {
      return { success: false, message: this.toMessage(err) };
    }
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<AuthResult> {
    try {
      await this.client.send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: code,
          Password: newPassword,
        }),
      );
      return { success: true };
    } catch (err) {
      return { success: false, message: this.toMessage(err) };
    }
  }

  getIdToken(): string | null {
    return localStorage.getItem(ID_TOKEN_STORAGE_KEY);
  }

  private restoreUser(): AuthUser | null {
    const token = localStorage.getItem(ID_TOKEN_STORAGE_KEY);
    if (!token) return null;
    const user = this.decodeUser(token);
    // Si el token ya expiró, se descarta la sesión restaurada.
    if (user && this.isExpired(token)) {
      localStorage.removeItem(ID_TOKEN_STORAGE_KEY);
      return null;
    }
    return user;
  }

  /** Decodifica el payload de un JWT (sin verificar firma; solo lectura local). */
  private decodeUser(idToken: string): AuthUser | null {
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      return { sub: payload.sub, email: payload.email };
    } catch {
      return null;
    }
  }

  private isExpired(idToken: string): boolean {
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  private toMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return 'Ocurrió un error inesperado.';
  }
}
