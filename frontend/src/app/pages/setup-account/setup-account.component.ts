import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-setup-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="auth-page flex flex-col items-center justify-center min-h-screen" [attr.data-locale]="locale.locale()">
      <div class="text-center mb-8 fade-in">
        <h1 class="text-3xl font-display font-bold tracking-tight text-white">
          Work<span class="text-accent">Track</span>
        </h1>
        <p class="text-xs text-text-muted mt-1 font-medium tracking-wide">{{ 'common.brandTagline' | translate }}</p>
      </div>

      <div class="auth-card glass-card w-full max-w-[440px] p-8 shadow-modal relative overflow-hidden slide-up">
        @if (loading()) {
          <div class="py-10 text-center text-sm text-text-secondary">{{ 'setupAccount.checking' | translate }}</div>
        } @else if (invalid()) {
          <div class="text-center py-6">
            <h2 class="text-xl font-bold text-white mb-2">{{ 'setupAccount.expired' | translate }}</h2>
            <p class="text-sm text-text-secondary mb-6">{{ 'setupAccount.expiredHint' | translate }}</p>
            <a routerLink="/login" class="btn-accent inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white">{{ 'common.goToLogin' | translate }}</a>
          </div>
        } @else {
          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-2 tracking-tight">{{ 'setupAccount.activate' | translate }}</h2>
            <p class="text-sm text-text-secondary leading-relaxed">
              {{ locale.t('setupAccount.welcome', { name: employeeName() }) }}
            </p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-5">
            <div class="flex flex-col gap-2">
              <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'common.email' | translate }}</label>
              <input
                type="email"
                [value]="email()"
                readonly
                class="w-full bg-bg-base/60 border border-border text-text-secondary text-sm rounded-lg px-4 py-2.5 outline-none"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label for="password" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'auth.password' | translate }}</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                [placeholder]="locale.t('common.passwordMin8Placeholder')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none focus:border-accent"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label for="confirmPassword" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'common.confirmPasswordField' | translate }}</label>
              <input
                id="confirmPassword"
                type="password"
                formControlName="confirmPassword"
                [placeholder]="locale.t('common.repeatPasswordShort')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none focus:border-accent"
              />
              @if (form.errors?.['passwordMismatch'] && form.get('confirmPassword')?.touched) {
                <span class="text-danger text-[11px]">{{ 'setupAccount.passwordsMismatch' | translate }}</span>
              }
            </div>
            <button
              type="submit"
              class="btn-accent w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              [disabled]="submitting() || form.invalid"
            >
              {{ submitting() ? ('setupAccount.saving' | translate) : ('setupAccount.activateBtn' | translate) }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class SetupAccountComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  form: FormGroup = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator }
  );

  token = signal('');
  email = signal('');
  employeeName = signal('');
  loading = signal(true);
  invalid = signal(false);
  submitting = signal(false);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') || '';
    const email = (this.route.snapshot.queryParamMap.get('email') || '').toLowerCase();
    this.token.set(token);
    this.email.set(email);

    if (!token || !email) {
      this.loading.set(false);
      this.invalid.set(true);
      return;
    }

    this.auth.validateSetupAccount(token, email).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.employeeName.set(res.data.name);
        } else {
          this.invalid.set(true);
        }
      },
      error: () => {
        this.loading.set(false);
        this.invalid.set(true);
      },
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password !== confirmPassword ? { passwordMismatch: true } : null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const password = this.form.get('password')?.value as string;

    this.auth.completeSetupAccount(this.token(), this.email(), password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.locale.t('setupAccount.toast.activated'));
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error(err?.error?.error || this.locale.t('setupAccount.toast.activateFailed'));
      },
    });
  }
}
