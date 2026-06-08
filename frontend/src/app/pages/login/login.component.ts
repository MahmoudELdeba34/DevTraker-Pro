import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
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

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page flex flex-col items-center justify-center min-h-screen">
      <!-- Logo Header Outside Card -->
      <div class="text-center mb-8 fade-in">
        <h1 class="text-3xl font-display font-bold tracking-tight text-white">
          Pro<span class="text-accent">Track</span>
        </h1>
        <p class="text-xs text-text-muted mt-1 font-medium tracking-wide">Team Performance Tracking</p>
      </div>

      <div class="auth-card w-full max-w-[440px] bg-bg-elevated border border-border rounded-xl p-8 shadow-modal relative overflow-hidden slide-up">
        <div class="mb-8">
          <h2 class="text-xl font-bold text-white mb-2 tracking-tight">Welcome back</h2>
          <p class="text-sm text-text-secondary">Please enter your details to sign in.</p>
        </div>

        @if (error()) {
          <div class="alert alert-error mb-6 flex items-center gap-3 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {{ error() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <label for="email" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Email Address</label>
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
                placeholder="name@company.com"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50"
                [class.border-danger]="form.get('email')?.invalid && form.get('email')?.touched"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label for="password" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Password</label>
              <a routerLink="/forgot-password" class="text-[11px] font-semibold text-warning hover:text-warning/80 transition-colors">Forgot password?</a>
            </div>
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
                placeholder="••••••••"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg pl-10 pr-10 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50 tracking-widest"
                [class.border-danger]="form.get('password')?.invalid && form.get('password')?.touched"
              />
              <button type="button" class="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 mt-1">
            <input type="checkbox" id="remember" class="rounded bg-bg-base border-border text-accent focus:ring-accent focus:ring-offset-bg-elevated w-4 h-4" />
            <label for="remember" class="text-xs text-text-secondary cursor-pointer select-none">Stay signed in for 30 days</label>
          </div>

          <button
            type="submit"
            class="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2.5 rounded-lg mt-2 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]"
            [disabled]="loading()"
          >
            @if (loading()) {
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            } @else {
              Login to Workspace
            }
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  form!: FormGroup;
  loading = signal(false);
  error = signal('');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
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
    this.error.set('');

    const { email, password } = this.form.value as {
      email: string;
      password: string;
    };

    this.authService.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'Login failed. Please try again.');
      },
    });
  }
}
