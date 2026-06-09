import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="auth-page flex flex-col items-center justify-center min-h-screen" [attr.data-locale]="locale.locale()">
      <!-- Logo Header Outside Card -->
      <div class="text-center mb-8 fade-in">
        <h1 class="text-3xl font-display font-bold tracking-tight text-white">
          Pro<span class="text-accent">Track</span>
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
            <h2 class="text-xl font-bold text-white mb-2 tracking-tight">{{ 'resetPassword.title' | translate }}</h2>
            <p class="text-sm text-text-secondary leading-relaxed">{{ 'resetPassword.hint' | translate }}</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <label for="password" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'resetPassword.newPassword' | translate }}</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <input
                id="password"
                type="password"
                formControlName="password"
                [placeholder]="locale.t('common.passwordMin8Placeholder')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50 tracking-wide"
                [class.border-danger]="form.get('password')?.invalid && form.get('password')?.touched"
              />
            </div>
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <span class="text-danger text-[11px] mt-1 font-medium">{{ 'resetPassword.passwordMin8' | translate }}</span>
            }
          </div>

          <div class="flex flex-col gap-2">
            <label for="confirmPassword" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'resetPassword.confirmPassword' | translate }}</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <input
                id="confirmPassword"
                type="password"
                formControlName="confirmPassword"
                [placeholder]="locale.t('common.repeatPassword')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50 tracking-wide"
                [class.border-danger]="(form.get('confirmPassword')?.invalid || form.errors?.['passwordMismatch']) && form.get('confirmPassword')?.touched"
              />
            </div>
            @if ((form.get('confirmPassword')?.invalid || form.errors?.['passwordMismatch']) && form.get('confirmPassword')?.touched) {
              <span class="text-danger text-[11px] mt-1 font-medium">{{ 'resetPassword.passwordsMustMatch' | translate }}</span>
            }
          </div>

          <button
            type="submit"
            class="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]"
            [disabled]="loading()"
          >
            @if (loading()) {
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ 'resetPassword.resetting' | translate }}
            } @else {
              {{ 'resetPassword.resetBtn' | translate }}
            }
          </button>
        </form>

        <div class="mt-6 text-center">
          <a routerLink="/login" class="text-xs font-medium text-text-secondary hover:text-white transition-colors inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {{ 'common.backToLogin' | translate }}
          </a>
        </div>
      </div>
    </div>
  `
})
export class ResetPasswordComponent {
  form: FormGroup;
  loading = signal(false);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  locale = inject(LocaleService);

  constructor() {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    this.loading.set(true);
    setTimeout(() => {
      this.loading.set(false);
      this.toast.success(this.locale.t('resetPassword.toast.success'));
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    }, 1500);
  }
}
