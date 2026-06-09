import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingCredentialsResult } from '../../../services/onboarding.service';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-credentials-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './credentials-banner.component.html',
})
export class CredentialsBannerComponent {
  locale = inject(LocaleService);

  data = input.required<OnboardingCredentialsResult>();
  dismissed = output<void>();

  passwordCopied = signal(false);
  linkCopied = signal(false);
  messageCopied = signal(false);

  shareTitle = computed(() =>
    this.locale.t('credentialsBanner.shareWith', {
      name: this.data().invitedUser.name || this.data().invitedUser.email,
    })
  );

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
