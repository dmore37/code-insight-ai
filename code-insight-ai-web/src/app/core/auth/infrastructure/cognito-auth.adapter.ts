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
import { AuthPort, AuthResult } from '../application/ports/auth.port';
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
    const name = this.errorName(err);
    const known = COGNITO_ERROR_MESSAGES[name];
    if (known) return known;

    return GENERIC_UNEXPECTED_ERROR_MESSAGE;
  }

  private errorName(err: unknown): string {
    if (err && typeof err === 'object' && 'name' in err) {
      return String((err as { name: unknown }).name);
    }
    return '';
  }
}

const GENERIC_UNEXPECTED_ERROR_MESSAGE =
  'Ocurrió un error inesperado al procesar la solicitud.';

const COGNITO_ERROR_MESSAGES: Record<string, string> = {
  UsernameExistsException:
    'Ya existe una cuenta registrada con ese correo electrónico.',
  AliasExistsException:
    'Ese correo electrónico ya está en uso por otra cuenta.',
  UserNotFoundException: 'No existe ninguna cuenta con ese correo electrónico.',
  NotAuthorizedException: 'Correo o contraseña incorrectos.',
  UserNotConfirmedException:
    'Tu cuenta aún no ha sido confirmada. Revisa tu correo e ingresa el código de confirmación.',
  PasswordResetRequiredException:
    'Debes restablecer tu contraseña antes de continuar. Usa la opción "¿Olvidaste tu contraseña?".',

  InvalidPasswordException:
    'La contraseña no cumple con los requisitos: mínimo 8 caracteres, una mayúscula, una minúscula y un número.',
  InvalidParameterException:
    'Alguno de los datos ingresados no es válido. Revísalos e intenta de nuevo.',

  CodeMismatchException:
    'El código ingresado no es correcto. Verifica e intenta de nuevo.',
  ExpiredCodeException:
    'El código ha expirado. Solicita uno nuevo e intenta de nuevo.',
  CodeDeliveryFailureException:
    'No se pudo enviar el código de verificación a tu correo. Intenta de nuevo más tarde.',

  LimitExceededException:
    'Se alcanzó el límite de intentos. Espera unos minutos e intenta de nuevo.',
  TooManyRequestsException:
    'Demasiados intentos en poco tiempo. Espera unos minutos e intenta de nuevo.',
  TooManyFailedAttemptsException:
    'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',

  ResourceNotFoundException:
    'El servicio de autenticación no está disponible en este momento. Intenta de nuevo más tarde.',
  InternalErrorException:
    'El servicio de autenticación tuvo un problema interno. Intenta de nuevo más tarde.',
  UnexpectedLambdaException:
    'El servicio de autenticación tuvo un problema interno. Intenta de nuevo más tarde.',
  UserLambdaValidationException:
    'No se pudo completar la validación de la cuenta. Intenta de nuevo más tarde.',
  InvalidEmailRoleAccessPolicyException:
    'El servicio de envío de correos no está disponible en este momento. Intenta de nuevo más tarde.',
};
