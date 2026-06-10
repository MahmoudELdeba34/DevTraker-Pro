import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  FaceCaptureComponent,
  FaceCaptureResult,
} from '../../components/ui/face-capture/face-capture.component';

@Component({
  selector: 'app-face-enroll',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, FaceCaptureComponent],
  template: `
    <div class="auth-page min-h-screen flex flex-col items-center justify-center px-4 py-10" [attr.data-locale]="locale.locale()">
      <div class="text-center mb-6 max-w-md animate-fade-up">
        <h1 class="text-2xl font-display font-bold text-white tracking-tight mb-2">
          {{ 'faceEnroll.title' | translate }}
        </h1>
        <p class="text-sm text-text-secondary leading-relaxed">{{ 'faceEnroll.subtitle' | translate }}</p>
        <ol class="mt-4 text-start text-xs text-text-muted space-y-1.5 list-decimal list-inside">
          <li>{{ 'faceEnroll.step1' | translate }}</li>
          <li>{{ 'faceEnroll.step2' | translate }}</li>
          <li>{{ 'faceEnroll.step3' | translate }}</li>
        </ol>
      </div>

      <div class="w-full max-w-lg animate-scale-in">
        <app-face-capture
          mode="enroll"
          [embedded]="true"
          [mandatory]="true"
          (captured)="onCaptured($event)"
          (cancel)="onLogout()"
        />
      </div>
    </div>
  `,
})
export class FaceEnrollComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  processing = signal(false);

  onCaptured(result: FaceCaptureResult): void {
    if (this.processing()) return;
    this.processing.set(true);

    this.auth.enrollFace(result.photo, result.descriptor).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.toast.success(this.locale.t('faceEnroll.success'));
          void this.router.navigate(['/employee-home']);
        }
      },
      error: (err) => {
        this.processing.set(false);
        const msg = err?.error?.error;
        this.toast.error(typeof msg === 'string' ? msg : this.locale.t('common.genericError'));
      },
    });
  }

  onLogout(): void {
    this.auth.logout();
  }
}
