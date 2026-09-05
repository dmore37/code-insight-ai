import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthPort } from './core/auth/application/ports/auth.port';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'code-insight-ai-web';

  private readonly auth = inject(AuthPort);
  readonly currentUser = this.auth.currentUser;

  logout(): void {
    this.auth.logout();
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.auth.currentUser()) return;

    event.preventDefault();
    event.returnValue = '';
  }
}
