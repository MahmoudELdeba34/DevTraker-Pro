import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { UiPreferencesComponent } from '../../components/ui/ui-preferences/ui-preferences.component';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, UiPreferencesComponent],
  template: `
    <div class="auth-page flex flex-col items-center justify-center min-h-screen relative" [attr.data-locale]="locale.locale()">
      <div class="absolute top-6 right-6 z-10" [class.left-6]="locale.isRtl()" [class.right-auto]="locale.isRtl()">
        <app-ui-preferences [compact]="true" />
      </div>

      <div class="text-center mb-8 fade-in">
        <h1 class="text-3xl font-display font-bold tracking-tight text-white">
          Work<span class="text-accent">Track</span>
        </h1>
        <p class="text-xs text-text-muted mt-1 font-medium tracking-wide">{{ 'common.brandTagline' | translate }}</p>
      </div>

      <div class="auth-card glass-card w-full max-w-[440px] p-8 shadow-modal relative overflow-hidden slide-up">
        @if (checking()) {
          <div class="py-10 text-center text-sm text-text-secondary">{{ 'register.checking' | translate }}</div>
        } @else if (!registrationOpen()) {
          <div class="text-center py-4">
            <h2 class="text-xl font-bold text-white mb-2">{{ 'register.closedTitle' | translate }}</h2>
            <p class="text-sm text-text-secondary leading-relaxed mb-6">{{ 'register.closedHint' | translate }}</p>
            <a routerLink="/login" class="btn-accent inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white">
              {{ 'common.goToLogin' | translate }}
            </a>
          </div>
        } @else {
          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-2 tracking-tight">{{ 'register.heading' | translate }}</h2>
            <p class="text-sm text-text-secondary leading-relaxed">
              @if (bootstrap()) {
                {{ 'register.bootstrapHint' | translate }}
              } @else {
                {{ 'register.subtitle' | translate }}
              }
            </p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-5">
            <div class="flex flex-col gap-2">
              <label for="name" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'register.fullName' | translate }}</label>
              <input
                id="name"
                type="text"
                formControlName="name"
                [placeholder]="locale.t('common.johnDoePlaceholder')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50"
                [class.border-danger]="form.get('name')?.invalid && form.get('name')?.touched"
              />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <span class="text-danger text-[11px]">{{ 'register.nameRequired' | translate }}</span>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="email" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'register.email' | translate }}</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                [placeholder]="locale.t('common.youExamplePlaceholder')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50"
                [class.border-danger]="form.get('email')?.invalid && form.get('email')?.touched"
              />
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <span class="text-danger text-[11px]">{{ 'register.emailInvalid' | translate }}</span>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="password" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'register.password' | translate }}</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                [placeholder]="locale.t('common.passwordMin6Placeholder')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none transition-all focus:border-accent placeholder:text-text-muted/50"
                [class.border-danger]="form.get('password')?.invalid && form.get('password')?.touched"
              />
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <span class="text-danger text-[11px]">{{ 'register.passwordRequired' | translate }}</span>
              }
              @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
                <span class="text-danger text-[11px]">{{ 'register.passwordMin6' | translate }}</span>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="confirmPassword" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'common.confirmPasswordField' | translate }}</label>
              <input
                id="confirmPassword"
                type="password"
                formControlName="confirmPassword"
                [placeholder]="locale.t('common.repeatPasswordShort')"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none transition-all focus:border-accent placeholder:text-text-muted/50"
              />
              @if (form.errors?.['passwordMismatch'] && form.get('confirmPassword')?.touched) {
                <span class="text-danger text-[11px]">{{ 'register.passwordsMismatch' | translate }}</span>
              }
            </div>

            <button
              type="submit"
              class="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2.5 rounded-lg mt-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-soft"
              [disabled]="loading()"
            >
              @if (loading()) {
                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {{ 'register.creating' | translate }}
              } @else {
                {{ 'register.createAccount' | translate }}
              }
            </button>
          </form>

          <p class="text-center text-sm text-text-secondary mt-6">
            {{ 'register.alreadyHave' | translate }}
            <a routerLink="/login" class="text-accent font-semibold hover:text-accent-hover transition-colors">{{ 'register.signIn' | translate }}</a>
          </p>
        }
      </div>
    </div>
  `,
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  form!: FormGroup;
  loading = signal(false);
  checking = signal(true);
  registrationOpen = signal(false);
  bootstrap = signal(false);

  ngOnInit(): void {
    this.form = this.fb.group(
      {
        name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatch }
    );

    if (this.authService.isLoggedIn()) {
      this.authService.navigateAfterAuth();
      return;
    }

    this.authService.getRegistrationStatus().subscribe({
      next: (res) => {
        this.checking.set(false);
        if (res.success && res.data) {
          this.registrationOpen.set(res.data.open);
          this.bootstrap.set(res.data.bootstrap);
        }
      },
      error: () => {
        this.checking.set(false);
        this.registrationOpen.set(false);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { name, email, password } = this.form.value as {
      name: string;
      email: string;
      password: string;
    };

    this.authService.register(name, email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success(this.locale.t('register.toast.accountCreated'));
        this.authService.navigateAfterAuth();
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.toast.error(err.error?.error ?? this.locale.t('register.toast.registrationFailed'));
      },
    });
  }
}
