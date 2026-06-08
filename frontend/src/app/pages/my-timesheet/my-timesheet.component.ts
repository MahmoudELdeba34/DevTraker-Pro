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
import { ActivityService } from '../../services/activity.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { ActiveTimerService } from '../../services/active-timer.service';
import { TaskService } from '../../services/task.service';
import { ActivityReport, ActivityDay } from '../../models/types';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';

type PresetRange = 'today' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-my-timesheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, PageHeaderComponent],
  styleUrls: ['./my-timesheet.component.css'],
  templateUrl: './my-timesheet.component.html',
})
export class MyTimesheetComponent implements OnInit, OnDestroy {
  private activityService = inject(ActivityService);
  private timeEntryService = inject(TimeEntryService);
  private activeTimerService = inject(ActiveTimerService);
  private taskService = inject(TaskService);

  // ── State ────────────────────────────────────────────────────────────
  report = signal<ActivityReport | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  preset = signal<PresetRange>('week');
  fromDate = signal<string>('');
  toDate = signal<string>('');

  // Live tick to update running entries
  private tickInterval?: ReturnType<typeof setInterval>;
  nowMs = signal<number>(Date.now());

  // Derived display values
  totalHours = computed(() => this.report()?.summary.totalTrackedMs ?? 0);
  overtimeHours = computed(() => this.report()?.summary.totalOvertimeMs ?? 0);
  daysWorked = computed(() => this.report()?.summary.daysWorked ?? 0);
  tasksCount = computed(() => this.report()?.summary.tasksWorked ?? 0);
  quickCount = computed(() => this.report()?.summary.quickSessionsCount ?? 0);

  /** Daily list with live-tick added for any still-running quick session. */
  dailyList = computed<ActivityDay[]>(() => {
    const r = this.report();
    if (!r) return [];
    // Force re-eval when nowMs changes (so live durations update)
    this.nowMs();
    return r.daily;
  });

  ngOnInit() {
    this.applyPreset('week', false);
    this.load();
    this.tickInterval = setInterval(() => this.nowMs.set(Date.now()), 60_000);
  }

  ngOnDestroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  /* ─── Range handling ────────────────────────────────────────────────── */

  applyPreset(p: PresetRange, reload = true) {
    this.preset.set(p);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from = new Date(today);
    let to = new Date(today);
    if (p === 'today') {
      // from = to = today
    } else if (p === 'week') {
      const dow = (today.getDay() + 6) % 7; // Mon=0
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
    this.loading.set(true);
    this.error.set(null);
    this.activityService
      .getMyReport({ from: this.fromDate(), to: this.toDate() })
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(e?.error?.error || 'Failed to load report');
          this.loading.set(false);
        },
      });
  }

  customRangeChanged() {
    this.preset.set('custom');
    this.load();
  }

  /* ─── Print ─────────────────────────────────────────────────────────── */

  printReport() {
    window.print();
  }

  /* ─── Active timer controls ─────────────────────────────────────────── */

  stopActive() {
    const taskTimer = this.activeTimerService.activeTask();
    if (taskTimer) {
      this.taskService.stopTimer(taskTimer._id).subscribe({
        next: () => {
          this.activeTimerService.setActiveTask(null);
          this.load();
        },
      });
      return;
    }
    if (this.timeEntryService.active()) {
      this.timeEntryService.stop().subscribe({ next: () => this.load() });
    }
  }

  /* ─── Formatting helpers ────────────────────────────────────────────── */

  formatHm(ms: number): string {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  formatHmsTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /** Total ms for a day including a still-running quick session. */
  dayLiveTotal(day: ActivityDay): number {
    let extra = 0;
    for (const q of day.quickSessions) {
      if (!q.endedAt) {
        const sAt = new Date(q.startedAt).getTime();
        const dayStart = new Date(day.date + 'T00:00:00').getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        extra += Math.max(0, Math.min(this.nowMs(), dayEnd) - Math.max(sAt, dayStart));
        extra -= q.durationMs; // already counted as 0 server-side
      }
    }
    return day.trackedMs + Math.max(0, extra);
  }

  /** Overtime ms for a day with live tick. */
  dayLiveOvertime(day: ActivityDay): number {
    const total = this.dayLiveTotal(day);
    return Math.max(0, total - (this.report()?.summary.dailyThresholdMs || 7 * 60 * 60 * 1000));
  }

  /** Percentage (0–100) of the 7h goal achieved for a day. */
  dayProgressPct(day: ActivityDay): number {
    const threshold = this.report()?.summary.dailyThresholdMs || 7 * 60 * 60 * 1000;
    return Math.min(100, (this.dayLiveTotal(day) / threshold) * 100);
  }

  formatDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  attendanceStatusColor(status: string | undefined): string {
    if (!status) return 'bg-bg-base text-text-muted border-border';
    if (['Present'].includes(status)) return 'bg-success/10 text-success border-success/30';
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

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
