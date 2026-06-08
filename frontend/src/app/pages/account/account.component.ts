import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { FlashBannerComponent } from '../../components/ui/flash-banner/flash-banner.component';

type AccountTab = 'profile' | 'security';

@Component({
  selector: 'app-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FlashBannerComponent],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css'],
})
export class AccountComponent implements OnInit {
  private authSvc = inject(AuthService);
  private fb = inject(FormBuilder);

  activeTab = signal<AccountTab>('profile');
  loading = signal(true);
  saving = signal(false);
  flash = signal<{ type: 'ok' | 'err'; text: string } | null>(null);

  profileForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    email: [{ value: '', disabled: true }],
  });

  passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });

  userName = () => this.authSvc.currentUser()?.name ?? '';
  userRole = () => this.authSvc.currentUser()?.role ?? '';
  userEmail = () => this.authSvc.currentUser()?.email ?? '';
  userInitial = () => (this.userName() || '?').substring(0, 2).toUpperCase();

  ngOnInit(): void {
    this.loadProfile();
  }

  setTab(tab: AccountTab): void {
    this.activeTab.set(tab);
    this.flash.set(null);
  }

  loadProfile(): void {
    this.loading.set(true);
    this.authSvc.getMe().subscribe({
      next: (res) => {
        const user = res.data?.user;
        if (user) {
          this.authSvc.updateLocalUser(user);
          this.profileForm.patchValue({ name: user.name, email: user.email });
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.profileForm.patchValue({
          name: this.userName(),
          email: this.userEmail(),
        });
      },
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.flash.set(null);
    const name = this.profileForm.get('name')?.value as string;
    this.authSvc.updateProfile(name.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.flash.set({ type: 'ok', text: 'Profile updated successfully.' });
      },
      error: (err) => {
        this.saving.set(false);
        this.flash.set({ type: 'err', text: err?.error?.error || 'Failed to update profile.' });
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;
    if (newPassword !== confirmPassword) {
      this.flash.set({ type: 'err', text: 'New passwords do not match.' });
      return;
    }

    this.saving.set(true);
    this.flash.set(null);
    this.authSvc.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.passwordForm.reset();
        this.flash.set({ type: 'ok', text: 'Password changed. Signing you out…' });
        setTimeout(() => this.authSvc.logout(), 1200);
      },
      error: (err) => {
        this.saving.set(false);
        this.flash.set({ type: 'err', text: err?.error?.error || 'Failed to change password.' });
      },
    });
  }
}
