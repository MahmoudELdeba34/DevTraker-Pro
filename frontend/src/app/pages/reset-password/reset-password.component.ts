import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
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
      <div class="text-center mb-8 fade-in">
        <h1 class="text-3xl font-display font-bold tracking-tight text-white">
          Pro<span class="text-accent">Track</span>
        </h1>
        <p class="text-xs text-text-muted mt-1 font-medium tracking-wide">{{ 'common.brandTagline' | translate }}</p>
      </div>

      <div class="auth-card glass-card w-full max-w-[440px] p-8 shadow-modal relative overflow-hidden slide-up">
        @if (validating()) {
          <div class="py-8 text-center text-sm text-text-muted">{{ 'common.loading' | translate }}</div>
        } @else if (!linkValid()) {
          <div class="text-center py-6">
            <p class="text-sm text-text-secondary mb-4">{{ 'resetPassword.invalidLink' | translate }}</p>
            <a routerLink="/forgot-password" class="text-accent text-sm font-medium hover:underline">
              {{ 'forgotPassword.sendLink' | translate }}
            </a>
          </div>
        } @else {
          <div class="mb-8 flex items-start gap-4">
            <div class="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
              <input
                id="password"
                type="password"
                formControlName="password"
                [placeholder]="locale.t('common.passwordMin8Placeholder')"
                class="field-input"
                [class.border-danger]="form.get('password')?.invalid && form.get('password')?.touched"
              />
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <span class="text-danger text-[11px] mt-1 font-medium">{{ 'resetPassword.passwordMin8' | translate }}</span>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="confirmPassword" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'resetPassword.confirmPassword' | translate }}</label>
              <input
                id="confirmPassword"
                type="password"
                formControlName="confirmPassword"
                [placeholder]="locale.t('common.repeatPassword')"
                class="field-input"
                [class.border-danger]="(form.get('confirmPassword')?.invalid || form.errors?.['passwordMismatch']) && form.get('confirmPassword')?.touched"
              />
              @if ((form.get('confirmPassword')?.invalid || form.errors?.['passwordMismatch']) && form.get('confirmPassword')?.touched) {
                <span class="text-danger text-[11px] mt-1 font-medium">{{ 'resetPassword.passwordsMustMatch' | translate }}</span>
              }
            </div>

            <button type="submit" class="btn-primary w-full justify-center" [disabled]="loading()">
              {{ loading() ? ('resetPassword.resetting' | translate) : ('resetPassword.resetBtn' | translate) }}
            </button>
          </form>
        }

        <div class="mt-6 text-center">
          <a routerLink="/login" class="text-xs font-medium text-text-secondary hover:text-white transition-colors inline-flex items-center gap-2">
            {{ 'common.backToLogin' | translate }}
          </a>
        </div>
      </div>
    </div>
  `
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  loading = signal(false);
  validating = signal(true);
  linkValid = signal(false);

  private token = '';
  private email = '';

  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  locale = inject(LocaleService);

  constructor() {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';

    if (!this.token || !this.email) {
      this.validating.set(false);
      this.linkValid.set(false);
      return;
    }

    this.auth.validatePasswordReset(this.token, this.email).subscribe({
      next: () => {
        this.validating.set(false);
        this.linkValid.set(true);
      },
      error: () => {
        this.validating.set(false);
        this.linkValid.set(false);
      },
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (!this.linkValid() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const password = this.form.get('password')?.value as string;
    this.loading.set(true);
    this.auth.completePasswordReset(this.token, this.email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success(this.locale.t('resetPassword.toast.success'));
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
