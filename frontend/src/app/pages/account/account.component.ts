import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { UserAvatarComponent } from '../../components/ui/user-avatar/user-avatar.component';

type AccountTab = 'profile' | 'security';

const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TranslatePipe, UserAvatarComponent],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css'],
})
export class AccountComponent implements OnInit {
  @ViewChild('avatarFileInput') avatarFileInput?: ElementRef<HTMLInputElement>;

  private authSvc = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  readonly avatarAccept = AVATAR_ACCEPT;

  activeTab = signal<AccountTab>('profile');
  loading = signal(true);
  saving = signal(false);
  avatarSaving = signal(false);
  faceEnrolled = signal(false);
  facePhotoUrl = signal<string | null>(null);
  faceEnrolledAt = signal<string | null>(null);
  faceSaving = signal(false);

  profileForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    email: [{ value: '', disabled: true }],
  });

  avatarUrlForm: FormGroup = this.fb.group({
    avatarUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
  });

  passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });

  userName = () => this.authSvc.currentUser()?.name ?? '';
  userRole = () => this.authSvc.currentUser()?.role ?? '';
  userEmail = () => this.authSvc.currentUser()?.email ?? '';
  userAvatarUrl = () => this.authSvc.currentUser()?.avatarUrl;
  roleLabel = () => this.locale.roleLabel(this.userRole());
  hasAvatar = () => !!this.userAvatarUrl();

  ngOnInit(): void {
    this.loadProfile();
    this.loadFaceStatus();
  }

  formatEnrolledDate(): string {
    const at = this.faceEnrolledAt();
    if (!at) return '';
    return new Date(at).toLocaleDateString(this.locale.dateLocale(), { dateStyle: 'medium' });
  }

  facePhotoFullUrl(): string | null {
    const url = this.facePhotoUrl();
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${base}${url}`;
  }

  loadFaceStatus(): void {
    this.authSvc.getFaceStatus().subscribe({
      next: (res) => {
        if (res.success) {
          this.faceEnrolled.set(res.data.enrolled);
          this.facePhotoUrl.set(res.data.facePhotoUrl);
          this.faceEnrolledAt.set(res.data.enrolledAt);
        }
      },
    });
  }

  removeFaceProfile(): void {
    this.faceSaving.set(true);
    this.authSvc.removeFaceProfile().subscribe({
      next: () => {
        this.faceSaving.set(false);
        this.faceEnrolled.set(false);
        this.facePhotoUrl.set(null);
        this.faceEnrolledAt.set(null);
        this.toast.success(this.locale.t('account.face.removed'));
      },
      error: () => this.faceSaving.set(false),
    });
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
          this.avatarUrlForm.patchValue({ avatarUrl: user.avatarUrl ?? '' });
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.profileForm.patchValue({
          name: this.userName(),
          email: this.userEmail(),
        });
        this.avatarUrlForm.patchValue({ avatarUrl: this.userAvatarUrl() ?? '' });
      },
    });
  }

  triggerAvatarUpload(): void {
    this.avatarFileInput?.nativeElement.click();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.warning(this.locale.t('account.avatar.invalidType'));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      this.toast.warning(this.locale.t('account.avatar.tooLarge'));
      return;
    }

    this.avatarSaving.set(true);
    this.authSvc.uploadAvatar(file).subscribe({
      next: () => {
        this.avatarSaving.set(false);
        this.avatarUrlForm.patchValue({ avatarUrl: this.userAvatarUrl() ?? '' });
        this.toast.success(this.locale.t('account.avatar.uploaded'));
      },
      error: () => {
        this.avatarSaving.set(false);
      },
    });
  }

  saveAvatarUrl(): void {
    if (this.avatarUrlForm.invalid) {
      this.avatarUrlForm.markAllAsTouched();
      return;
    }

    const avatarUrl = (this.avatarUrlForm.get('avatarUrl')?.value as string).trim();
    this.avatarSaving.set(true);
    this.authSvc.setAvatarUrl(avatarUrl).subscribe({
      next: () => {
        this.avatarSaving.set(false);
        this.toast.success(this.locale.t('account.avatar.urlSaved'));
      },
      error: () => {
        this.avatarSaving.set(false);
      },
    });
  }

  removeAvatar(): void {
    this.avatarSaving.set(true);
    this.authSvc.removeAvatar().subscribe({
      next: () => {
        this.avatarSaving.set(false);
        this.avatarUrlForm.patchValue({ avatarUrl: '' });
        this.toast.success(this.locale.t('account.avatar.removed'));
      },
      error: () => {
        this.avatarSaving.set(false);
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
