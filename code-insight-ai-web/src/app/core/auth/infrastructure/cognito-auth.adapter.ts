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
import { encryptText, decryptText, deriveStorageKeyName } from './token-crypto.util';

// Nombre "legible" usado por versiones anteriores del código para
// guardar el JWT en texto plano en localStorage bajo este mismo nombre
// fijo. Se mantiene solo para poder limpiar ese residuo sin cifrar; el
// nombre REAL usado hoy es derivado (ver `deriveStorageKeyName`) para no
// revelar qué guarda la entrada.
const LEGACY_ID_TOKEN_STORAGE_KEY = 'codeInsightAi.idToken';

@Injectable({ providedIn: 'root' })
export class CognitoAuthAdapter implements AuthPort {
  private readonly client = new CognitoIdentityProviderClient({
    region: environment.cognito.region,
  });
  private readonly clientId = environment.cognito.clientId;
  private readonly encryptionKey = environment.tokenEncryptionKey;

  // Nombre de la clave de localStorage, derivado (ofuscado) a partir de
  // la clave de cifrado, para no exponer literalmente "idToken" como
  // nombre de la entrada en DevTools.
  private readonly idTokenStorageKey = deriveStorageKeyName('idToken', this.encryptionKey);

  // Copia en memoria del JWT en texto plano, para poder exponer
  // `getIdToken()` de forma síncrona (el interceptor HTTP la necesita
  // sin await). Lo único que se guarda ofuscado es localStorage.
  private cachedIdToken: string | null = null;

  private readonly userSignal = signal<AuthUser | null>(null);
  readonly currentUser = this.userSignal.asReadonly();

  constructor() {
    // Migración: versiones anteriores guardaban el JWT en texto plano en
    // localStorage bajo un nombre fijo y legible (mismo storage que
    // usamos hoy, pero con nombre y valor sin cifrar). Lo eliminamos aquí
    // para no dejar un token sin cifrar residual bajo el nombre viejo.
    localStorage.removeItem(LEGACY_ID_TOKEN_STORAGE_KEY);
    void this.restoreUser();
  }

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

      const cipherText = await encryptText(idToken, this.encryptionKey);
      localStorage.setItem(this.idTokenStorageKey, cipherText);
      this.cachedIdToken = idToken;
      this.userSignal.set(this.decodeUser(idToken));
      return { success: true };
    } catch (err) {
      return { success: false, message: this.toMessage(err) };
    }
  }

  logout(): void {
    localStorage.removeItem(this.idTokenStorageKey);
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

  private async restoreUser(): Promise<void> {
    const cipherText = localStorage.getItem(this.idTokenStorageKey);
    if (!cipherText) return;

    const token = await decryptText(cipherText, this.encryptionKey);
    if (!token) {
      localStorage.removeItem(this.idTokenStorageKey);
      return;
    }

    const user = this.decodeUser(token);
    if (user && this.isExpired(token)) {
      localStorage.removeItem(this.idTokenStorageKey);
      return;
    }

    this.cachedIdToken = token;
    this.userSignal.set(user);
  }

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
