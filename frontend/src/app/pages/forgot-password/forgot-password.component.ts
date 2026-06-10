import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="auth-page flex flex-col items-center justify-center min-h-screen" [attr.data-locale]="locale.locale()">
      <!-- Logo Header Outside Card -->
      <div class="text-center mb-8 fade-in">
        <h1 class="text-3xl font-display font-bold tracking-tight text-white">
          Work<span class="text-accent">Track</span>
        </h1>
        <p class="text-xs text-text-muted mt-1 font-medium tracking-wide">{{ 'common.brandTagline' | translate }}</p>
      </div>

      <div class="auth-card glass-card w-full max-w-[440px] p-8 shadow-modal relative overflow-hidden slide-up">
        <div class="mb-8 flex items-start gap-4">
          <div class="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white mb-2 tracking-tight">{{ 'forgotPassword.title' | translate }}</h2>
            <p class="text-sm text-text-secondary leading-relaxed">{{ 'forgotPassword.hint' | translate }}</p>
          </div>
        </div>

        @if (submitted()) {
          <div class="alert mb-6 flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            {{ 'forgotPassword.checkEmail' | translate }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <label for="email" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'common.emailAddress' | translate }}</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <input
                id="email"
                type="email"
                formControlName="email"
                [placeholder]="locale.t('common.nameCompanyPlaceholder')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50"
                [class.border-danger]="form.get('email')?.invalid && form.get('email')?.touched"
              />
            </div>
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <span class="text-danger text-[11px] mt-1 font-medium">{{ 'common.validEmailAddress' | translate }}</span>
            }
          </div>

          <button
            type="submit"
            class="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-soft hover:shadow-glow"
            [disabled]="loading() || submitted()"
          >
            @if (loading()) {
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ 'forgotPassword.sending' | translate }}
            } @else {
              {{ 'forgotPassword.sendLink' | translate }}
            }
          </button>
        </form>

        <div class="mt-6 text-center">
          <a routerLink="/login" class="text-xs font-medium text-text-secondary hover:text-white transition-colors inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ 'forgotPassword.backToLogin' | translate }}
          </a>
        </div>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  form: FormGroup;
  loading = signal(false);
  submitted = signal(false);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  locale = inject(LocaleService);

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    this.loading.set(true);
    const email = this.form.get('email')?.value as string;
    this.auth.requestPasswordReset(email.trim()).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.submitted.set(true);
        this.toast.success(this.locale.t('forgotPassword.toast.resetLinkSent'));
        if (res.data?.resetLink) {
          console.info('[WorkTrack] Password reset link (SMTP not configured):', res.data.resetLink);
        }
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
