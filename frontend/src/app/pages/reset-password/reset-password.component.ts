import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-reset-password',
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
        <div class="mb-8 flex items-start gap-4">
          <div class="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white mb-2 tracking-tight">Set new password</h2>
            <p class="text-sm text-text-secondary leading-relaxed">Please enter a unique password to secure your team account.</p>
          </div>
        </div>

        @if (successMessage()) {
          <div class="alert mb-6 flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            {{ successMessage() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <label for="password" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">New Password</label>
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
                placeholder="Min. 8 characters"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50 tracking-wide"
                [class.border-danger]="form.get('password')?.invalid && form.get('password')?.touched"
              />
            </div>
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <span class="text-danger text-[11px] mt-1 font-medium">Password must be at least 8 characters</span>
            }
          </div>

          <div class="flex flex-col gap-2">
            <label for="confirmPassword" class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Confirm Password</label>
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
                placeholder="Repeat your password"
                class="w-full bg-bg-base border border-border text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50 tracking-wide"
                [class.border-danger]="(form.get('confirmPassword')?.invalid || form.errors?.['passwordMismatch']) && form.get('confirmPassword')?.touched"
              />
            </div>
            @if ((form.get('confirmPassword')?.invalid || form.errors?.['passwordMismatch']) && form.get('confirmPassword')?.touched) {
              <span class="text-danger text-[11px] mt-1 font-medium">Passwords must match</span>
            }
          </div>

          <button
            type="submit"
            class="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]"
            [disabled]="loading() || successMessage() !== ''"
          >
            @if (loading()) {
              <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Resetting...
            } @else {
              Reset password
            }
          </button>
        </form>

        <div class="mt-6 text-center">
          <a routerLink="/login" class="text-xs font-medium text-text-secondary hover:text-white transition-colors inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to login
          </a>
        </div>
      </div>
    </div>
  `
})
export class ResetPasswordComponent {
  form: FormGroup;
  loading = signal(false);
  successMessage = signal('');

  constructor(private fb: FormBuilder, private router: Router) {
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
    // Simulate API call
    setTimeout(() => {
      this.loading.set(false);
      this.successMessage.set('Password reset successfully! Redirecting...');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    }, 1500);
  }
}

