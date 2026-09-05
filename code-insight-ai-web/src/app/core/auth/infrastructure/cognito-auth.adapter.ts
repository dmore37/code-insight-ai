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

@Injectable({ providedIn: 'root' })
export class CognitoAuthAdapter implements AuthPort {
  private readonly client = new CognitoIdentityProviderClient({
    region: environment.cognito.region,
  });
  private readonly clientId = environment.cognito.clientId;

  private cachedIdToken: string | null = null;

  private readonly userSignal = signal<AuthUser | null>(null);
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

      this.cachedIdToken = idToken;
      this.userSignal.set(this.decodeUser(idToken));
      return { success: true };
    } catch (err) {
      return { success: false, message: this.toMessage(err) };
    }
  }

  logout(): void {
    this.cachedIdToken = null;
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
    return this.cachedIdToken;
  }

  private decodeUser(idToken: string): AuthUser | null {
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      return { sub: payload.sub, email: payload.email };
    } catch {
      return null;
    }
  }

  private toMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return 'Ocurrió un error inesperado.';
  }
}
