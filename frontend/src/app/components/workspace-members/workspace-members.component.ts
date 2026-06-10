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
import { CredentialsBannerComponent } from '../ui/credentials-banner/credentials-banner.component';
import {
  InviteMemberDialogComponent,
  InviteMemberForm,
} from '../ui/invite-member-dialog/invite-member-dialog.component';
import { ToastService } from '../../services/toast.service';
import { OnboardingCredentialsResult } from '../../services/onboarding.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

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
  imports: [
    CommonModule,
    FormsModule,
    ConfirmDialogComponent,
    CredentialsBannerComponent,
    InviteMemberDialogComponent,
    TranslatePipe,
  ],
  templateUrl: './workspace-members.component.html',
  styleUrls: ['./workspace-members.component.css'],
})
export class WorkspaceMembersComponent implements OnInit {
  private workspaceSvc = inject(WorkspaceService);
  private onboardingSvc = inject(OnboardingService);
  private authSvc = inject(AuthService);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  @Input({ required: true }) workspace!: Workspace;
  @Output() closed = new EventEmitter<void>();

  members = signal<WorkspaceMember[]>([]);
  loading = signal(true);

  inviteDialogOpen = signal(false);
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
            ? this.locale.t('common.leaveWorkspaceTitle')
            : this.locale.t('common.removeMemberTitle'),
        message:
          p.member._id === this.myUserId()
            ? this.locale.t('common.leaveWorkspaceMessage', { workspaceName: this.workspace.name })
            : this.locale.t('common.removeMemberMessage', { name: p.member.name }),
        confirmLabel: this.locale.t('common.yesRemove'),
        variant: 'danger' as ConfirmVariant,
      };
    }
    return {
      title: this.locale.t('workspaceMembers.changeRole'),
      message: this.locale.t('workspaceMembers.changeRoleMessage', {
        name: p.member.name,
        newRole: this.workspaceRoleLabel(p.newRole!),
      }),
      confirmLabel: this.locale.t('common.updateRole'),
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
      },
    });
  }

  // ─── Invite ───────────────────────────────────────────────────────────────
  openInviteDialog(): void {
    this.inviteDialogOpen.set(true);
  }

  closeInviteDialog(): void {
    if (!this.inviting()) {
      this.inviteDialogOpen.set(false);
    }
  }

  submitInvite(form: InviteMemberForm): void {
    const email = form.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      this.flashMsg('err', this.locale.t('members.toast.invalidEmail'));
      return;
    }
    if (this.members().some((m) => m.email.toLowerCase() === email)) {
      this.flashMsg('err', this.locale.t('members.toast.alreadyMember'));
      return;
    }

    this.inviting.set(true);
    this.onboardingSvc
      .onboardEmployee(this.workspace._id, {
        email,
        name: this.canOnboardEmployees() ? form.name : undefined,
        role: form.workspaceRole,
        globalRole: this.canOnboardEmployees() ? form.globalRole : undefined,
      })
      .subscribe({
        next: (res) => {
          this.inviting.set(false);
          this.inviteDialogOpen.set(false);

          if (res.newAccount && !res.emailSent && (res.setupLink || res.tempPassword)) {
            this.lastInvite.set(res);
          } else {
            this.lastInvite.set(null);
          }

          if (res.newAccount && res.emailSent) {
            this.flashMsg('ok', this.locale.t('members.toast.accountEmailed', { email }));
          } else if (res.newAccount) {
            this.flashMsg('ok', this.locale.t('members.toast.accountCopyLink', { email }));
          } else {
            this.flashMsg('ok', this.locale.t('members.toast.addedToWorkspace', { name: res.invitedUser?.name || email }));
          }
          this.refresh();
        },
        error: () => {
          this.inviting.set(false);
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
            this.flashMsg('ok', this.locale.t('members.toast.roleUpdated', { name: p.member.name }));
            this.refresh();
          },
          error: () => {
            this.pending.set(null);
          },
        });
    } else if (p.kind === 'remove') {
      this.workspaceSvc.removeMember(this.workspace._id, p.member._id).subscribe({
        next: () => {
          this.pending.set(null);
          this.flashMsg('ok', this.locale.t('members.toast.memberRemoved', { name: p.member.name }));
          this.refresh();
        },
        error: () => {
          this.pending.set(null);
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
    if (type === 'ok') this.toast.success(text);
    else this.toast.error(text);
  }

  workspaceRoleLabel(role: string): string {
    const key = `role.workspace.${role}`;
    const translated = this.locale.t(key);
    return translated !== key ? translated : role;
  }

  youRoleLabel(role: string): string {
    return this.locale.t('common.youRole', { role: this.workspaceRoleLabel(role) });
  }

  memberWord(count: number): string {
    return count === 1 ? this.locale.t('common.member') : this.locale.t('common.members');
  }

  trackById = (_: number, m: WorkspaceMember) => m._id;
}
