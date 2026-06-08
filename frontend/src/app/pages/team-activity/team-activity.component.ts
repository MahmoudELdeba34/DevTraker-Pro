import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivityService } from '../../services/activity.service';
import { AuthService } from '../../services/auth.service';
import { PresenceReport, PresenceUser } from '../../models/types';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';
import {
  ConfirmDialogComponent,
  ConfirmVariant,
} from '../../components/ui/confirm-dialog/confirm-dialog.component';

type TabKey = 'online' | 'tracking' | 'all';

interface StopTrackingPrompt {
  user: PresenceUser;
  title: string;
  message: string;
  confirmLabel: string;
  variant: ConfirmVariant;
}

@Component({
  selector: 'app-team-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, PageHeaderComponent, ConfirmDialogComponent],
  styleUrls: ['./team-activity.component.css'],
  templateUrl: './team-activity.component.html',
})
export class TeamActivityComponent implements OnInit, OnDestroy {
  private activityService = inject(ActivityService);
  private auth = inject(AuthService);
  private router = inject(Router);

  presence = signal<PresenceReport | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  searchQuery = signal('');
  activeTab = signal<TabKey>('online');
  nowMs = signal(Date.now());
  stopPrompt = signal<StopTrackingPrompt | null>(null);
  stoppingUserId = signal<string | null>(null);
  actionMessage = signal<string | null>(null);

  private pollInterval?: ReturnType<typeof setInterval>;
  private tickInterval?: ReturnType<typeof setInterval>;

  filteredUsers = computed<PresenceUser[]>(() => {
    const p = this.presence();
    if (!p) return [];
    const tab = this.activeTab();
    let pool: PresenceUser[] = [];
    if (tab === 'online') pool = p.online;
    else if (tab === 'tracking') pool = [...p.online, ...p.offline].filter((u) => u.tracking);
    else pool = [...p.online, ...p.offline];

    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    // Guard: only admins/managers/HR can see this page
    const role = this.auth.currentUser()?.role;
    if (!['admin', 'manager', 'hr'].includes(role || '')) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.load();
    this.pollInterval = setInterval(() => this.load(true), 15000);
    this.tickInterval = setInterval(() => this.nowMs.set(Date.now()), 1000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  load(silent = false) {
    if (!silent) this.loading.set(true);
    this.activityService.getPresence().subscribe({
      next: (p) => {
        this.presence.set(p);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (e) => {
        this.error.set(e?.error?.error || 'Failed to load team activity');
        this.loading.set(false);
      },
    });
  }

  openUser(u: PresenceUser) {
    this.router.navigate(['/team/users', u._id]);
  }

  promptStopTracking(u: PresenceUser, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!u.tracking || this.stoppingUserId()) return;
    this.stopPrompt.set({
      user: u,
      title: `Stop ${u.name}'s timer?`,
      message: `They are tracking "${u.tracking.label}". The elapsed time will be saved to their timesheet.`,
      confirmLabel: 'Stop timer',
      variant: 'danger',
    });
  }

  cancelStopTracking() {
    this.stopPrompt.set(null);
  }

  confirmStopTracking() {
    const prompt = this.stopPrompt();
    if (!prompt) return;
    this.stopPrompt.set(null);
    this.stoppingUserId.set(prompt.user._id);
    this.actionMessage.set(null);
    this.activityService.stopUserTracking(prompt.user._id).subscribe({
      next: (res) => {
        this.stoppingUserId.set(null);
        this.actionMessage.set(res.message || 'Timer stopped.');
        this.load(true);
        setTimeout(() => this.actionMessage.set(null), 4000);
      },
      error: (e) => {
        this.stoppingUserId.set(null);
        this.actionMessage.set(e?.error?.error || 'Failed to stop timer.');
        setTimeout(() => this.actionMessage.set(null), 4000);
      },
    });
  }

  elapsedSince(iso: string | null): string {
    if (!iso) return '—';
    const ms = Math.max(0, this.nowMs() - new Date(iso).getTime());
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    const remM = min % 60;
    return `${hr}h ${String(remM).padStart(2, '0')}m`;
  }

  /** Friendly relative time for lastActiveAt. */
  lastSeenLabel(u: PresenceUser): string {
    if (u.online) return 'Active now';
    if (!u.lastActiveAt) return 'Never signed in';
    const min = Math.floor((this.nowMs() - new Date(u.lastActiveAt).getTime()) / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  }

  prettyPath(path: string): string {
    if (!path) return 'Idle';
    const seg = path.replace(/^\//, '').split('/')[0];
    if (!seg) return 'Home';
    return seg
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  roleClass(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-danger/15 text-danger border-danger/30';
      case 'manager':
        return 'bg-accent-subtle text-accent border-accent/40';
      case 'hr':
        return 'bg-info/15 text-info border-info/30';
      case 'accountant':
        return 'bg-warning/15 text-warning border-warning/30';
      default:
        return 'bg-bg-base text-text-secondary border-border';
    }
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
