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

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  icon?: ConfirmIcon;
  onConfirm: () => void;
}

@Component({
  selector: 'app-employee-home',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, ConfirmDialogComponent],
  template: `
    <div class="page-ambient pb-12 animate-fade-up">

      <app-page-header
        eyebrow="Clock Terminal"
        title="My Workday"
        description="Punch in when you arrive, take breaks as needed, and punch out at the end of your shift. Your hours sync to your timesheet automatically."
        [badge]="myBadge()"
        [badgeTone]="myBadgeTone()"
        [steps]="[
          { label: 'Punch In', description: 'Start your shift the moment you arrive.', tone: 'do' },
          { label: 'Work & Break', description: 'Track focused time. Pause cleanly for any break.', tone: 'wait' },
          { label: 'Punch Out', description: 'End your shift. Your hours are logged automatically.', tone: 'done' }
        ]"
        [tips]="[
          { title: 'Late tolerance', body: 'Punching in after your scheduled start counts as late minutes.' },
          { title: 'Breaks are paused time', body: 'Break time is subtracted from your worked hours.' },
          { title: 'Need time off?', body: 'Open Request Center to file a leave, permission, or overtime request.' }
        ]"
      >
        <div header-actions class="flex items-center gap-2.5">
          <a routerLink="/request-center" class="btn-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Request Center
          </a>
          <a routerLink="/my-timesheet" class="btn-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            My Timesheet
          </a>
        </div>
      </app-page-header>

      <!-- Idle CTA banner — visible only when not punched in -->
      @if (!attendance()?.checkIn) {
        <div class="mb-6 rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 to-transparent p-4 flex items-center gap-4 animate-fade-up">
          <div class="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-white">Ready to start your day?</p>
            <p class="text-xs text-text-secondary">Tap <strong class="text-accent">Punch In</strong> on the clock console below to begin your shift.</p>
          </div>
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- ========== Clock Console ========== -->
        <div class="lg:col-span-1">
          <div class="bg-bg-elevated border border-border rounded-2xl p-6 flex flex-col items-center text-center gap-6 relative overflow-hidden">
            <!-- Ambient glow inside card -->
            <div class="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-60 transition-opacity"
                 [style.background]="getGlowColor()"></div>

            <!-- Live time -->
            <div class="flex flex-col items-center gap-1 relative z-10">
              <span class="text-[10px] uppercase font-bold tracking-[0.18em] text-text-muted">Current Time</span>
              <h2 class="text-5xl font-mono font-extrabold text-white tracking-tight tabular-nums">{{ tickingTime }}</h2>
              <span class="text-[11px] text-text-secondary font-medium">{{ tickingDate }}</span>
            </div>

            <!-- Status pill -->
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold relative z-10 transition-colors"
                 [ngClass]="statusPillClasses()">
              <span class="live-dot" [style.background]="getDotColor()"></span>
              {{ getStatusLabel() }}
            </div>

            <!-- Active shift timer -->
            @if (attendance()?.checkIn && !attendance()?.checkOut) {
              <div class="w-full border-t border-border pt-5 flex flex-col items-center gap-1 animate-fade-up relative z-10">
                <span class="text-[10px] uppercase font-bold tracking-[0.18em] text-text-muted">Active Shift</span>
                <h3 class="text-3xl font-mono font-extrabold text-white tabular-nums">{{ activeWorkTimer }}</h3>
                @if (isOnBreak()) {
                  <span class="text-[10px] text-warning font-mono uppercase tracking-widest">Paused — On Break</span>
                }
              </div>
            }

            <!-- Console Actions -->
            <div class="w-full border-t border-border pt-5 flex flex-col gap-2.5 relative z-10">
              @if (!attendance()?.checkIn) {
                <button (click)="onCheckIn()" [disabled]="processing()"
                  class="group w-full py-3 rounded-xl bg-gradient-to-r from-success to-emerald-600 text-white font-bold text-sm shadow-[0_10px_30px_-12px_rgba(34,197,94,0.6)] hover:shadow-[0_14px_40px_-12px_rgba(34,197,94,0.75)] hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Punch In
                </button>
              }

              @if (attendance()?.checkIn && !attendance()?.checkOut) {
                <div class="grid grid-cols-2 gap-2.5">
                  @if (!isOnBreak()) {
                    <button (click)="onBreakStart()" [disabled]="processing()"
                      class="py-2.5 rounded-xl bg-bg-base border border-border hover:border-warning/40 text-warning font-bold text-xs uppercase tracking-wider transition-all hover:bg-warning/5 active:scale-[0.98] disabled:opacity-50">
                      Start Break
                    </button>
                  } @else {
                    <button (click)="onBreakEnd()" [disabled]="processing()"
                      class="py-2.5 rounded-xl bg-warning text-bg-base font-black text-xs uppercase tracking-wider shadow-[0_8px_24px_-8px_rgba(245,158,11,0.6)] hover:bg-amber-400 active:scale-[0.98] transition-all disabled:opacity-50">
                      End Break
                    </button>
                  }
                  <button (click)="promptCheckOut()" [disabled]="processing()"
                    class="py-2.5 rounded-xl bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/25 hover:border-danger font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50">
                    Punch Out
                  </button>
                </div>
              }

              @if (attendance()?.checkIn && attendance()?.checkOut) {
                <div class="text-center py-4 px-3 bg-bg-base border border-success/20 rounded-xl">
                  <p class="text-xs text-success font-bold mb-1 inline-flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Shift Complete
                  </p>
                  <span class="text-[11px] text-text-muted font-mono">Worked {{ formatMinutes(attendance()?.workedMinutes || 0) }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- ========== Stats + History ========== -->
        <div class="lg:col-span-2 flex flex-col gap-6">

          <!-- Stat tiles -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
            <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5" title="Minutes you arrived after your scheduled start time, this month.">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Late Arrivals</span>
                <div class="w-7 h-7 rounded-lg flex items-center justify-center"
                     [ngClass]="totalLateMinutes() > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-display font-extrabold text-white font-mono tabular-nums">{{ totalLateMinutes() }}</span>
                <span class="text-xs text-text-muted">mins past start, this month</span>
              </div>
            </div>

            <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Leave Balance</span>
                <div class="w-7 h-7 rounded-lg bg-accent-subtle text-accent flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>
                </div>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-display font-extrabold text-white font-mono tabular-nums">{{ annualLeavesRemaining() }}</span>
                <span class="text-xs text-text-muted">days available</span>
              </div>
            </div>

            <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Days Present</span>
                <div class="w-7 h-7 rounded-lg bg-success/10 text-success flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-display font-extrabold text-white font-mono tabular-nums">{{ presentCount() }}</span>
                <span class="text-xs text-text-muted">this month</span>
              </div>
            </div>
          </div>

          <!-- History -->
          <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 class="section-title"><span class="dot"></span>Attendance Log</h2>
              <span class="text-[10px] uppercase font-bold tracking-widest text-text-muted">{{ historyLogs().length }} entries</span>
            </div>

            <div class="overflow-x-auto hide-scrollbar">
              <table class="hr-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Duration</th>
                    <th class="text-center">Status</th>
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
                          <span class="chip-dot"></span>{{ item.status }}
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
                          <p class="text-sm">No attendance logs yet.</p>
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

      <!-- ========== Confirm Modal ========== -->
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

  statusPillClasses = computed(() => {
    const att = this.attendance();
    if (att?.checkIn && !att.checkOut && !this.isOnBreak())
      return 'bg-success/10 text-success border-success/25';
    if (this.isOnBreak()) return 'bg-warning/10 text-warning border-warning/25';
    if (att?.checkIn && att?.checkOut)
      return 'bg-accent-subtle text-accent border-accent/30';
    // Idle (not punched in yet) is neutral — not an error state.
    return 'bg-bg-base text-text-secondary border-border';
  });

  /** Header badge: a quick "what state am I in?" hint for the page header. */
  myBadge = computed(() => {
    const att = this.attendance();
    if (this.isOnBreak()) return 'On Break';
    if (att?.checkIn && !att.checkOut) return 'On the clock';
    if (att?.checkIn && att.checkOut) return 'Shift complete';
    return 'Not punched in';
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

  // ─── Live Clock ───────────────────────────────
  startClockTicking() {
    this.clockSub = interval(1000)
      .pipe(startWith(0))
      .subscribe(() => {
        const d = new Date();
        this.tickingTime = d.toLocaleTimeString('en-US', { hour12: false });
        this.tickingDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      });
  }

  // ─── Data Loaders ─────────────────────────────
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

  // ─── Console Actions ──────────────────────────
  onCheckIn() {
    this.processing.set(true);
    this.hrService.checkIn().subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.attendance.set(res.data);
          this.checkAndStartShiftTimer();
          this.loadHistory();
        }
      },
      error: () => this.processing.set(false)
    });
  }

  promptCheckOut() {
    this.confirmRequest.set({
      title: 'Punch Out for the day?',
      message: 'You\'re about to end today\'s shift. You won\'t be able to punch in again until tomorrow.',
      confirmLabel: 'Yes, Punch Out',
      cancelLabel: 'Keep Working',
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
        }
      },
      error: () => this.processing.set(false)
    });
  }

  // ─── Confirm Modal ────────────────────────────
  cancelConfirm() { this.confirmRequest.set(null); }
  executeConfirm() {
    const req = this.confirmRequest();
    this.confirmRequest.set(null);
    req?.onConfirm();
  }

  // ─── View Helpers ─────────────────────────────
  isOnBreak(): boolean {
    const att = this.attendance();
    if (!att || att.breaks.length === 0) return false;
    const lastBreak = att.breaks[att.breaks.length - 1];
    return !lastBreak.end;
  }

  getStatusLabel(): string {
    const att = this.attendance();
    if (!att) return 'Not Checked In';
    if (att.checkOut) return 'Shift Completed';
    if (this.isOnBreak()) return 'On Break';
    return `Checked In · ${att.status}`;
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
