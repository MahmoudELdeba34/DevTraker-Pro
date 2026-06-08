import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
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
import { FlashBannerComponent } from '../../components/ui/flash-banner/flash-banner.component';
import { CredentialsBannerComponent } from '../../components/ui/credentials-banner/credentials-banner.component';

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
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialogComponent, FlashBannerComponent, CredentialsBannerComponent],
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.css'],
})
export class MembersComponent implements OnDestroy {
  workspaceSvc = inject(WorkspaceService);
  private onboardingSvc = inject(OnboardingService);
  private activitySvc = inject(ActivityService);
  private authSvc = inject(AuthService);

  members = signal<WorkspaceMember[]>([]);
  loading = signal(false);
  flash = signal<{ type: 'ok' | 'err'; text: string } | null>(null);
  private flashTimer?: ReturnType<typeof setTimeout>;

  // Filters
  search = signal('');
  filterRole = signal<FilterRole>('all');

  // Invite form
  inviteEmail = signal('');
  inviteRole = signal<WorkspaceRole>('member');
  inviteGlobalRole = signal<User['role']>('employee');
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
      const wsName = this.activeWs()?.name || 'this workspace';
      return {
        title:
          p.member._id === this.myUserId()
            ? 'Leave workspace?'
            : 'Remove member?',
        message:
          p.member._id === this.myUserId()
            ? `You'll lose access to projects and tasks in ${wsName}.`
            : `${p.member.name} will lose access to projects and tasks in this workspace.`,
        confirmLabel: 'Yes, remove',
        variant: 'danger' as ConfirmVariant,
      };
    }
    if (p.kind === 'send-credentials') {
      return {
        title: 'Send new login credentials?',
        message: `${p.member.name} will get a new temporary password and setup link. Their current sessions will be signed out.`,
        confirmLabel: 'Send credentials',
        variant: 'accent' as ConfirmVariant,
      };
    }
    if (p.kind === 'stop-tracking') {
      return {
        title: `Stop ${p.member.name}'s timer?`,
        message: `They are tracking "${p.member.tracking?.label || 'a session'}". The elapsed time will be saved to their timesheet.`,
        confirmLabel: 'Stop timer',
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

  ngOnDestroy(): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
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
        this.flashMsg('err', "Couldn't load members");
      },
    });
  }

  // ─── Invite ────────────────────────────────────────────────────────────
  submitInvite(): void {
    const ws = this.activeWs();
    if (!ws) return;
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
      .onboardEmployee(ws._id, {
        email,
        role: this.inviteRole(),
        globalRole: this.canOnboardEmployees() ? this.inviteGlobalRole() : undefined,
      })
      .subscribe({
      next: (res) => {
        this.inviting.set(false);
        this.inviteEmail.set('');
        this.passwordCopied.set(false);

        // Surface the temp credentials banner only if we got a tempPassword
        // back from the server (means SMTP wasn't configured).
        if (res.newAccount && (res.setupLink || res.tempPassword)) {
          this.lastInvite.set(res);
        } else {
          this.lastInvite.set(null);
        }

        if (res.newAccount && res.emailSent) {
          this.flashMsg('ok', `Account created — credentials emailed to ${email}`);
        } else if (res.newAccount) {
          this.flashMsg('ok', `Account created — copy the setup link below and send it to ${email}`);
        } else {
          this.flashMsg(
            'ok',
            `Added ${res.invitedUser?.name || email} to the workspace`
          );
        }
        this.loadMembers(ws._id);
      },
      error: (err) => {
        this.inviting.set(false);
        this.flashMsg('err', err?.error?.error || "Couldn't add this user");
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
        this.flashMsg('ok', `${user.name} added to ${ws.name}`);
        this.availableUsers.update((list) => list.filter((u) => u._id !== user._id));
        this.loadMembers(ws._id);
      },
      error: (err) => {
        this.addingExistingId.set(null);
        this.flashMsg('err', err?.error?.error || "Couldn't add this member");
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
            this.flashMsg('ok', `${p.member.name}'s role updated`);
            this.loadMembers(ws._id);
          },
          error: (e) => {
            this.pending.set(null);
            this.flashMsg('err', e?.error?.error || "Couldn't update role");
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
              ? `New credentials emailed to ${p.member.email}`
              : `New credentials ready — copy the setup link below for ${p.member.name}`
          );
        },
        error: (e) => {
          this.pending.set(null);
          this.sendingCredentials.set(null);
          this.flashMsg('err', e?.error?.error || "Couldn't send credentials");
        },
      });
    } else if (p.kind === 'remove') {
      this.workspaceSvc.removeMember(ws._id, p.member._id).subscribe({
        next: () => {
          this.pending.set(null);
          this.flashMsg('ok', `${p.member.name} removed`);
          if (p.member._id === this.myUserId()) {
            // I just removed myself — refresh the workspace list
            this.workspaceSvc.loadWorkspaces();
          } else {
            this.loadMembers(ws._id);
          }
        },
        error: (e) => {
          this.pending.set(null);
          this.flashMsg('err', e?.error?.error || "Couldn't remove member");
        },
      });
    } else if (p.kind === 'stop-tracking') {
      this.stoppingTimerId.set(p.member._id);
      this.activitySvc.stopUserTracking(p.member._id).subscribe({
        next: () => {
          this.pending.set(null);
          this.stoppingTimerId.set(null);
          this.flashMsg('ok', `${p.member.name}'s timer stopped`);
          this.loadMembers(ws._id);
        },
        error: (e) => {
          this.pending.set(null);
          this.stoppingTimerId.set(null);
          this.flashMsg('err', e?.error?.error || "Couldn't stop timer");
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
    this.flash.set({ type, text });
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flash.set(null), 3500);
  }

  setFilter(role: FilterRole): void {
    this.filterRole.set(role);
  }

  trackById = (_: number, m: WorkspaceMember) => m._id;
}
