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
import { ToastService } from '../../services/toast.service';
import { TaskService } from '../../services/task.service';
import { ActivityReport, ActivityDay } from '../../models/types';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';
import { ReportExportMenuComponent } from '../../components/ui/report-export-menu/report-export-menu.component';
import { activityReportToExportable } from '../../core/export/report-export.adapters';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

type PresetRange = 'today' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-my-timesheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, PageHeaderComponent, ReportExportMenuComponent, TranslatePipe],
  styleUrls: ['./my-timesheet.component.css'],
  templateUrl: './my-timesheet.component.html',
})
export class MyTimesheetComponent implements OnInit, OnDestroy {
  private activityService = inject(ActivityService);
  private timeEntryService = inject(TimeEntryService);
  private activeTimerService = inject(ActiveTimerService);
  private taskService = inject(TaskService);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  headerSteps = computed(() => [
    { label: this.locale.t('timesheet.step.pickRange'), description: this.locale.t('timesheet.step.pickRangeDesc'), tone: 'do' as const },
    { label: this.locale.t('timesheet.step.reviewDays'), description: this.locale.t('timesheet.step.reviewDaysDesc'), tone: 'wait' as const },
    { label: this.locale.t('timesheet.step.printExport'), description: this.locale.t('timesheet.step.printExportDesc'), tone: 'done' as const },
  ]);

  headerTips = computed(() => [
    { title: this.locale.t('common.overtime'), body: this.locale.t('timesheet.tip.overtime') },
    { title: this.locale.t('common.tasksQuick'), body: this.locale.t('timesheet.tip.sources') },
    { title: this.locale.t('common.live'), body: this.locale.t('timesheet.tip.live') },
  ]);

  printReportTitle = computed(() => {
    const name = this.report()?.user?.name ?? '';
    return this.locale.t('timesheet.print.reportTitle', { userName: name });
  });

  exportPayload = computed(() => {
    const r = this.report();
    if (!r) return null;
    return activityReportToExportable(
      r,
      this.locale,
      this.fromDate(),
      this.toDate(),
      this.printReportTitle()
    );
  });
  report = signal<ActivityReport | null>(null);
  loading = signal(true);

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
    this.timeEntryService.loadActive().subscribe();
    this.activeTimerService.loadActive().subscribe();
    this.load();
    this.tickInterval = setInterval(() => this.nowMs.set(Date.now()), 1_000);
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
    this.activityService
      .getMyReport({ from: this.fromDate(), to: this.toDate() })
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

  /* ─── Active timer controls ─────────────────────────────────────────── */

  stopActive() {
    const taskTimer = this.activeTimerService.activeTask();
    if (taskTimer) {
      this.taskService.stopTimer(taskTimer._id).subscribe({
        next: () => {
          this.activeTimerService.setActiveTask(null);
          this.timeEntryService.active.set(null);
          this.toast.info(this.locale.t('timesheet.toast.timerStopped'));
          this.load();
        },
      });
      return;
    }
    if (this.timeEntryService.active()) {
      this.timeEntryService.stop().subscribe({
        next: () => {
          this.activeTimerService.setActiveTask(null);
          this.toast.info(this.locale.t('timesheet.toast.sessionStopped'));
          this.load();
        },
      });
    }
  }

  /* ─── Formatting helpers ────────────────────────────────────────────── */

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

  /** Total ms for a day including still-running quick sessions and task timers. */
  dayLiveTotal(day: ActivityDay): number {
    let total = day.trackedMs;
    const dayStart = new Date(day.date + 'T00:00:00').getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const now = this.nowMs();

    for (const q of day.quickSessions) {
      if (!q.endedAt) {
        const sAt = new Date(q.startedAt).getTime();
        const live = Math.max(0, Math.min(now, dayEnd) - Math.max(sAt, dayStart));
        total += live - q.durationMs;
      }
    }

    const activeTask = this.activeTimerService.activeTask();
    if (activeTask?.activeTimerStart) {
      const sAt = new Date(activeTask.activeTimerStart).getTime();
      const listed = day.taskLogs.find(
        (log) =>
          log.taskId === activeTask._id &&
          Math.abs(new Date(log.start).getTime() - sAt) < 5_000
      );
      const live = Math.max(0, Math.min(now, dayEnd) - Math.max(sAt, dayStart));
      total += listed ? live - listed.durationMs : live;
    }

    return Math.max(0, total);
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
