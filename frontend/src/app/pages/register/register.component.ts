import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="auth-page" [attr.data-locale]="locale.locale()">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <h1>{{ 'register.title' | translate }}</h1>
          <p>{{ 'register.subtitle' | translate }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="name">{{ 'register.fullName' | translate }}</label>
            <input
              id="name"
              type="text"
              formControlName="name"
              [placeholder]="locale.t('common.johnDoePlaceholder')"
              [class.invalid]="form.get('name')?.invalid && form.get('name')?.touched"
            />
            @if (form.get('name')?.invalid && form.get('name')?.touched) {
              <span class="field-error">{{ 'register.nameRequired' | translate }}</span>
            }
          </div>

          <div class="form-group">
            <label for="email">{{ 'register.email' | translate }}</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              [placeholder]="locale.t('common.youExamplePlaceholder')"
              [class.invalid]="form.get('email')?.invalid && form.get('email')?.touched"
            />
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <span class="field-error">{{ 'register.emailInvalid' | translate }}</span>
            }
          </div>

          <div class="form-group">
            <label for="password">{{ 'register.password' | translate }}</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              [placeholder]="locale.t('common.passwordMin6Placeholder')"
              [class.invalid]="form.get('password')?.invalid && form.get('password')?.touched"
            />
            @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
              <span class="field-error">{{ 'register.passwordRequired' | translate }}</span>
            }
            @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
              <span class="field-error">{{ 'register.passwordMin6' | translate }}</span>
            }
          </div>

          <div class="form-group">
            <label for="role">{{ 'register.role' | translate }}</label>
            <select
              id="role"
              formControlName="role"
              class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
            >
              <option value="employee">{{ locale.roleLabel('employee') }}</option>
              <option value="manager">{{ locale.roleLabel('manager') }}</option>
              <option value="hr">{{ locale.t('role.global.hrSpecialist') }}</option>
              <option value="accountant">{{ locale.roleLabel('accountant') }}</option>
              <option value="admin">{{ locale.t('role.global.administrator') }}</option>
            </select>
          </div>

          <button
            type="submit"
            class="btn-primary btn-full"
            [disabled]="loading()"
          >
            @if (loading()) {
              <span class="spinner"></span> {{ 'register.creating' | translate }}
            } @else {
              {{ 'register.createAccount' | translate }}
            }
          </button>
        </form>

        <p class="auth-footer">
          {{ 'register.alreadyHave' | translate }}
          <a routerLink="/login">{{ 'register.signIn' | translate }}</a>
        </p>
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

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['employee', Validators.required],
    });

    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const { name, email, password, role } = this.form.value as {
      name: string;
      email: string;
      password: string;
      role: string;
    };

    this.authService.register(name, email, password, role).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success(this.locale.t('register.toast.accountCreated'));
        this.router.navigate(['/dashboard']);
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.toast.error(err.error?.error ?? this.locale.t('register.toast.registrationFailed'));
      },
    });
  }
}
