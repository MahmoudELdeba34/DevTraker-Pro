import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HRService } from '../../services/hr.service';
import { Attendance } from '../../models/types';
import { Subscription, interval, startWith } from 'rxjs';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';
import {
  ConfirmDialogComponent,
  ConfirmIcon,
  ConfirmVariant,
} from '../../components/ui/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  icon?: ConfirmIcon;
  onConfirm: () => void;
}

const ATTENDANCE_STATUS_KEYS: Record<string, string> = {
  Present: 'attendanceStatus.present',
  Absent: 'attendanceStatus.absent',
  Late: 'attendanceStatus.late',
  'Early Leave': 'attendanceStatus.earlyLeave',
  'Half Day': 'attendanceStatus.halfDay',
  Weekend: 'attendanceStatus.weekend',
  Holiday: 'attendanceStatus.holiday',
  'On Leave': 'attendanceStatus.onLeave',
  Permission: 'attendanceStatus.permission',
  Remote: 'attendanceStatus.remote',
  'Missing Check-out': 'attendanceStatus.missingCheckout',
};

@Component({
  selector: 'app-employee-home',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, ConfirmDialogComponent, TranslatePipe],
  template: `
    <div class="page-ambient pb-12 animate-fade-up" [attr.data-locale]="locale.locale()">

      <app-page-header
        [eyebrow]="'employeeHome.eyebrow' | translate"
        [title]="'employeeHome.title' | translate"
        [description]="'employeeHome.description' | translate"
        [badge]="myBadge()"
        [badgeTone]="myBadgeTone()"
        [steps]="headerSteps()"
        [tips]="headerTips()"
      >
        <div header-actions class="flex items-center gap-2.5">
          <a routerLink="/request-center" class="btn-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            {{ 'support.card.requestCenter.title' | translate }}
          </a>
          <a routerLink="/my-timesheet" class="btn-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ 'timesheet.title' | translate }}
          </a>
        </div>
      </app-page-header>

      @if (!attendance()?.checkIn) {
        <div class="mb-6 rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 to-transparent p-4 flex items-center gap-4 animate-fade-up">
          <div class="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-white">{{ 'employeeHome.idle.title' | translate }}</p>
            <p class="text-xs text-text-secondary">{{ 'employeeHome.idle.hint' | translate }}</p>
          </div>
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div class="lg:col-span-1">
          <div class="bg-bg-elevated border border-border rounded-2xl p-6 flex flex-col items-center text-center gap-6 relative overflow-hidden">
            <div class="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-60 transition-opacity"
                 [style.background]="getGlowColor()"></div>

            <div class="flex flex-col items-center gap-1 relative z-10">
              <span class="text-[10px] uppercase font-bold tracking-[0.18em] text-text-muted">{{ 'common.currentTime' | translate }}</span>
              <h2 class="text-5xl font-mono font-extrabold text-white tracking-tight tabular-nums">{{ tickingTime }}</h2>
              <span class="text-[11px] text-text-secondary font-medium">{{ tickingDate }}</span>
            </div>

            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold relative z-10 transition-colors"
                 [ngClass]="statusPillClasses()">
              <span class="live-dot" [style.background]="getDotColor()"></span>
              {{ getStatusLabel() }}
            </div>

            @if (attendance()?.checkIn && !attendance()?.checkOut) {
              <div class="w-full border-t border-border pt-5 flex flex-col items-center gap-1 animate-fade-up relative z-10">
                <span class="text-[10px] uppercase font-bold tracking-[0.18em] text-text-muted">{{ 'common.activeShift' | translate }}</span>
                <h3 class="text-3xl font-mono font-extrabold text-white tabular-nums">{{ activeWorkTimer }}</h3>
                @if (isOnBreak()) {
                  <span class="text-[10px] text-warning font-mono uppercase tracking-widest">{{ 'employeeHome.pausedOnBreak' | translate }}</span>
                }
              </div>
            }

            <div class="w-full border-t border-border pt-5 flex flex-col gap-2.5 relative z-10">
              @if (!attendance()?.checkIn) {
                <button (click)="onCheckIn()" [disabled]="processing()"
                  class="group w-full py-3 rounded-xl bg-gradient-to-r from-success to-emerald-600 text-white font-bold text-sm shadow-[0_10px_30px_-12px_rgba(34,197,94,0.6)] hover:shadow-[0_14px_40px_-12px_rgba(34,197,94,0.75)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  {{ 'common.punchIn' | translate }}
                </button>
              }

              @if (attendance()?.checkIn && !attendance()?.checkOut) {
                <div class="grid grid-cols-2 gap-2.5">
                  @if (!isOnBreak()) {
                    <button (click)="onBreakStart()" [disabled]="processing()"
                      class="py-2.5 rounded-xl bg-bg-base border border-border hover:border-warning/40 text-warning font-bold text-xs uppercase tracking-wider transition-all hover:bg-warning/5 active:scale-[0.98] disabled:opacity-50">
                      {{ 'common.startBreak' | translate }}
                    </button>
                  } @else {
                    <button (click)="onBreakEnd()" [disabled]="processing()"
                      class="py-2.5 rounded-xl bg-warning text-bg-base font-black text-xs uppercase tracking-wider shadow-[0_8px_24px_-8px_rgba(245,158,11,0.6)] hover:bg-amber-400 active:scale-[0.98] transition-all disabled:opacity-50">
                      {{ 'common.endBreak' | translate }}
                    </button>
                  }
                  <button (click)="promptCheckOut()" [disabled]="processing()"
                    class="py-2.5 rounded-xl bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/25 hover:border-danger font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50">
                    {{ 'common.punchOut' | translate }}
                  </button>
                </div>
              }

              @if (attendance()?.checkIn && attendance()?.checkOut) {
                <div class="text-center py-4 px-3 bg-bg-base border border-success/20 rounded-xl">
                  <p class="text-xs text-success font-bold mb-1 inline-flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    {{ 'employeeHome.shift.complete' | translate }}
                  </p>
                  <span class="text-[11px] text-text-muted font-mono">{{ 'employeeHome.shift.worked' | translate:{ duration: formatMinutes(attendance()?.workedMinutes || 0) } }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 flex flex-col gap-6">

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
            <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5" [title]="'common.lateArrivalsTitle' | translate">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.lateArrivals' | translate }}</span>
                <div class="w-7 h-7 rounded-lg flex items-center justify-center"
                     [ngClass]="totalLateMinutes() > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-display font-extrabold text-white font-mono tabular-nums">{{ totalLateMinutes() }}</span>
                <span class="text-xs text-text-muted">{{ 'common.minsPastStartMonth' | translate }}</span>
              </div>
            </div>

            <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.leaveBalance' | translate }}</span>
                <div class="w-7 h-7 rounded-lg bg-accent-subtle text-accent flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>
                </div>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-display font-extrabold text-white font-mono tabular-nums">{{ annualLeavesRemaining() }}</span>
                <span class="text-xs text-text-muted">{{ 'common.daysAvailable' | translate }}</span>
              </div>
            </div>

            <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.daysPresent' | translate }}</span>
                <div class="w-7 h-7 rounded-lg bg-success/10 text-success flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-display font-extrabold text-white font-mono tabular-nums">{{ presentCount() }}</span>
                <span class="text-xs text-text-muted">{{ 'common.thisMonth' | translate }}</span>
              </div>
            </div>
          </div>

          <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 class="section-title"><span class="dot"></span>{{ 'common.attendanceLog' | translate }}</h2>
              <span class="text-[10px] uppercase font-bold tracking-widest text-text-muted">{{ 'common.entriesCount' | translate:{ count: historyLogs().length } }}</span>
            </div>

            <div class="overflow-x-auto hide-scrollbar">
              <table class="hr-table">
                <thead>
                  <tr>
                    <th>{{ 'common.date' | translate }}</th>
                    <th>{{ 'common.checkIn' | translate }}</th>
                    <th>{{ 'common.checkOut' | translate }}</th>
                    <th>{{ 'common.duration' | translate }}</th>
                    <th class="text-center">{{ 'common.status' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of historyLogs(); track item._id) {
                    <tr>
                      <td class="text-white font-medium">{{ item.date | date:'EEE, MMM d' }}</td>
                      <td class="font-mono text-text-muted">{{ item.checkIn ? (item.checkIn | date:'HH:mm') : '—' }}</td>
                      <td class="font-mono text-text-muted">{{ item.checkOut ? (item.checkOut | date:'HH:mm') : '—' }}</td>
                      <td class="font-mono text-white">{{ formatMinutes(item.workedMinutes) }}</td>
                      <td class="text-center">
                        <span class="chip" [ngClass]="getStatusChipClass(item.status)">
                          <span class="chip-dot"></span>{{ attendanceStatusLabel(item.status) }}
                        </span>
                      </td>
                    </tr>
                  }
                  @if (historyLogs().length === 0) {
                    <tr>
                      <td colspan="5" class="text-center py-10">
                        <div class="flex flex-col items-center gap-3 text-text-muted">
                          <div class="w-12 h-12 rounded-full bg-bg-base border border-border flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          </div>
                          <p class="text-sm">{{ 'common.noAttendanceLogs' | translate }}</p>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      @if (confirmRequest(); as req) {
        <app-confirm-dialog
          [open]="true"
          [title]="req.title"
          [message]="req.message"
          [confirmLabel]="req.confirmLabel"
          [cancelLabel]="req.cancelLabel"
          [variant]="req.variant"
          [icon]="req.icon ?? 'alert'"
          (confirmed)="executeConfirm()"
          (cancelled)="cancelConfirm()"
        />
      }
    </div>
  `,
})
export class EmployeeHomeComponent implements OnInit, OnDestroy {
  private hrService = inject(HRService);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  attendance = signal<Attendance | null>(null);
  historyLogs = signal<Attendance[]>([]);
  processing = signal(false);

  tickingTime = '--:--:--';
  tickingDate = '';
  private clockSub?: Subscription;

  activeWorkTimer = '00:00:00';
  private timerSub?: Subscription;

  totalLateMinutes = signal(0);
  annualLeavesRemaining = signal(21);
  presentCount = signal(0);

  confirmRequest = signal<ConfirmRequest | null>(null);

  headerSteps = computed(() => {
    this.locale.locale();
    return [
      { label: this.locale.t('employeeHome.step.punchIn'), description: this.locale.t('employeeHome.step.punchInDesc'), tone: 'do' as const },
      { label: this.locale.t('employeeHome.step.workBreak'), description: this.locale.t('employeeHome.step.workBreakDesc'), tone: 'wait' as const },
      { label: this.locale.t('employeeHome.step.punchOut'), description: this.locale.t('employeeHome.step.punchOutDesc'), tone: 'done' as const },
    ];
  });

  headerTips = computed(() => {
    this.locale.locale();
    return [
      { title: this.locale.t('common.lateArrivals'), body: this.locale.t('common.lateToleranceTip') },
      { title: this.locale.t('common.onBreak'), body: this.locale.t('common.breaksPausedTip') },
      { title: this.locale.t('support.card.requestCenter.title'), body: this.locale.t('common.needTimeOffTip') },
    ];
  });

  statusPillClasses = computed(() => {
    const att = this.attendance();
    if (att?.checkIn && !att.checkOut && !this.isOnBreak())
      return 'bg-success/10 text-success border-success/25';
    if (this.isOnBreak()) return 'bg-warning/10 text-warning border-warning/25';
    if (att?.checkIn && att?.checkOut)
      return 'bg-accent-subtle text-accent border-accent/30';
    return 'bg-bg-base text-text-secondary border-border';
  });

  myBadge = computed(() => {
    this.locale.locale();
    const att = this.attendance();
    if (this.isOnBreak()) return this.locale.t('employeeHome.badge.onBreak');
    if (att?.checkIn && !att.checkOut) return this.locale.t('employeeHome.badge.onClock');
    if (att?.checkIn && att.checkOut) return this.locale.t('employeeHome.badge.shiftComplete');
    return this.locale.t('employeeHome.badge.notPunchedIn');
  });

  myBadgeTone = computed<'info' | 'success' | 'warning' | 'danger' | 'accent'>(() => {
    const att = this.attendance();
    if (this.isOnBreak()) return 'warning';
    if (att?.checkIn && !att.checkOut) return 'success';
    if (att?.checkIn && att.checkOut) return 'accent';
    return 'info';
  });

  ngOnInit() {
    this.startClockTicking();
    this.loadTodayStatus();
    this.loadHistory();
    this.loadBalances();
  }

  ngOnDestroy() {
    this.clockSub?.unsubscribe();
    this.timerSub?.unsubscribe();
  }

  startClockTicking() {
    this.clockSub = interval(1000)
      .pipe(startWith(0))
      .subscribe(() => {
        const d = new Date();
        const loc = this.locale.locale() === 'ar' ? 'ar-SA' : 'en-US';
        this.tickingTime = d.toLocaleTimeString(loc, { hour12: false });
        this.tickingDate = d.toLocaleDateString(loc, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      });
  }

  loadTodayStatus() {
    this.hrService.getTodayAttendance().subscribe({
      next: (res) => {
        if (res.success) {
          this.attendance.set(res.data);
          this.checkAndStartShiftTimer();
        }
      }
    });
  }

  loadHistory() {
    this.hrService.getAttendanceHistory().subscribe({
      next: (res) => {
        if (res.success) {
          this.historyLogs.set(res.data);
          let totalLate = 0;
          let presents = 0;
          res.data.forEach(item => {
            if (item.status === 'Late') totalLate += item.lateMinutes || 0;
            if (['Present', 'Late', 'Early Leave'].includes(item.status)) presents++;
          });
          this.totalLateMinutes.set(totalLate);
          this.presentCount.set(presents);
        }
      }
    });
  }

  loadBalances() {
    this.hrService.getLeaveBalances().subscribe({
      next: (res) => {
        if (res.success) {
          this.annualLeavesRemaining.set(res.data.annualLeaveBalance);
        }
      }
    });
  }

  checkAndStartShiftTimer() {
    this.timerSub?.unsubscribe();
    const att = this.attendance();
    if (att && att.checkIn && !att.checkOut) {
      this.timerSub = interval(1000)
        .pipe(startWith(0))
        .subscribe(() => {
          const checkInTime = new Date(att.checkIn!).getTime();
          let currentBreakTime = 0;
          att.breaks.forEach(b => {
            const end = b.end ? new Date(b.end).getTime() : Date.now();
            currentBreakTime += (end - new Date(b.start).getTime());
          });
          const totalWorkMs = Date.now() - checkInTime - currentBreakTime;
          this.activeWorkTimer = this.formatMsToTimer(totalWorkMs);
        });
    }
  }

  onCheckIn() {
    this.processing.set(true);
    this.hrService.checkIn().subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.attendance.set(res.data);
          this.checkAndStartShiftTimer();
          this.loadHistory();
          this.toast.success(this.locale.t('employeeHome.toast.checkedIn'));
        }
      },
      error: () => this.processing.set(false)
    });
  }

  promptCheckOut() {
    this.confirmRequest.set({
      title: this.locale.t('common.punchOutTitle'),
      message: this.locale.t('common.punchOutMessage'),
      confirmLabel: this.locale.t('common.yesPunchOut'),
      cancelLabel: this.locale.t('common.keepWorking'),
      variant: 'danger',
      icon: 'clock',
      onConfirm: () => this.onCheckOut()
    });
  }

  onCheckOut() {
    this.processing.set(true);
    this.hrService.checkOut().subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.attendance.set(res.data);
          this.timerSub?.unsubscribe();
          this.loadHistory();
          this.toast.success(this.locale.t('employeeHome.toast.punchedOut'));
        }
      },
      error: () => this.processing.set(false)
    });
  }

  onBreakStart() {
    this.processing.set(true);
    this.hrService.startBreak().subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.attendance.set(res.data);
          this.checkAndStartShiftTimer();
          this.toast.success(this.locale.t('employeeHome.toast.breakStarted'));
        }
      },
      error: () => this.processing.set(false)
    });
  }

  onBreakEnd() {
    this.processing.set(true);
    this.hrService.endBreak().subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.attendance.set(res.data);
          this.checkAndStartShiftTimer();
          this.toast.success(this.locale.t('employeeHome.toast.breakEnded'));
        }
      },
      error: () => this.processing.set(false)
    });
  }

  cancelConfirm() { this.confirmRequest.set(null); }
  executeConfirm() {
    const req = this.confirmRequest();
    this.confirmRequest.set(null);
    req?.onConfirm();
  }

  isOnBreak(): boolean {
    const att = this.attendance();
    if (!att || att.breaks.length === 0) return false;
    const lastBreak = att.breaks[att.breaks.length - 1];
    return !lastBreak.end;
  }

  attendanceStatusLabel(status: string): string {
    const key = ATTENDANCE_STATUS_KEYS[status];
    return key ? this.locale.t(key) : status;
  }

  getStatusLabel(): string {
    this.locale.locale();
    const att = this.attendance();
    if (!att) return this.locale.t('employeeHome.status.notCheckedIn');
    if (att.checkOut) return this.locale.t('employeeHome.status.shiftCompleted');
    if (this.isOnBreak()) return this.locale.t('employeeHome.status.onBreak');
    return this.locale.t('employeeHome.status.checkedIn', { status: this.attendanceStatusLabel(att.status) });
  }

  getDotColor(): string {
    const att = this.attendance();
    if (att?.checkIn && !att.checkOut && !this.isOnBreak()) return '#22C55E';
    if (this.isOnBreak()) return '#F59E0B';
    return '#EF4444';
  }

  getGlowColor(): string {
    const att = this.attendance();
    if (att?.checkIn && !att.checkOut && !this.isOnBreak())
      return 'radial-gradient(circle, rgba(34,197,94,0.20), transparent 70%)';
    if (this.isOnBreak())
      return 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)';
    return 'radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)';
  }

  getStatusChipClass(status: string): string {
    if (status === 'Present')                                 return 'chip-success';
    if (status === 'Absent')                                  return 'chip-danger';
    if (status === 'Late' || status === 'Early Leave')        return 'chip-warning';
    if (status === 'On Leave')                                return 'chip-accent';
    return 'chip-muted';
  }

  formatMinutes(mins: number): string {
    if (!mins) return '0h';
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs === 0) return `${m}m`;
    return `${hrs}h ${m}m`;
  }

  private formatMsToTimer(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const hrs  = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }
}
