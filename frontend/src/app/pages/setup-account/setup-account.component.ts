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

@Component({
  selector: 'app-setup-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page flex flex-col items-center justify-center min-h-screen">
      <div class="text-center mb-8 fade-in">
        <h1 class="text-3xl font-display font-bold tracking-tight text-white">
          Pro<span class="text-accent">Track</span>
        </h1>
        <p class="text-xs text-text-muted mt-1 font-medium tracking-wide">Team Performance Tracking</p>
      </div>

      <div class="auth-card w-full max-w-[440px] bg-bg-elevated border border-border rounded-xl p-8 shadow-modal relative overflow-hidden slide-up">
        @if (loading()) {
          <div class="py-10 text-center text-sm text-text-secondary">Checking your invite link…</div>
        } @else if (invalid()) {
          <div class="text-center py-6">
            <h2 class="text-xl font-bold text-white mb-2">Link expired or invalid</h2>
            <p class="text-sm text-text-secondary mb-6">Ask your admin to send you a new setup link.</p>
            <a routerLink="/login" class="btn-accent inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white">Go to login</a>
          </div>
        } @else {
          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-2 tracking-tight">Activate your account</h2>
            <p class="text-sm text-text-secondary leading-relaxed">
              Welcome, <strong class="text-white">{{ employeeName() }}</strong>.
              Choose a password to finish setup.
            </p>
          </div>

          @if (error()) {
            <div class="mb-4 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs font-medium">
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-5">
            <div class="flex flex-col gap-2">
              <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Email</label>
              <input
                type="email"
                [value]="email()"
                readonly
                class="w-full bg-bg-base/60 border border-border text-text-secondary text-sm rounded-lg px-4 py-2.5 outline-none"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label for="password" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Password</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                placeholder="Min. 8 characters"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none focus:border-accent"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label for="confirmPassword" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                formControlName="confirmPassword"
                placeholder="Repeat password"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none focus:border-accent"
              />
              @if (form.errors?.['passwordMismatch'] && form.get('confirmPassword')?.touched) {
                <span class="text-danger text-[11px]">Passwords do not match</span>
              }
            </div>
            <button
              type="submit"
              class="btn-accent w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              [disabled]="submitting() || form.invalid"
            >
              {{ submitting() ? 'Saving…' : 'Activate & sign in' }}
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
  error = signal('');

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
    this.error.set('');
    const password = this.form.get('password')?.value as string;

    this.auth.completeSetupAccount(this.token(), this.email(), password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.error || 'Could not activate account.');
      },
    });
  }
}
