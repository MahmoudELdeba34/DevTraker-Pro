import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  HostListener,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceService, WorkspaceMember } from '../../../services/workspace.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { User } from '../../../models/types';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

@Component({
  selector: 'app-workspace-members-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-members-modal.component.html',
  styleUrls: ['./workspace-members-modal.component.css'],
})
export class WorkspaceMembersModalComponent implements OnChanges {
  @Input() spaceId = '';
  @Input() spaceName = '';
  @Input() iconOnly = false;

  private el = inject(ElementRef);
  private workspaceService = inject(WorkspaceService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  // ─── Signals ─────────────────────────────────────────────────
  members = signal<WorkspaceMember[]>([]);
  loading = signal(false);
  saving = signal(false);
  search = signal('');
  openMenu = signal(false);
  allUsers = signal<User[]>([]);

  isSearchFocused = false;

  // ─── Computed ────────────────────────────────────────────────
  usersToAdd = computed(() => {
    const q = this.search().toLowerCase().trim();
    const memberIds = new Set(this.members().map(m => m._id));
    return this.allUsers()
      .filter(u => !memberIds.has(u._id))
      .filter(u =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
  });

  displayMembers = computed(() => this.members().slice(0, 3));
  overflowCount = computed(() => Math.max(0, this.members().length - 3));

  // ─── Lifecycle ───────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['spaceId'] && this.spaceId) {
      this.loadMembers();
    }
  }

  // ─── Host Listeners ──────────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.openMenu()) {
      this.openMenu.set(false);
      this.search.set('');
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (this.openMenu() && !this.el.nativeElement.contains(event.target)) {
      this.openMenu.set(false);
      this.search.set('');
    }
  }

  // ─── Data Loading ────────────────────────────────────────────
  loadMembers(): void {
    if (!this.spaceId) return;
    this.loading.set(true);

    this.workspaceService.getMembers(this.spaceId).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadAllUsers(): void {
    this.userService.getAll().subscribe({
      next: (res) => {
        if (res.success) {
          this.allUsers.set(res.data);
        }
      },
    });
  }

  // ─── Actions ─────────────────────────────────────────────────
  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    const wasOpen = this.openMenu();
    this.openMenu.set(!wasOpen);
    if (!wasOpen) {
      this.search.set('');
      this.loadAllUsers();
      this.loadMembers();
    }
  }

  addMember(user: User, event: MouseEvent): void {
    event.stopPropagation();
    if (this.saving()) return;

    this.saving.set(true);

    this.workspaceService.addMember(this.spaceId, user._id).subscribe({
      next: () => {
        // Optimistic update
        this.members.update(list => [
          ...list,
          {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isOwner: false,
          },
        ]);
        this.saving.set(false);
        this.search.set('');
        this.toastService.success(
          `${user.name} added to ${this.spaceName}`,
          'Member Added'
        );
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  removeMember(member: WorkspaceMember, event: MouseEvent): void {
    event.stopPropagation();
    if (this.saving() || member.isOwner) return;

    this.saving.set(true);

    this.workspaceService.removeMember(this.spaceId, member._id).subscribe({
      next: () => {
        this.members.update(list => list.filter(m => m._id !== member._id));
        this.saving.set(false);
        this.toastService.info(
          `${member.name} removed from ${this.spaceName}`,
          'Member Removed'
        );
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────
  initials(name: string): string {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  roleLabel(role: string, isOwner: boolean): string {
    if (isOwner) return 'Owner';
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Manager';
      case 'hr': return 'HR';
      case 'accountant': return 'Accountant';
      default: return 'Member';
    }
  }

  roleBadgeClass(role: string, isOwner: boolean): string {
    if (isOwner) return 'role-owner';
    switch (role) {
      case 'admin': return 'role-admin';
      case 'manager': return 'role-manager';
      case 'hr': return 'role-hr';
      case 'accountant': return 'role-accountant';
      default: return 'role-employee';
    }
  }

  avatarColor(index: number): string {
    return `cu-avatar-color-${(index % 5) + 1}`;
  }

  onSearchChange(value: string): void {
    this.search.set(value);
  }

  trackByMemberId(_: number, member: WorkspaceMember): string {
    return member._id;
  }

  trackByUserId(_: number, user: User): string {
    return user._id;
  }
}
