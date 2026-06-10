import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ReportService, ReportSummaryResponse } from '../../services/report.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/types';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from '../../services/toast.service';
import { ReportExportMenuComponent } from '../../components/ui/report-export-menu/report-export-menu.component';
import { summaryReportToExportable } from '../../core/export/report-export.adapters';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ReportExportMenuComponent],
  template: `
    <div class="h-full flex flex-col gap-6" [attr.data-locale]="locale.locale()">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-display font-bold text-white tracking-tight">{{ 'reports.title' | translate }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ 'reports.subtitle' | translate }}</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap justify-end">
          @if (reportData()) {
            <app-report-export-menu
              [payload]="exportPayload()"
              [disabled]="!reportData()"
            />
          }
          @if (isAdmin()) {
            <a routerLink="/admin" class="px-4 py-2 text-sm bg-bg-elevated border border-border hover:bg-bg-hover text-text-secondary hover:text-white rounded-lg transition duration-200">
              {{ 'common.adminPanel' | translate }}
            </a>
          }
        </div>
      </div>

      <div class="bg-bg-elevated border border-border rounded-xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          @if (isPrivileged()) {
            <div class="flex flex-col gap-2">
              <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'reports.filter.employee' | translate }}</label>
              <select [(ngModel)]="selectedUserId" (change)="onFilterChange()"
                      class="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors">
                @for (u of systemUsers(); track u._id) {
                  <option [value]="u._id">{{ employeeOptionLabel(u) }}</option>
                }
              </select>
            </div>
          }

          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'common.startDate' | translate }}</label>
            <input type="date" [(ngModel)]="startDate" (change)="onFilterChange()"
                   class="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors color-scheme-dark" />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'common.endDate' | translate }}</label>
            <input type="date" [(ngModel)]="endDate" (change)="onFilterChange()"
                   class="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors color-scheme-dark" />
          </div>

          <div>
            <button (click)="resetFilters()"
                    class="w-full px-4 py-2 text-sm bg-bg-base hover:bg-bg-hover border border-border text-text-muted hover:text-white rounded-lg transition duration-200">
              {{ 'common.resetFilters' | translate }}
            </button>
          </div>
        </div>
      </div>

      @if (reportData()) {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-1 flex flex-col gap-6">
            <div class="bg-bg-elevated border border-border rounded-xl p-6 flex flex-col gap-5">
              <h2 class="text-lg font-bold text-white border-b border-border pb-4">{{ 'common.workloadSummary' | translate }}</h2>
              <div class="flex items-center justify-between">
                <span class="text-text-secondary text-sm">{{ 'common.totalLoggedTime' | translate }}</span>
                <span class="text-2xl font-black text-white font-mono">{{ reportData()?.summary?.totalHours }}h</span>
              </div>
              <div class="flex items-center justify-between border-t border-border pt-4">
                <span class="text-text-secondary text-sm">{{ 'common.regularHoursMax' | translate }}</span>
                <span class="text-lg font-bold text-accent font-mono">{{ reportData()?.summary?.totalRegularHours }}h</span>
              </div>
              <div class="flex items-center justify-between border-t border-border pt-4">
                <span class="text-text-secondary text-sm">{{ 'common.overtimeTime' | translate }}</span>
                <span class="text-lg font-bold text-danger font-mono">{{ reportData()?.summary?.totalOvertimeHours }}h</span>
              </div>
              <div class="flex items-center justify-between border-t border-border pt-4">
                <span class="text-text-secondary text-sm">{{ 'common.daysWorked' | translate }}</span>
                <span class="text-lg font-bold text-white font-mono">{{ reportData()?.summary?.daysWorkedCount }} {{ 'common.days' | translate }}</span>
              </div>
            </div>

            <div class="bg-bg-elevated border border-border rounded-xl p-6 flex items-center gap-4">
              <div class="w-12 h-12 bg-accent rounded-full flex items-center justify-center font-black text-white text-lg">
                {{ reportData()?.user?.name?.substring(0, 2)?.toUpperCase() }}
              </div>
              <div>
                <div class="font-bold text-white">{{ reportData()?.user?.name }}</div>
                <div class="text-text-muted text-xs mt-0.5">{{ reportData()?.user?.email }}</div>
                <div class="inline-block px-2 py-0.5 mt-2 bg-accent/10 border border-accent/20 text-[10px] text-accent rounded uppercase tracking-wider font-semibold">
                  {{ locale.roleLabel(reportData()?.user?.role || '') }}
                </div>
              </div>
            </div>
          </div>

          <div class="lg:col-span-2 flex flex-col gap-6">
            <div class="bg-bg-elevated border border-border rounded-xl p-6">
              <h2 class="text-lg font-bold text-white mb-6">{{ 'common.dailyWorkloadChart' | translate }}</h2>
              @if ((reportData()?.days?.length ?? 0) === 0) {
                <div class="py-16 text-center text-text-muted">{{ 'common.noTimesheetData' | translate }}</div>
              }
              @if ((reportData()?.days?.length ?? 0) > 0) {
                <div class="flex flex-col gap-4">
                  <div class="flex h-64 gap-3 items-end border-b border-l border-border pb-2 pl-2">
                    @for (day of reportData()?.days; track day.date) {
                      <div class="flex-1 flex flex-col justify-end items-center group h-full relative">
                        <div class="absolute bottom-full mb-2 bg-bg-elevated border border-border text-[10px] p-2.5 rounded-lg opacity-0 group-hover:opacity-100 shadow-modal pointer-events-none transition duration-150 z-20 w-32 flex flex-col gap-1">
                          <span class="font-bold text-text-secondary">{{ day.date | date:'MMM d, y' }}</span>
                          <span class="text-accent">{{ locale.t('common.regularPopover', { hours: day.regularHours }) }}</span>
                          <span class="text-danger">{{ locale.t('common.overtimePopover', { hours: day.overtimeHours }) }}</span>
                          <span class="border-t border-border pt-1 text-white font-bold">{{ locale.t('common.totalPopover', { hours: day.totalHours }) }}</span>
                        </div>
                        <div class="w-full max-w-[40px] flex flex-col justify-end rounded-t overflow-hidden bg-bg-base border border-border/50 h-full">
                          <div class="bg-gradient-to-t from-danger to-red-400"
                               [style.height.%]="(day.overtimeHours / getMaxDailyHours()) * 100"></div>
                          <div class="bg-gradient-to-t from-accent to-indigo-400 border-t border-accent/20"
                               [style.height.%]="(day.regularHours / getMaxDailyHours()) * 100"></div>
                        </div>
                        <span class="text-[9px] text-text-muted mt-2 font-mono whitespace-nowrap rotate-45 md:rotate-0">
                          {{ day.date.substring(5) }}
                        </span>
                      </div>
                    }
                  </div>
                  <div class="flex justify-end gap-6 text-[10px] text-text-muted mt-2">
                    <span class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 bg-accent rounded"></span>
                      {{ 'common.regularHoursLegend' | translate }}
                    </span>
                    <span class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 bg-danger rounded"></span>
                      {{ 'common.overtimeHoursLegend' | translate }}
                    </span>
                  </div>
                </div>
              }
            </div>

            <div class="bg-bg-elevated border border-border rounded-xl overflow-hidden">
              <div class="px-6 py-4 border-b border-border">
                <h2 class="text-lg font-bold text-white">{{ 'common.timesheetBreakdown' | translate }}</h2>
              </div>
              <div class="flex flex-col divide-y divide-border">
                @for (day of reportData()?.days; track day.date) {
                  <div class="overflow-hidden">
                    <div class="p-4 bg-bg-base/50 flex items-center justify-between">
                      <div>
                        <h3 class="font-bold text-sm text-white">{{ day.date | date:'EEEE, MMM d, y' }}</h3>
                        <p class="text-xs text-text-muted mt-0.5">{{ locale.t('common.tasksWorked', { count: day.tasks.length }) }}</p>
                      </div>
                      <div class="text-right">
                        <div class="font-black text-white text-sm font-mono">{{ day.totalHours }} hrs</div>
                        <div class="text-[10px] text-text-muted mt-0.5 flex gap-2 justify-end">
                          <span>{{ 'common.regShort' | translate }} <strong class="text-accent font-mono">{{ day.regularHours }}h</strong></span>
                          @if (day.overtimeHours > 0) {
                            <span>{{ 'common.otShort' | translate }} <strong class="text-danger font-mono">{{ day.overtimeHours }}h</strong></span>
                          }
                        </div>
                      </div>
                    </div>
                    <div class="divide-y divide-border/50">
                      @for (task of day.tasks; track task.title) {
                        <div class="p-4 flex flex-col md:flex-row justify-between md:items-center gap-2 hover:bg-bg-hover/30 transition-colors">
                          <div>
                            <div class="text-xs font-semibold text-white">{{ task.title }}</div>
                            <div class="text-[10px] text-text-muted mt-1 uppercase tracking-wider">{{ locale.t('common.projectLabel', { title: task.projectTitle }) }}</div>
                          </div>
                          <div class="text-[11px] font-bold text-text-secondary font-mono bg-bg-base px-2 py-0.5 rounded border border-border w-fit">
                            {{ task.hours }} hrs
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
                @if ((reportData()?.days?.length ?? 0) === 0) {
                  <div class="text-center py-12 text-text-muted border border-dashed border-border m-6 rounded-xl">
                    {{ 'common.noLogsInPeriod' | translate }}
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="flex items-center justify-center p-16 text-text-muted">
          <div class="flex flex-col items-center gap-3">
            <svg class="animate-spin h-6 w-6 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm font-medium">{{ 'reports.loading' | translate }}</span>
          </div>
        </div>
      }
    </div>
  `
})
export class ReportsComponent implements OnInit {
  private reportService = inject(ReportService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  selectedUserId = '';
  startDate = '';
  endDate = '';

  systemUsers = signal<User[]>([]);
  reportData = signal<ReportSummaryResponse | null>(null);

  exportPayload = computed(() => {
    const data = this.reportData();
    if (!data) return null;
    const name = data.user?.name ?? '';
    const title = this.locale.t('reports.export.title', { userName: name });
    return summaryReportToExportable(data, this.locale, this.startDate, this.endDate, title);
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const qUserId = params['userId'];
      const currentUser = this.authService.currentUser();
      this.selectedUserId = qUserId || currentUser?._id || '';

      if (this.isPrivileged()) {
        this.userService.getAll().subscribe({
          next: (res) => {
            if (res.success) {
              this.systemUsers.set(res.data);
            }
          }
        });
      }

      this.loadReport();
    });
  }

  employeeOptionLabel(u: User): string {
    return this.locale.t('reports.filter.employeeOption', {
      name: u.name,
      role: this.locale.roleLabel(u.role),
    });
  }

  loadReport() {
    this.reportService.getSummary(
      this.selectedUserId || undefined,
      this.startDate || undefined,
      this.endDate || undefined
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.reportData.set(res.data);
        }
      },
      error: () => {
        this.toast.error(this.locale.t('reports.error.loadFailed'));
      }
    });
  }

  onFilterChange() {
    this.loadReport();
  }

  resetFilters() {
    this.startDate = '';
    this.endDate = '';
    const currentUser = this.authService.currentUser();
    this.selectedUserId = currentUser?._id || '';
    this.loadReport();
  }

  isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'admin';
  }

  isPrivileged(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'admin' || role === 'manager';
  }

  getMaxDailyHours(): number {
    const days = this.reportData()?.days || [];
    if (days.length === 0) return 10;
    const max = Math.max(...days.map(d => d.totalHours), 7);
    return max + 1;
  }
}
