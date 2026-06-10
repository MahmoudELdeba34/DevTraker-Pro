import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ActivityService } from '../../services/activity.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ActivityDay, ActivityReport, User } from '../../models/types';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from '../../services/toast.service';
import { ReportExportMenuComponent } from '../../components/ui/report-export-menu/report-export-menu.component';
import { activityReportToExportable } from '../../core/export/report-export.adapters';

type DatePreset = 'week' | 'month' | 'last30' | 'custom';

interface DailyBar {
  date: string;
  dateLabel: string;
  shortLabel: string;
  regularH: number;
  overtimeH: number;
  totalH: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ReportExportMenuComponent],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
})
export class ReportsComponent implements OnInit {
  private activityService = inject(ActivityService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  selectedUserId = '';
  startDate = '';
  endDate = '';
  preset = signal<DatePreset>('month');
  loading = signal(true);

  systemUsers = signal<User[]>([]);
  report = signal<ActivityReport | null>(null);

  private readonly dailyGoalHours = 7;

  exportPayload = computed(() => {
    const data = this.report();
    if (!data) return null;
    const title = this.locale.t('reports.export.title', { userName: data.user.name });
    return activityReportToExportable(data, this.locale, this.startDate, this.endDate, title);
  });

  periodLabel = computed(() => {
    if (!this.startDate || !this.endDate) return '';
    return this.locale.t('export.periodRange', { from: this.startDate, to: this.endDate });
  });

  regularMs = computed(() => {
    const r = this.report();
    if (!r) return 0;
    const threshold = r.summary.dailyThresholdMs || this.dailyGoalHours * 3_600_000;
    return r.daily.reduce((sum, day) => {
      const worked = this.dayTrackedMs(day);
      return sum + Math.min(worked, threshold);
    }, 0);
  });

  dailyBars = computed<DailyBar[]>(() => {
    const r = this.report();
    if (!r) return [];
    const threshold = r.summary.dailyThresholdMs || this.dailyGoalHours * 3_600_000;
    return r.daily
      .filter((day) => this.dayTrackedMs(day) > 0 || day.attendance)
      .map((day) => {
        const worked = this.dayTrackedMs(day);
        const regular = Math.min(worked, threshold);
        return {
          date: day.date,
          dateLabel: this.formatDayLabel(day.date),
          shortLabel: new Date(day.date + 'T00:00:00').toLocaleDateString(this.locale.dateLocale(), {
            weekday: 'short',
            day: 'numeric',
          }),
          regularH: regular / 3_600_000,
          overtimeH: day.overtimeMs / 3_600_000,
          totalH: worked / 3_600_000,
        };
      });
  });

  maxChartHours = computed(() => {
    const bars = this.dailyBars();
    if (bars.length === 0) return 10;
    const max = Math.max(...bars.map((b) => b.totalH), this.dailyGoalHours);
    return Math.ceil(max + 1);
  });

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const qUserId = params['userId'];
      const currentUser = this.authService.currentUser();
      this.selectedUserId = qUserId || currentUser?._id || '';

      if (this.isPrivileged()) {
        this.userService.getAll().subscribe({
          next: (res) => {
            if (res.success) {
              this.systemUsers.set(res.data);
            }
          },
        });
      }

      this.applyPreset('month', false);
      this.loadReport();
    });
  }

  employeeOptionLabel(u: User): string {
    return this.locale.t('reports.filter.employeeOption', {
      name: u.name,
      role: this.locale.roleLabel(u.role),
    });
  }

  applyPreset(p: DatePreset, reload = true): void {
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
    } else if (p === 'last30') {
      from.setDate(today.getDate() - 29);
    }

    this.startDate = this.toYmd(from);
    this.endDate = this.toYmd(to);
    if (reload) this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    const range = { from: this.startDate, to: this.endDate };
    const request$ =
      this.isPrivileged() && this.selectedUserId
        ? this.activityService.getUserReport(this.selectedUserId, range)
        : this.activityService.getMyReport(range);

    request$.subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.locale.t('reports.error.loadFailed'));
      },
    });
  }

  onFilterChange(): void {
    this.loadReport();
  }

  resetFilters(): void {
    const currentUser = this.authService.currentUser();
    this.selectedUserId = currentUser?._id || '';
    this.applyPreset('month');
  }

  overtimeShare(): string {
    const r = this.report();
    if (!r || r.summary.totalTrackedMs <= 0) return '0.0';
    return ((r.summary.totalOvertimeMs / r.summary.totalTrackedMs) * 100).toFixed(1);
  }

  barHeightPercent(hours: number): number {
    const max = this.maxChartHours();
    if (max <= 0) return 0;
    return Math.min(100, (hours / max) * 100);
  }

  dayTrackedMs(day: ActivityDay): number {
    return day.trackedMs || day.attendanceMs || 0;
  }

  dayRegularMs(day: ActivityDay): number {
    const r = this.report();
    const threshold = r?.summary.dailyThresholdMs || this.dailyGoalHours * 3_600_000;
    return Math.min(this.dayTrackedMs(day), threshold);
  }

  formatHm(ms: number): string {
    const totalMin = Math.max(0, Math.floor(ms / 60_000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  formatDayLabel(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString(this.locale.dateLocale(), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'admin';
  }

  isPrivileged(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'admin' || role === 'manager' || role === 'hr';
  }

  canOpenUserDrilldown(): boolean {
    const role = this.authService.currentUser()?.role;
    return !!this.selectedUserId && (role === 'admin' || role === 'hr');
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}
