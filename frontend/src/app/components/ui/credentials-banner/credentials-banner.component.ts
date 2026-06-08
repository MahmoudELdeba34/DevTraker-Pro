import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingCredentialsResult } from '../../../services/onboarding.service';

@Component({
  selector: 'app-credentials-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './credentials-banner.component.html',
})
export class CredentialsBannerComponent {
  data = input.required<OnboardingCredentialsResult>();
  dismissed = output<void>();

  passwordCopied = signal(false);
  linkCopied = signal(false);
  messageCopied = signal(false);

  dismiss(): void {
    this.dismissed.emit();
  }

  private async copyText(text: string, flag: 'password' | 'link' | 'message'): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (flag === 'password') this.passwordCopied.set(true);
      if (flag === 'link') this.linkCopied.set(true);
      if (flag === 'message') this.messageCopied.set(true);
      setTimeout(() => {
        this.passwordCopied.set(false);
        this.linkCopied.set(false);
        this.messageCopied.set(false);
      }, 2200);
    } catch {
      // ignore
    }
  }

  copySetupLink(): void {
    void this.copyText(this.data().setupLink || '', 'link');
  }

  copyShareMessage(): void {
    void this.copyText(this.data().shareMessage || '', 'message');
  }

  copyTempPassword(): void {
    void this.copyText(this.data().tempPassword || '', 'password');
  }
}
