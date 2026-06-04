import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HRService } from '../../services/hr.service';
import { Attendance } from '../../models/types';
import { Subscription, interval, startWith } from 'rxjs';

@Component({
  selector: 'app-employee-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      
      <!-- Top navbar -->
      <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight text-white">
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              Employee Workspace
            </span>
          </h1>
          <p class="text-slate-400 text-sm mt-1">Punch in, manage breaks, track attendance logs, and file requests.</p>
        </div>
        <div class="flex items-center gap-3">
          <a routerLink="/dashboard" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            Back to Dashboard
          </a>
          <a routerLink="/reports" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            My Reports
          </a>
          <a routerLink="/request-center" class="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow-lg shadow-purple-900/30 transition duration-200">
            Request Leave / Permission
          </a>
        </div>
      </div>

      <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Live Check-in / Break Terminal -->
        <div class="lg:col-span-1 flex flex-col gap-6">
          <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center text-center gap-6 shadow-2xl relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
            
            <div class="flex flex-col items-center">
              <span class="text-xs uppercase font-mono tracking-widest text-slate-400">Current Time</span>
              <h2 class="text-4xl font-black text-white mt-1.5 font-mono tracking-tight">{{ tickingTime }}</h2>
              <span class="text-[10px] text-slate-500 font-medium font-mono mt-1 uppercase">{{ tickingDate }}</span>
            </div>

            <!-- Status Indicator Pulse -->
            <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold"
                 [ngClass]="{
                   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': attendance()?.checkIn && !attendance()?.checkOut && !isOnBreak(),
                   'bg-amber-500/10 text-amber-400 border-amber-500/20': isOnBreak(),
                   'bg-red-500/10 text-red-400 border-red-500/20': !attendance()?.checkIn || attendance()?.checkOut
                 }">
              <span class="w-2 h-2 rounded-full"
                    [ngClass]="{
                      'bg-emerald-400 animate-pulse': attendance()?.checkIn && !attendance()?.checkOut && !isOnBreak(),
                      'bg-amber-400 animate-pulse': isOnBreak(),
                      'bg-red-400': !attendance()?.checkIn || attendance()?.checkOut
                    }"></span>
              {{ getStatusLabel() }}
            </div>

            <!-- Timer Widget -->
            <div *ngIf="attendance()?.checkIn && !attendance()?.checkOut" class="flex flex-col items-center border-t border-slate-800/60 pt-4 w-full">
              <span class="text-[10px] uppercase font-mono tracking-widest text-slate-500">Active Shift Timer</span>
              <h3 class="text-3xl font-extrabold text-slate-200 mt-1 font-mono tracking-tight">{{ activeWorkTimer }}</h3>
            </div>

            <!-- Clock Console Controls -->
            <div class="flex flex-col gap-3 w-full border-t border-slate-800/60 pt-6">
              
              <!-- Check-In Button -->
              <button *ngIf="!attendance()?.checkIn" (click)="onCheckIn()" [disabled]="processing()"
                      class="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/20 transition duration-200 active:scale-[0.98] disabled:opacity-50">
                PUNCH IN
              </button>

              <!-- Break Start/End -->
              <div *ngIf="attendance()?.checkIn && !attendance()?.checkOut" class="grid grid-cols-2 gap-3 w-full">
                <button *ngIf="!isOnBreak()" (click)="onBreakStart()" [disabled]="processing()"
                        class="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-amber-400 font-bold rounded-xl transition duration-200 active:scale-[0.98] disabled:opacity-50">
                  START BREAK
                </button>
                <button *ngIf="isOnBreak()" (click)="onBreakEnd()" [disabled]="processing()"
                        class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 transition duration-200 active:scale-[0.98] disabled:opacity-50">
                  END BREAK
                </button>
                
                <!-- Check-Out Button -->
                <button (click)="onCheckOut()" [disabled]="processing()"
                        class="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-950/20 transition duration-200 active:scale-[0.98] disabled:opacity-50">
                  PUNCH OUT
                </button>
              </div>

              <!-- Finished state -->
              <div *ngIf="attendance()?.checkIn && attendance()?.checkOut" class="text-center py-4 bg-slate-950/40 border border-slate-800 rounded-xl">
                <p class="text-xs text-slate-400 font-medium">Daily shift completed successfully! 🎉</p>
                <span class="text-[10px] text-slate-500 font-mono mt-1 block">Worked duration: {{ formatMinutes(attendance()?.workedMinutes || 0) }}</span>
              </div>

            </div>
          </div>
        </div>

        <!-- Sidebar / Grid: Summary widgets & history list -->
        <div class="lg:col-span-2 flex flex-col gap-8">
          
          <!-- Summary Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-2">
              <span class="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Lateness Minutes</span>
              <span class="text-2xl font-black text-rose-500 font-mono">{{ totalLateMinutes() }} mins</span>
            </div>
            <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-2">
              <span class="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Leave Balance</span>
              <span class="text-2xl font-black text-purple-400 font-mono">{{ annualLeavesRemaining() }} days</span>
            </div>
            <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-2">
              <span class="text-slate-500 text-[11px] font-bold uppercase tracking-wider">This Month Present</span>
              <span class="text-2xl font-black text-emerald-400 font-mono">{{ presentCount() }} days</span>
            </div>
          </div>

          <!-- History Logs -->
          <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-lg font-bold text-white mb-4">My Attendance Log</h2>
            
            <div class="overflow-x-auto rounded-xl border border-slate-800/80">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium font-mono">
                    <th class="p-4">Date</th>
                    <th class="p-4">Check In</th>
                    <th class="p-4">Check Out</th>
                    <th class="p-4">Duration</th>
                    <th class="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                  <tr *ngFor="let item of historyLogs()" class="hover:bg-slate-800/10">
                    <td class="p-4 text-slate-300 font-medium">{{ item.date | date:'EEE, MMM d, y' }}</td>
                    <td class="p-4 text-slate-400 font-mono">{{ item.checkIn ? (item.checkIn | date:'h:mm:ss a') : '-' }}</td>
                    <td class="p-4 text-slate-400 font-mono">{{ item.checkOut ? (item.checkOut | date:'h:mm:ss a') : '-' }}</td>
                    <td class="p-4 text-slate-300 font-mono">{{ formatMinutes(item.workedMinutes) }}</td>
                    <td class="p-4 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider"
                            [ngClass]="{
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': item.status === 'Present',
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20': item.status === 'Absent',
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20': item.status === 'Late' || item.status === 'Early Leave',
                              'bg-purple-500/10 text-purple-400 border border-purple-500/20': item.status === 'On Leave'
                            }">
                        {{ item.status }}
                      </span>
                    </td>
                  </tr>
                  <tr *ngIf="historyLogs().length === 0">
                    <td colspan="5" class="text-center py-8 text-slate-500">No attendance logs available.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  `,
})
export class EmployeeHomeComponent implements OnInit, OnDestroy {
  private hrService = inject(HRService);

  attendance = signal<Attendance | null>(null);
  historyLogs = signal<Attendance[]>([]);
  processing = signal(false);

  // Digital clock ticking values
  tickingTime = '--:--:--';
  tickingDate = '';
  private clockSub?: Subscription;

  // Work Shift active duration timer
  activeWorkTimer = '00:00:00';
  private timerSub?: Subscription;

  // Stats summaries
  totalLateMinutes = signal(0);
  annualLeavesRemaining = signal(21);
  presentCount = signal(0);

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
        this.tickingTime = d.toLocaleTimeString('en-US', { hour12: false });
        this.tickingDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
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
          
          // Calculate summary statistics
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
    
    // Timer only runs if check-in is logged, but not check-out yet
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
        }
      },
      error: () => this.processing.set(false)
    });
  }

  onCheckOut() {
    if (!confirm('Are you sure you want to Check-Out and finish your current shift?')) return;
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
    if (this.isOnBreak()) return 'On Active Break';
    return `Checked In — ${att.status}`;
  }

  formatMinutes(mins: number): string {
    if (!mins) return '0 hrs';
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs === 0) return `${m}m`;
    return `${hrs}h ${m}m`;
  }

  private formatMsToTimer(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }
}
