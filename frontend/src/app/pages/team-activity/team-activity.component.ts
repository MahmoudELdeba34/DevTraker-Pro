import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivityService } from '../../services/activity.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { PresenceReport, PresenceUser } from '../../models/types';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../components/ui/confirm-dialog/confirm-dialog.component';
import type { ConfirmVariant } from '../../components/ui/confirm-dialog/confirm-dialog.component';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

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
  imports: [CommonModule, FormsModule, PageHeaderComponent, ConfirmDialogComponent, TranslatePipe],
  styleUrls: ['./team-activity.component.css'],
  templateUrl: './team-activity.component.html',
})
export class TeamActivityComponent implements OnInit, OnDestroy {
  private activityService = inject(ActivityService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  headerSteps = computed(() => [
    { label: this.locale.t('teamActivity.step.scan'), description: this.locale.t('teamActivity.step.scanDesc'), tone: 'do' as const },
    { label: this.locale.t('teamActivity.step.drill'), description: this.locale.t('teamActivity.step.drillDesc'), tone: 'do' as const },
    { label: this.locale.t('teamActivity.step.print'), description: this.locale.t('teamActivity.step.printDesc'), tone: 'done' as const },
  ]);

  headerTips = computed(() => [
    { title: this.locale.t('common.onlineNow'), body: this.locale.t('teamActivity.tip.onlineWindow') },
    { title: this.locale.t('teamActivity.tab.tracking'), body: this.locale.t('teamActivity.tip.timerTypes') },
    { title: this.locale.t('common.stopTimer'), body: this.locale.t('teamActivity.tip.stopTimer') },
  ]);
  presence = signal<PresenceReport | null>(null);
  loading = signal(true);

  searchQuery = signal('');
  activeTab = signal<TabKey>('online');
  nowMs = signal(Date.now());
  stopPrompt = signal<StopTrackingPrompt | null>(null);
  stoppingUserId = signal<string | null>(null);

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
    this.activityService.getPresence({ silent }).subscribe({
      next: (p) => {
        this.presence.set(p);
        this.loading.set(false);
      },
      error: () => {
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
      title: this.locale.t('teamActivity.confirm.stopTitle', { userName: u.name }),
      message: this.locale.t('teamActivity.confirm.stopMessage', { label: u.tracking.label }),
      confirmLabel: this.locale.t('teamActivity.confirm.stopTimer'),
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
    this.activityService.stopUserTracking(prompt.user._id).subscribe({
      next: (res) => {
        this.stoppingUserId.set(null);
        this.toast.success(res.message || this.locale.t('teamActivity.toast.timerStopped'));
        this.load(true);
      },
      error: () => {
        this.stoppingUserId.set(null);
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
    if (u.online) return this.locale.t('teamActivity.lastSeen.activeNow');
    if (!u.lastActiveAt) return this.locale.t('teamActivity.lastSeen.never');
    const min = Math.floor((this.nowMs() - new Date(u.lastActiveAt).getTime()) / 60000);
    if (min < 60) return this.locale.t('teamActivity.lastSeen.minutes', { min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return this.locale.t('teamActivity.lastSeen.hours', { hr });
    const days = Math.floor(hr / 24);
    return this.locale.t('teamActivity.lastSeen.days', { days });
  }

  prettyPath(path: string): string {
    if (!path) return this.locale.t('common.unknown');
    const seg = path.replace(/^\//, '').split('/')[0];
    if (!seg) return this.locale.t('nav.home');
    return seg
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  formatLastActiveAt(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
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
