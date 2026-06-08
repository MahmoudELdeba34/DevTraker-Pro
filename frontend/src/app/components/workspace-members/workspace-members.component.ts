import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WorkspaceService,
  WorkspaceMember,
  WorkspaceRole,
} from '../../services/workspace.service';
import { OnboardingService } from '../../services/onboarding.service';
import { AuthService } from '../../services/auth.service';
import { Workspace } from '../../models/types';
import { User } from '../../models/types';
import {
  ConfirmDialogComponent,
  ConfirmVariant,
} from '../ui/confirm-dialog/confirm-dialog.component';
import { FlashBannerComponent } from '../ui/flash-banner/flash-banner.component';
import { CredentialsBannerComponent } from '../ui/credentials-banner/credentials-banner.component';
import { OnboardingCredentialsResult } from '../../services/onboarding.service';

type ConfirmKind = 'remove' | 'role';

interface PendingAction {
  kind: ConfirmKind;
  member: WorkspaceMember;
  newRole?: WorkspaceRole;
}

@Component({
  selector: 'app-workspace-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent, FlashBannerComponent, CredentialsBannerComponent],
  templateUrl: './workspace-members.component.html',
  styleUrls: ['./workspace-members.component.css'],
})
export class WorkspaceMembersComponent implements OnInit {
  private workspaceSvc = inject(WorkspaceService);
  private onboardingSvc = inject(OnboardingService);
  private authSvc = inject(AuthService);

  @Input({ required: true }) workspace!: Workspace;
  @Output() closed = new EventEmitter<void>();

  members = signal<WorkspaceMember[]>([]);
  loading = signal(true);
  flash = signal<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Invite form
  inviteEmail = signal('');
  inviteRole = signal<WorkspaceRole>('member');
  inviteGlobalRole = signal<User['role']>('employee');
  inviting = signal(false);
  lastInvite = signal<OnboardingCredentialsResult | null>(null);

  // Confirmation
  pending = signal<PendingAction | null>(null);

  confirmDialogMeta = computed(() => {
    const p = this.pending();
    if (!p) return null;
    if (p.kind === 'remove') {
      return {
        title:
          p.member._id === this.myUserId()
            ? 'Leave workspace?'
            : 'Remove member?',
        message:
          p.member._id === this.myUserId()
            ? `You'll lose access to projects and tasks in ${this.workspace.name}.`
            : `${p.member.name} will lose access to projects and tasks in this workspace.`,
        confirmLabel: 'Yes, remove',
        variant: 'danger' as ConfirmVariant,
      };
    }
    return {
      title: 'Change role?',
      message: `${p.member.name} will become ${p.newRole} in this workspace.`,
      confirmLabel: 'Update role',
      variant: 'accent' as ConfirmVariant,
    };
  });

  // ─── Permissions ──────────────────────────────────────────────────────────
  myUserId = computed(() => this.authSvc.currentUser()?._id || '');
  myGlobalRole = computed(() => this.authSvc.currentUser()?.role || '');

  isWorkspaceOwner = computed(() => {
    const me = this.myUserId();
    const ws: any = this.workspace;
    const ownerId =
      typeof ws.ownerId === 'string' ? ws.ownerId : ws.ownerId?._id;
    return !!me && !!ownerId && me === ownerId;
  });

  myWorkspaceRole = computed<WorkspaceRole | 'owner' | null>(() => {
    if (this.isWorkspaceOwner()) return 'owner';
    const me = this.members().find((m) => m._id === this.myUserId());
    return me ? me.workspaceRole : null;
  });

  canManage = computed(() => {
    if (this.myGlobalRole() === 'admin') return true;
    const role = this.myWorkspaceRole();
    return role === 'owner' || role === 'admin';
  });

  canOnboardEmployees = computed(() =>
    ['admin', 'hr'].includes(this.myGlobalRole())
  );

  canInvite = computed(() => this.canManage() || this.canOnboardEmployees());

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.workspaceSvc.getMembers(this.workspace._id).subscribe({
      next: (list) => {
        this.members.set(list || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.flashMsg('err', "Couldn't load members");
      },
    });
  }

  // ─── Invite ───────────────────────────────────────────────────────────────
  submitInvite(): void {
    const email = this.inviteEmail().trim().toLowerCase();
    if (!email || !email.includes('@')) {
      this.flashMsg('err', 'Enter a valid email');
      return;
    }
    if (this.members().some((m) => m.email.toLowerCase() === email)) {
      this.flashMsg('err', 'This user is already a member');
      return;
    }

    this.inviting.set(true);
    this.onboardingSvc
      .onboardEmployee(this.workspace._id, {
        email,
        role: this.inviteRole(),
        globalRole: this.canOnboardEmployees() ? this.inviteGlobalRole() : undefined,
      })
      .subscribe({
        next: (res) => {
          this.inviting.set(false);
          this.inviteEmail.set('');

          if (res.newAccount && res.emailSent) {
            this.flashMsg('ok', `Account created — credentials emailed to ${email}`);
          } else if (res.newAccount && (res.setupLink || res.tempPassword)) {
            this.lastInvite.set(res);
            this.flashMsg('ok', `Account created — copy credentials below for ${email}`);
          } else {
            this.flashMsg('ok', `Added ${res.invitedUser?.name || email}`);
          }
          this.refresh();
        },
        error: (err) => {
          this.inviting.set(false);
          this.flashMsg(
            'err',
            err?.error?.error || 'Could not add this user'
          );
        },
      });
  }

  // ─── Role / Remove confirmations ──────────────────────────────────────────
  promptChangeRole(member: WorkspaceMember, newRole: WorkspaceRole): void {
    if (member.workspaceRole === newRole || member.isOwner) return;
    this.pending.set({ kind: 'role', member, newRole });
  }

  promptRemove(member: WorkspaceMember): void {
    if (member.isOwner) return;
    this.pending.set({ kind: 'remove', member });
  }

  cancelPending(): void {
    this.pending.set(null);
  }

  confirmPending(): void {
    const p = this.pending();
    if (!p) return;

    if (p.kind === 'role' && p.newRole) {
      this.workspaceSvc
        .changeMemberRole(this.workspace._id, p.member._id, p.newRole)
        .subscribe({
          next: () => {
            this.pending.set(null);
            this.flashMsg('ok', `${p.member.name}'s role updated`);
            this.refresh();
          },
          error: (e) => {
            this.pending.set(null);
            this.flashMsg('err', e?.error?.error || 'Failed to update role');
          },
        });
    } else if (p.kind === 'remove') {
      this.workspaceSvc.removeMember(this.workspace._id, p.member._id).subscribe({
        next: () => {
          this.pending.set(null);
          this.flashMsg('ok', `${p.member.name} removed`);
          this.refresh();
        },
        error: (e) => {
          this.pending.set(null);
          this.flashMsg('err', e?.error?.error || 'Failed to remove');
        },
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  close(): void {
    this.closed.emit();
  }

  initials(name: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  roleChipClass(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-accent-subtle text-accent border-accent/30';
      case 'member':
        return 'bg-info/15 text-info border-info/30';
      case 'viewer':
        return 'bg-warning/15 text-warning border-warning/30';
      default:
        return 'bg-bg-elevated text-text-muted border-border';
    }
  }

  private flashMsg(type: 'ok' | 'err', text: string): void {
    this.flash.set({ type, text });
    setTimeout(() => this.flash.set(null), 3500);
  }

  trackById = (_: number, m: WorkspaceMember) => m._id;
}
