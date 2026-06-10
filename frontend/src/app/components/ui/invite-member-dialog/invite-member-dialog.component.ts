import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../models/types';
import { WorkspaceRole } from '../../../services/workspace.service';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export interface InviteMemberForm {
  name: string;
  email: string;
  globalRole: User['role'];
  workspaceRole: WorkspaceRole;
}

@Component({
  selector: 'app-invite-member-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './invite-member-dialog.component.html',
})
export class InviteMemberDialogComponent {
  locale = inject(LocaleService);

  open = input(false);
  loading = input(false);
  showName = input(true);
  showGlobalRole = input(true);

  submitted = output<InviteMemberForm>();
  cancelled = output<void>();

  name = signal('');
  email = signal('');
  globalRole = signal<User['role']>('employee');
  workspaceRole = signal<WorkspaceRole>('member');

  canSubmit = computed(() => {
    const email = this.email().trim().toLowerCase();
    if (!email.includes('@')) return false;
    if (this.showName() && !this.name().trim()) return false;
    return true;
  });

  constructor() {
    effect(
      () => {
        if (!this.open()) {
          this.name.set('');
          this.email.set('');
          this.globalRole.set('employee');
          this.workspaceRole.set('member');
        }
      },
      { allowSignalWrites: true }
    );
  }

  onBackdrop(): void {
    if (!this.loading()) this.onCancel();
  }

  onCancel(): void {
    if (this.loading()) return;
    this.cancelled.emit();
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.loading()) return;
    this.submitted.emit({
      name: this.name().trim(),
      email: this.email().trim().toLowerCase(),
      globalRole: this.globalRole(),
      workspaceRole: this.workspaceRole(),
    });
  }
}
