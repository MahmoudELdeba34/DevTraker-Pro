import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  WorkspaceService,
  WorkspaceMember,
  WorkspaceRole,
} from '../../services/workspace.service';
import {
  OnboardingService,
  OnboardingCredentialsResult,
} from '../../services/onboarding.service';
import { AuthService } from '../../services/auth.service';
import { ActivityService } from '../../services/activity.service';
import { User } from '../../models/types';
import {
  ConfirmDialogComponent,
  ConfirmVariant,
} from '../../components/ui/confirm-dialog/confirm-dialog.component';
import { CredentialsBannerComponent } from '../../components/ui/credentials-banner/credentials-banner.component';
import {
  InviteMemberDialogComponent,
  InviteMemberForm,
} from '../../components/ui/invite-member-dialog/invite-member-dialog.component';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

type FilterRole = 'all' | WorkspaceRole | 'owner';

interface PendingAction {
  kind: 'remove' | 'role' | 'send-credentials' | 'stop-tracking';
  member: WorkspaceMember;
  newRole?: WorkspaceRole;
}

@Component({
  selector: 'app-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ConfirmDialogComponent,
    CredentialsBannerComponent,
    InviteMemberDialogComponent,
    TranslatePipe,
  ],
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.css'],
})
export class MembersComponent {
  workspaceSvc = inject(WorkspaceService);
  private onboardingSvc = inject(OnboardingService);
  private activitySvc = inject(ActivityService);
  private authSvc = inject(AuthService);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  members = signal<WorkspaceMember[]>([]);
  loading = signal(false);

  // Filters
  search = signal('');
  filterRole = signal<FilterRole>('all');

  inviteDialogOpen = signal(false);
  inviting = signal(false);

  // Add existing user to workspace
  addExistingSearch = signal('');
  addExistingRole = signal<WorkspaceRole>('member');
  availableUsers = signal<User[]>([]);
  searchingUsers = signal(false);
  addingExistingId = signal<string | null>(null);

  // Last successful invite — used to surface temp credentials when SMTP isn't
  // configured (dev fallback). Cleared by the admin once they've copied them.
  lastInvite = signal<OnboardingCredentialsResult | null>(null);
  sendingCredentials = signal<string | null>(null);
  passwordCopied = signal(false);
  linkCopied = signal(false);
  messageCopied = signal(false);
  stoppingTimerId = signal<string | null>(null);

  // Confirmation
  pending = signal<PendingAction | null>(null);

  confirmDialogMeta = computed(() => {
    const p = this.pending();
    if (!p) return null;
    if (p.kind === 'remove') {
      const wsName = this.activeWs()?.name || this.locale.t('common.thisWorkspace');
      return {
        title:
          p.member._id === this.myUserId()
            ? this.locale.t('members.confirm.leaveTitle')
            : this.locale.t('members.confirm.removeTitle'),
        message:
          p.member._id === this.myUserId()
            ? this.locale.t('members.confirm.leaveMessage', { workspaceName: wsName })
            : this.locale.t('members.confirm.removeMessage', { name: p.member.name }),
        confirmLabel: this.locale.t('members.confirm.yesRemove'),
        variant: 'danger' as ConfirmVariant,
      };
    }
    if (p.kind === 'send-credentials') {
      return {
        title: this.locale.t('members.confirm.sendCredentialsTitle'),
        message: this.locale.t('members.confirm.sendCredentialsMessage', { name: p.member.name }),
        confirmLabel: this.locale.t('members.confirm.sendCredentials'),
        variant: 'accent' as ConfirmVariant,
      };
    }
    if (p.kind === 'stop-tracking') {
      return {
        title: this.locale.t('members.confirm.stopTimerTitle', { name: p.member.name }),
        message: this.locale.t('members.confirm.stopTimerMessage', {
          label: p.member.tracking?.label || this.locale.t('shell.quickSession'),
        }),
        confirmLabel: this.locale.t('members.confirm.stopTimer'),
        variant: 'danger' as ConfirmVariant,
      };
    }
    return {
      title: this.locale.t('members.confirm.changeRoleTitle'),
      message: this.locale.t('members.confirm.changeRoleMessage', {
        name: p.member.name,
        newRole: this.workspaceRoleLabel(p.newRole!),
      }),
      confirmLabel: this.locale.t('members.confirm.updateRole'),
      variant: 'accent' as ConfirmVariant,
    };
  });

  filterOptions = computed(() => [
    { id: 'all' as FilterRole, label: this.locale.t('common.all') },
    { id: 'owner' as FilterRole, label: this.locale.t('members.filter.owner') },
    { id: 'admin' as FilterRole, label: this.locale.t('common.admins') },
    { id: 'member' as FilterRole, label: this.locale.t('members.stat.members') },
    { id: 'viewer' as FilterRole, label: this.locale.t('members.stat.viewers') },
  ]);

  membersDescription = computed(() =>
    this.locale.t('members.description', {
      workspaceName: this.activeWs()?.name || this.locale.t('common.thisWorkspace'),
    })
  );

  // ─── Identity / permissions ────────────────────────────────────────────
  myUserId = computed(() => this.authSvc.currentUser()?._id || '');
  myGlobalRole = computed(() => this.authSvc.currentUser()?.role || '');
  activeWs = computed(() => this.workspaceSvc.activeWorkspace());

  isWorkspaceOwner = computed(() => {
    const ws: any = this.activeWs();
    if (!ws) return false;
    const ownerId =
      typeof ws.ownerId === 'string' ? ws.ownerId : ws.ownerId?._id;
    return this.myUserId() === ownerId;
  });

  myWorkspaceRole = computed<WorkspaceRole | 'owner' | null>(() => {
    if (this.isWorkspaceOwner()) return 'owner';
    const me = this.members().find((m) => m._id === this.myUserId());
    return me ? me.workspaceRole : null;
  });

  canManage = computed(() => {
    if (this.myGlobalRole() === 'admin') return true;
    const r = this.myWorkspaceRole();
    return r === 'owner' || r === 'admin';
  });

  /** Can create brand-new system accounts and email credentials. */
  canOnboardEmployees = computed(() =>
    ['admin', 'hr'].includes(this.myGlobalRole())
  );

  canInvite = computed(() => this.canManage() || this.canOnboardEmployees());

  // ─── Derived data ──────────────────────────────────────────────────────
  filteredMembers = computed(() => {
    const q = this.search().trim().toLowerCase();
    const role = this.filterRole();
    return this.members().filter((m) => {
      if (role !== 'all') {
        if (role === 'owner' && !m.isOwner) return false;
        if (role !== 'owner' && (m.isOwner || m.workspaceRole !== role))
          return false;
      }
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      );
    });
  });

  stats = computed(() => {
    const all = this.members();
    return {
      total: all.length,
      admins: all.filter((m) => m.workspaceRole === 'admin' || m.isOwner).length,
      members: all.filter((m) => m.workspaceRole === 'member' && !m.isOwner)
        .length,
      viewers: all.filter((m) => m.workspaceRole === 'viewer' && !m.isOwner)
        .length,
    };
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────
  constructor() {
    // Re-load whenever the active workspace changes
    effect(
      () => {
        const ws = this.activeWs();
        if (ws) this.loadMembers(ws._id);
        else this.members.set([]);
      },
      { allowSignalWrites: true }
    );
  }

  loadMembers(workspaceId: string): void {
    this.loading.set(true);
    this.workspaceSvc.getMembers(workspaceId).subscribe({
      next: (list) => {
        this.members.set(list || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  // ─── Invite ────────────────────────────────────────────────────────────
  openInviteDialog(): void {
    this.inviteDialogOpen.set(true);
  }

  closeInviteDialog(): void {
    if (!this.inviting()) {
      this.inviteDialogOpen.set(false);
    }
  }

  submitInvite(form: InviteMemberForm): void {
    const ws = this.activeWs();
    if (!ws) return;
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
      .onboardEmployee(ws._id, {
        email,
        name: this.canOnboardEmployees() ? form.name : undefined,
        role: form.workspaceRole,
        globalRole: this.canOnboardEmployees() ? form.globalRole : undefined,
      })
      .subscribe({
        next: (res) => {
          this.inviting.set(false);
          this.inviteDialogOpen.set(false);
          this.passwordCopied.set(false);

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
            this.flashMsg(
              'ok',
              this.locale.t('members.toast.addedToWorkspace', {
                name: res.invitedUser?.name || email,
              })
            );
          }
          this.loadMembers(ws._id);
        },
        error: () => {
          this.inviting.set(false);
        },
      });
  }

  dismissLastInvite(): void {
    this.lastInvite.set(null);
    this.passwordCopied.set(false);
    this.linkCopied.set(false);
    this.messageCopied.set(false);
  }

  searchExistingUsers(): void {
    const ws = this.activeWs();
    if (!ws || !this.canManage()) return;
    this.searchingUsers.set(true);
    this.workspaceSvc.searchAvailableMembers(ws._id, this.addExistingSearch()).subscribe({
      next: (users) => {
        this.availableUsers.set(users || []);
        this.searchingUsers.set(false);
      },
      error: () => {
        this.availableUsers.set([]);
        this.searchingUsers.set(false);
      },
    });
  }

  addExistingUser(user: User): void {
    const ws = this.activeWs();
    if (!ws || this.addingExistingId()) return;
    this.addingExistingId.set(user._id);
    this.workspaceSvc.addMember(ws._id, user._id, this.addExistingRole()).subscribe({
      next: () => {
        this.addingExistingId.set(null);
        this.flashMsg('ok', this.locale.t('members.toast.userAdded', { name: user.name, workspaceName: ws.name }));
        this.availableUsers.update((list) => list.filter((u) => u._id !== user._id));
        this.loadMembers(ws._id);
      },
      error: () => {
        this.addingExistingId.set(null);
      },
    });
  }

  private async copyText(text: string, flag: 'password' | 'link' | 'message'): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (flag === 'password') this.passwordCopied.set(true);
      if (flag === 'link') this.linkCopied.set(true);
      if (flag === 'message') this.messageCopied.set(true);
      setTimeout(() => {
        this.passwordCopied.set(false);
        this.linkCopied.set(false);
        this.messageCopied.set(false);
      }, 2200);
    } catch {
      // ignore
    }
  }

  copyTempPassword(): void {
    void this.copyText(this.lastInvite()?.tempPassword || '', 'password');
  }

  copySetupLink(): void {
    void this.copyText(this.lastInvite()?.setupLink || '', 'link');
  }

  copyShareMessage(): void {
    void this.copyText(this.lastInvite()?.shareMessage || '', 'message');
  }

  promptSendCredentials(member: WorkspaceMember): void {
    if (member.isOwner || member._id === this.myUserId()) return;
    this.pending.set({ kind: 'send-credentials', member });
  }

  // ─── Role / remove ─────────────────────────────────────────────────────
  promptChangeRole(member: WorkspaceMember, newRole: WorkspaceRole): void {
    if (member.isOwner || member.workspaceRole === newRole) return;
    this.pending.set({ kind: 'role', member, newRole });
  }

  promptRemove(member: WorkspaceMember): void {
    if (member.isOwner) return;
    this.pending.set({ kind: 'remove', member });
  }

  promptStopTracking(member: WorkspaceMember): void {
    if (!member.tracking || member._id === this.myUserId() || !this.canManage()) return;
    this.pending.set({ kind: 'stop-tracking', member });
  }

  cancelPending(): void {
    this.pending.set(null);
  }

  confirmPending(): void {
    const ws = this.activeWs();
    const p = this.pending();
    if (!ws || !p) return;

    if (p.kind === 'role' && p.newRole) {
      this.workspaceSvc
        .changeMemberRole(ws._id, p.member._id, p.newRole)
        .subscribe({
          next: () => {
            this.pending.set(null);
            this.flashMsg('ok', this.locale.t('members.toast.roleUpdated', { name: p.member.name }));
            this.loadMembers(ws._id);
          },
          error: () => {
            this.pending.set(null);
          },
        });
    } else if (p.kind === 'send-credentials') {
      this.sendingCredentials.set(p.member._id);
      this.onboardingSvc.sendCredentials(ws._id, p.member._id).subscribe({
        next: (res) => {
          this.pending.set(null);
          this.sendingCredentials.set(null);
          this.passwordCopied.set(false);
          this.linkCopied.set(false);
          this.messageCopied.set(false);
          this.lastInvite.set(res);
          this.flashMsg(
            'ok',
            res.emailSent
              ? this.locale.t('members.toast.credentialsEmailed', { email: p.member.email })
              : this.locale.t('members.toast.credentialsReady', { name: p.member.name })
          );
        },
        error: () => {
          this.pending.set(null);
          this.sendingCredentials.set(null);
        },
      });
    } else if (p.kind === 'remove') {
      this.workspaceSvc.removeMember(ws._id, p.member._id).subscribe({
        next: () => {
          this.pending.set(null);
          this.flashMsg('ok', this.locale.t('members.toast.memberRemoved', { name: p.member.name }));
          if (p.member._id === this.myUserId()) {
            // I just removed myself — refresh the workspace list
            this.workspaceSvc.loadWorkspaces();
          } else {
            this.loadMembers(ws._id);
          }
        },
        error: () => {
          this.pending.set(null);
        },
      });
    } else if (p.kind === 'stop-tracking') {
      this.stoppingTimerId.set(p.member._id);
      this.activitySvc.stopUserTracking(p.member._id).subscribe({
        next: () => {
          this.pending.set(null);
          this.stoppingTimerId.set(null);
          this.flashMsg('ok', this.locale.t('members.toast.timerStopped', { name: p.member.name }));
          this.loadMembers(ws._id);
        },
        error: () => {
          this.pending.set(null);
          this.stoppingTimerId.set(null);
        },
      });
    }
  }

  showMemberActionsDash(member: WorkspaceMember): boolean {
    const canSend =
      this.canOnboardEmployees() &&
      !member.isOwner &&
      member._id !== this.myUserId();
    const canStop =
      this.canManage() &&
      !!member.tracking &&
      member._id !== this.myUserId();
    const canRemove =
      !member.isOwner &&
      (this.canManage() || member._id === this.myUserId());
    return !canSend && !canStop && !canRemove;
  }

  // ─── UI helpers ────────────────────────────────────────────────────────
  initials(name: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  workspaceInitials(): string {
    const ws = this.activeWs();
    return ws?.name?.substring(0, 2).toUpperCase() || 'WS';
  }

  roleChipClass(role: string): string {
    switch (role) {
      case 'owner':
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

  globalRoleClass(role: string): string {
    switch (role) {
      case 'admin':
        return 'text-danger';
      case 'manager':
        return 'text-warning';
      case 'hr':
        return 'text-info';
      case 'accountant':
        return 'text-success';
      default:
        return 'text-text-secondary';
    }
  }

  formatJoinDate(date?: string): string {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private flashMsg(type: 'ok' | 'err', text: string): void {
    if (type === 'ok') this.toast.success(text);
    else this.toast.error(text);
  }

  setFilter(role: FilterRole): void {
    this.filterRole.set(role);
  }

  workspaceRoleLabel(role: string): string {
    const key = `role.workspace.${role}` as const;
    const translated = this.locale.t(key);
    return translated !== key ? translated : role;
  }

  youRoleLabel(role: string): string {
    return this.locale.t('members.youRole', { role: this.workspaceRoleLabel(role) });
  }

  memberWord(count: number): string {
    return count === 1 ? this.locale.t('common.member') : this.locale.t('common.members');
  }

  trackById = (_: number, m: WorkspaceMember) => m._id;
}
