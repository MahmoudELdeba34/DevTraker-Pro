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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ActivityService } from '../../services/activity.service';
import { AuthService } from '../../services/auth.service';
import { ActivityReport, ActivityDay } from '../../models/types';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

type PresetRange = 'today' | 'week' | 'month' | 'custom';

/**
 * Admin drill-down for any user — same report shape as My Timesheet,
 * but for another user. Print-friendly.
 */
@Component({
  selector: 'app-user-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, TranslatePipe],
  styleUrls: ['./user-activity.component.css'],
  templateUrl: './user-activity.component.html',
})
export class UserActivityComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private activityService = inject(ActivityService);
  private auth = inject(AuthService);
  locale = inject(LocaleService);

  printReportTitle = computed(() => {
    const name = this.report()?.user?.name ?? '';
    return this.locale.t('userActivity.print.reportTitle', { userName: name });
  });

  printPeriod = computed(() =>
    this.locale.t('userActivity.print.period', { from: this.fromDate(), to: this.toDate() })
  );

  userId = signal<string>('');
  report = signal<ActivityReport | null>(null);
  loading = signal(true);

  preset = signal<PresetRange>('month');
  fromDate = signal<string>('');
  toDate = signal<string>('');

  private tick?: ReturnType<typeof setInterval>;
  nowMs = signal(Date.now());

  totalHours = computed(() => this.report()?.summary.totalTrackedMs ?? 0);
  overtimeHours = computed(() => this.report()?.summary.totalOvertimeMs ?? 0);
  daysWorked = computed(() => this.report()?.summary.daysWorked ?? 0);
  tasksCount = computed(() => this.report()?.summary.tasksWorked ?? 0);
  quickCount = computed(() => this.report()?.summary.quickSessionsCount ?? 0);
  avgHours = computed(() => this.report()?.summary.averageDailyHours ?? 0);

  dailyList = computed<ActivityDay[]>(() => {
    const r = this.report();
    if (!r) return [];
    this.nowMs();
    return r.daily;
  });

  ngOnInit() {
    const role = this.auth.currentUser()?.role;
    if (!['admin', 'manager', 'hr'].includes(role || '')) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.route.paramMap.subscribe((p) => {
      const id = p.get('id') || '';
      if (id) {
        this.userId.set(id);
        this.applyPreset('month', false);
        this.load();
      }
    });

    this.tick = setInterval(() => this.nowMs.set(Date.now()), 30_000);
  }

  ngOnDestroy() {
    if (this.tick) clearInterval(this.tick);
  }

  applyPreset(p: PresetRange, reload = true) {
    this.preset.set(p);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from = new Date(today);
    let to = new Date(today);
    if (p === 'week') {
      const dow = (today.getDay() + 6) % 7;
      from.setDate(today.getDate() - dow);
      to.setDate(from.getDate() + 6);
    } else if (p === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
    this.fromDate.set(this.toYmd(from));
    this.toDate.set(this.toYmd(to));
    if (reload) this.load();
  }

  load() {
    if (!this.userId()) return;
    this.loading.set(true);
    this.activityService
      .getUserReport(this.userId(), { from: this.fromDate(), to: this.toDate() })
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  customRangeChanged() {
    this.preset.set('custom');
    this.load();
  }

  printReport() {
    window.print();
  }

  formatHm(ms: number): string {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  formatHmsTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  formatLastActive(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  dayLiveTotal(day: ActivityDay): number {
    let extra = 0;
    for (const q of day.quickSessions) {
      if (!q.endedAt) {
        const sAt = new Date(q.startedAt).getTime();
        const dayStart = new Date(day.date + 'T00:00:00').getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        extra += Math.max(0, Math.min(this.nowMs(), dayEnd) - Math.max(sAt, dayStart));
        extra -= q.durationMs;
      }
    }
    return day.trackedMs + Math.max(0, extra);
  }

  dayLiveOvertime(day: ActivityDay): number {
    const total = this.dayLiveTotal(day);
    return Math.max(0, total - (this.report()?.summary.dailyThresholdMs || 7 * 60 * 60 * 1000));
  }

  dayProgressPct(day: ActivityDay): number {
    const threshold = this.report()?.summary.dailyThresholdMs || 7 * 60 * 60 * 1000;
    return Math.min(100, (this.dayLiveTotal(day) / threshold) * 100);
  }

  attendanceStatusColor(status: string | undefined): string {
    if (!status) return 'bg-bg-base text-text-muted border-border';
    if (status === 'Present') return 'bg-success/10 text-success border-success/30';
    if (status === 'Late') return 'bg-warning/10 text-warning border-warning/30';
    if (status === 'Remote') return 'bg-info/10 text-info border-info/30';
    if (status === 'Half Day' || status === 'Early Leave')
      return 'bg-warning/10 text-warning border-warning/30';
    if (status === 'On Leave' || status === 'Permission')
      return 'bg-accent-subtle text-accent border-accent/30';
    if (status === 'Absent' || status === 'Missing Check-out')
      return 'bg-danger/10 text-danger border-danger/30';
    return 'bg-bg-base text-text-muted border-border';
  }

  roleClass(role: string | undefined): string {
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
    return (name || '')
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
