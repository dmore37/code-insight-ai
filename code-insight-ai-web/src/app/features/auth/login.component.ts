import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthPort } from '../../core/auth/application/ports/auth.port';

type AuthMode = 'login' | 'signup' | 'confirm' | 'forgot' | 'reset';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

enum AuthUiMessage {
  FillAllFields = 'Completa todos los campos.',
  PasswordRequirements = 'La contraseña debe tener al menos 8 caracteres, incluyendo una mayúscula, una minúscula y un número.',
  AccountCreated = 'Cuenta creada. Revisa tu correo e ingresa el código de confirmación.',
  EnterConfirmationCode = 'Ingresa el código de confirmación.',
  AccountConfirmed = 'Cuenta confirmada. Ya puedes iniciar sesión.',
  RecoveryCodeSent = 'Te enviamos un código de recuperación a tu correo.',
  FillCodeAndNewPassword = 'Completa el código y la nueva contraseña.',
  PasswordUpdated = 'Contraseña actualizada. Ya puedes iniciar sesión.',
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthPort);
  private readonly router = inject(Router);

  mode = signal<AuthMode>('login');
  email = '';
  password = '';
  confirmationCode = '';
  newPassword = '';

  passwordTouched = signal(false);
  newPasswordTouched = signal(false);

  readonly passwordValid = computed(() => PASSWORD_REGEX.test(this.password));
  readonly newPasswordValid = computed(() =>
    PASSWORD_REGEX.test(this.newPassword),
  );
  readonly passwordHint = AuthUiMessage.PasswordRequirements;

  onPasswordInput(): void {
    this.passwordTouched.set(true);
  }

  onNewPasswordInput(): void {
    this.newPasswordTouched.set(true);
  }

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  infoMessage = signal<string | null>(null);

  setMode(mode: AuthMode): void {
    if (this.isLoading()) return;
    this.mode.set(mode);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.passwordTouched.set(false);
    this.newPasswordTouched.set(false);
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    const requiresPassword =
      this.mode() !== 'confirm' && this.mode() !== 'forgot';
    if (!this.email.trim() || (requiresPassword && !this.password)) {
      this.errorMessage.set(AuthUiMessage.FillAllFields);
      return;
    }

    this.isLoading.set(true);
    try {
      if (this.mode() === 'login') {
        await this.doLogin();
      } else if (this.mode() === 'signup') {
        await this.doSignUp();
      } else if (this.mode() === 'confirm') {
        await this.doConfirm();
      } else if (this.mode() === 'forgot') {
        await this.doForgotPassword();
      } else {
        await this.doResetPassword();
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private async doLogin(): Promise<void> {
    const result = await this.auth.login(this.email.trim(), this.password);
    if (!result.success) {
      this.errorMessage.set(result.message);
      return;
    }
    this.router.navigateByUrl('/');
  }

  private async doSignUp(): Promise<void> {
    if (!this.passwordValid()) {
      this.passwordTouched.set(true);
      this.errorMessage.set(AuthUiMessage.PasswordRequirements);
      return;
    }
    const result = await this.auth.signUp(this.email.trim(), this.password);
    if (!result.success) {
      this.errorMessage.set(result.message);
      return;
    }
    this.infoMessage.set(AuthUiMessage.AccountCreated);
    this.mode.set('confirm');
  }

  private async doConfirm(): Promise<void> {
    if (!this.confirmationCode.trim()) {
      this.errorMessage.set(AuthUiMessage.EnterConfirmationCode);
      return;
    }
    const result = await this.auth.confirmSignUp(
      this.email.trim(),
      this.confirmationCode.trim(),
    );
    if (!result.success) {
      this.errorMessage.set(result.message);
      return;
    }
    this.infoMessage.set(AuthUiMessage.AccountConfirmed);
    this.mode.set('login');
  }

  private async doForgotPassword(): Promise<void> {
    const result = await this.auth.forgotPassword(this.email.trim());
    if (!result.success) {
      this.errorMessage.set(result.message);
      return;
    }
    this.infoMessage.set(AuthUiMessage.RecoveryCodeSent);
    this.mode.set('reset');
  }

  private async doResetPassword(): Promise<void> {
    if (!this.confirmationCode.trim() || !this.newPassword) {
      this.errorMessage.set(AuthUiMessage.FillCodeAndNewPassword);
      return;
    }
    if (!this.newPasswordValid()) {
      this.newPasswordTouched.set(true);
      this.errorMessage.set(AuthUiMessage.PasswordRequirements);
      return;
    }
    const result = await this.auth.confirmForgotPassword(
      this.email.trim(),
      this.confirmationCode.trim(),
      this.newPassword,
    );
    if (!result.success) {
      this.errorMessage.set(result.message);
      return;
    }
    this.infoMessage.set(AuthUiMessage.PasswordUpdated);
    this.password = '';
    this.newPassword = '';
    this.confirmationCode = '';
    this.mode.set('login');
  }
}
