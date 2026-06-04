import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <h1>DevTracker Pro</h1>
          <p>Create your account and start tracking</p>
        </div>

        @if (error()) {
          <div class="alert alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {{ error() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="name">Full name</label>
            <input
              id="name"
              type="text"
              formControlName="name"
              placeholder="John Doe"
              [class.invalid]="form.get('name')?.invalid && form.get('name')?.touched"
            />
            @if (form.get('name')?.invalid && form.get('name')?.touched) {
              <span class="field-error">Name is required</span>
            }
          </div>

          <div class="form-group">
            <label for="email">Email address</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="you@example.com"
              [class.invalid]="form.get('email')?.invalid && form.get('email')?.touched"
            />
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <span class="field-error">Please enter a valid email</span>
            }
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Min. 6 characters"
              [class.invalid]="form.get('password')?.invalid && form.get('password')?.touched"
            />
            @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
              <span class="field-error">Password is required</span>
            }
            @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
              <span class="field-error">Password must be at least 6 characters</span>
            }
          </div>

          <button
            type="submit"
            class="btn-primary btn-full"
            [disabled]="loading()"
          >
            @if (loading()) {
              <span class="spinner"></span> Creating account...
            } @else {
              Create Account
            }
          </button>
        </form>

        <p class="auth-footer">
          Already have an account?
          <a routerLink="/login">Sign in</a>
        </p>
      </div>
    </div>
  `,
})
export class RegisterComponent implements OnInit {
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
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
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

    const { name, email, password } = this.form.value as {
      name: string;
      email: string;
      password: string;
    };

    this.authService.register(name, email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: { error?: { error?: string } }) => {
        this.loading.set(false);
        this.error.set(
          err.error?.error ?? 'Registration failed. Please try again.'
        );
      },
    });
  }
}
