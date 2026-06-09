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
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

type AccountTab = 'profile' | 'security';

@Component({
  selector: 'app-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css'],
})
export class AccountComponent implements OnInit {
  private authSvc = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  activeTab = signal<AccountTab>('profile');
  loading = signal(true);
  saving = signal(false);

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
  roleLabel = () => this.locale.roleLabel(this.userRole());

  ngOnInit(): void {
    this.loadProfile();
  }

  setTab(tab: AccountTab): void {
    this.activeTab.set(tab);
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
    const name = this.profileForm.get('name')?.value as string;
    this.authSvc.updateProfile(name.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.locale.t('account.toast.profileUpdated'));
      },
      error: () => {
        this.saving.set(false);
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
      this.toast.warning(this.locale.t('account.toast.passwordsMismatch'));
      return;
    }

    this.saving.set(true);
    this.authSvc.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.passwordForm.reset();
        this.toast.success(this.locale.t('account.toast.passwordChanged'));
        setTimeout(() => this.authSvc.logout(), 1200);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
