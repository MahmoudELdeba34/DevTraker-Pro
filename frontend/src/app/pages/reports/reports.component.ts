import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ReportService, ReportSummaryResponse } from '../../services/report.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/types';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      <!-- Header -->
      <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight text-white">
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              Workload Analytics & Timesheets
            </span>
          </h1>
          <p class="text-slate-400 text-sm mt-1">Monitor working hours, project contributions, and automated overtime tracking.</p>
        </div>
        <div class="flex items-center gap-3">
          <a routerLink="/dashboard" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            Back to Dashboard
          </a>
          <a *ngIf="isAdmin()" routerLink="/admin" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 rounded-lg transition duration-200">
            Admin Panel
          </a>
        </div>
      </div>

      <!-- Controls Panel (Filters) -->
      <div class="max-w-7xl mx-auto bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          
          <!-- User Selector (Admin/Manager only) -->
          <div class="flex flex-col gap-2" *ngIf="isPrivileged()">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee</label>
            <select [(ngModel)]="selectedUserId" (change)="onFilterChange()"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500">
              <option *ngFor="let u of systemUsers()" [value]="u._id">{{ u.name }} ({{ u.role }})</option>
            </select>
          </div>

          <!-- Start Date -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Start Date</label>
            <input type="date" [(ngModel)]="startDate" (change)="onFilterChange()"
                   class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 font-mono" />
          </div>

          <!-- End Date -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">End Date</label>
            <input type="date" [(ngModel)]="endDate" (change)="onFilterChange()"
                   class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 font-mono" />
          </div>

          <!-- Clear Filters Button -->
          <div>
            <button (click)="resetFilters()"
                    class="w-full px-4 py-2 text-sm bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 rounded-lg transition duration-200">
              Reset Filters
            </button>
          </div>

        </div>
      </div>

      <!-- Main Layout -->
      <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8" *ngIf="reportData()">
        
        <!-- Sidebar: Stats Overview -->
        <div class="lg:col-span-1 flex flex-col gap-6">
          
          <!-- Summary Cards -->
          <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6">
            <h2 class="text-lg font-bold text-white border-b border-slate-800/50 pb-4">Workload Summary</h2>
            
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-sm">Total Logged Time</span>
              <span class="text-2xl font-black text-white font-mono">{{ reportData()?.summary?.totalHours }}h</span>
            </div>
            
            <div class="flex items-center justify-between border-t border-slate-800/30 pt-4">
              <span class="text-slate-400 text-sm">Regular Hours <span class="text-xs text-slate-500">(max 7h/day)</span></span>
              <span class="text-lg font-bold text-purple-400 font-mono">{{ reportData()?.summary?.totalRegularHours }}h</span>
            </div>
            
            <div class="flex items-center justify-between border-t border-slate-800/30 pt-4">
              <span class="text-slate-400 text-sm">Overtime Time</span>
              <span class="text-lg font-bold text-pink-500 font-mono">{{ reportData()?.summary?.totalOvertimeHours }}h</span>
            </div>

            <div class="flex items-center justify-between border-t border-slate-800/30 pt-4">
              <span class="text-slate-400 text-sm">Days Worked</span>
              <span class="text-lg font-bold text-slate-300 font-mono">{{ reportData()?.summary?.daysWorkedCount }} days</span>
            </div>
          </div>

          <!-- Profile Badge -->
          <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex items-center gap-4">
            <div class="w-12 h-12 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-black text-white text-lg">
              {{ reportData()?.user?.name?.substring(0, 2)?.toUpperCase() }}
            </div>
            <div>
              <div class="font-bold text-white">{{ reportData()?.user?.name }}</div>
              <div class="text-slate-400 text-xs mt-0.5">{{ reportData()?.user?.email }}</div>
              <div class="inline-block px-2 py-0.5 mt-2 bg-slate-950 border border-slate-800/80 text-[10px] text-purple-400 rounded uppercase tracking-wider font-semibold">
                {{ reportData()?.user?.role }}
              </div>
            </div>
          </div>

        </div>

        <!-- Timesheet Data & Visualization -->
        <div class="lg:col-span-2 flex flex-col gap-8">
          
          <!-- Stacked Bar Chart -->
          <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-lg font-bold text-white mb-6">Daily Workload Chart</h2>
            
            <div *ngIf="(reportData()?.days?.length ?? 0) === 0" class="py-16 text-center text-slate-500">
              No timesheet data available to plot.
            </div>

            <!-- CSS Bar Chart Grid -->
            <div *ngIf="(reportData()?.days?.length ?? 0) > 0" class="flex flex-col gap-4">
              <!-- Y-Axis Labels & Bars Workspace -->
              <div class="flex h-64 gap-3 items-end border-b border-l border-slate-850 pb-2 pl-2">
                
                <div *ngFor="let day of reportData()?.days" class="flex-1 flex flex-col justify-end items-center group h-full relative">
                  
                  <!-- Floating popover detail -->
                  <div class="absolute bottom-full mb-2 bg-slate-900 border border-slate-800 text-[10px] p-2.5 rounded-lg opacity-0 group-hover:opacity-100 shadow-2xl pointer-events-none transition duration-150 z-20 w-32 flex flex-col gap-1">
                    <span class="font-bold text-slate-300">{{ day.date | date:'MMM d, y' }}</span>
                    <span class="text-purple-400">Regular: {{ day.regularHours }}h</span>
                    <span class="text-pink-400">Overtime: {{ day.overtimeHours }}h</span>
                    <span class="border-t border-slate-800/50 pt-1 text-slate-400 font-bold">Total: {{ day.totalHours }}h</span>
                  </div>

                  <!-- Stacked Bar Column -->
                  <div class="w-full max-w-[40px] flex flex-col justify-end rounded-t overflow-hidden bg-slate-950 border border-slate-900 h-full">
                    
                    <!-- Overtime Segment (Top) -->
                    <div class="bg-gradient-to-t from-pink-600 to-red-500 hover:brightness-110 transition duration-100"
                         [style.height.%]="(day.overtimeHours / getMaxDailyHours()) * 100">
                    </div>
                    
                    <!-- Regular Hours Segment (Bottom) -->
                    <div class="bg-gradient-to-t from-purple-600 to-indigo-500 border-t border-purple-500/20 hover:brightness-110 transition duration-100"
                         [style.height.%]="(day.regularHours / getMaxDailyHours()) * 100">
                    </div>
                    
                  </div>

                  <!-- Bar label (Date) -->
                  <span class="text-[9px] text-slate-500 mt-2 font-mono whitespace-nowrap rotate-45 md:rotate-0">
                    {{ day.date.substring(5) }}
                  </span>

                </div>

              </div>
              
              <!-- Legend indicators -->
              <div class="flex justify-end gap-6 text-[10px] text-slate-400 mt-2">
                <span class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded"></span>
                  Regular Hours (<= 7h)
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 bg-gradient-to-tr from-pink-600 to-red-500 rounded"></span>
                  Overtime Hours (> 7h)
                </span>
              </div>
            </div>
          </div>

          <!-- Timesheet Breakdown Table -->
          <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-lg font-bold text-white mb-6">Timesheet Breakdown</h2>
            
            <div class="flex flex-col gap-4">
              <div *ngFor="let day of reportData()?.days" class="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/20">
                <!-- Day Header -->
                <div class="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 class="font-bold text-sm text-slate-200">{{ day.date | date:'EEEE, MMM d, y' }}</h3>
                    <p class="text-xs text-slate-500 mt-0.5">Tasks worked: {{ day.tasks.length }}</p>
                  </div>
                  <div class="text-right">
                    <div class="font-black text-white text-sm font-mono">{{ day.totalHours }} hrs</div>
                    <div class="text-[10px] text-slate-400 mt-0.5 flex gap-2 justify-end">
                      <span>Reg: <strong class="text-purple-400 font-mono">{{ day.regularHours }}h</strong></span>
                      <span *ngIf="day.overtimeHours > 0">OT: <strong class="text-pink-400 font-mono">{{ day.overtimeHours }}h</strong></span>
                    </div>
                  </div>
                </div>

                <!-- Day Tasks Details -->
                <div class="divide-y divide-slate-800/30">
                  <div *ngFor="let task of day.tasks" class="p-4 flex flex-col md:flex-row justify-between md:items-center gap-2 hover:bg-slate-900/10">
                    <div>
                      <div class="text-xs font-semibold text-slate-300">{{ task.title }}</div>
                      <div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Project: {{ task.projectTitle }}</div>
                    </div>
                    <div class="text-[11px] font-bold text-slate-400 font-mono md:text-right bg-slate-900 px-2 py-0.5 rounded border border-slate-850 w-fit">
                      {{ task.hours }} hrs
                    </div>
                  </div>
                </div>
              </div>

              <div *ngIf="(reportData()?.days?.length ?? 0) === 0" class="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No logs recorded in this period.
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ReportsComponent implements OnInit {
  private reportService = inject(ReportService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  selectedUserId = '';
  startDate = '';
  endDate = '';

  systemUsers = signal<User[]>([]);
  reportData = signal<ReportSummaryResponse | null>(null);

  ngOnInit() {
    // Read route query parameters (for redirect from user lists)
    this.route.queryParams.subscribe(params => {
      const qUserId = params['userId'];
      const currentUser = this.authService.currentUser();
      
      this.selectedUserId = qUserId || currentUser?._id || '';
      
      // Load users list if manager or admin
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
      error: (err) => {
        console.error('Fetch reports error:', err);
        alert('Failed to load report summary data.');
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
    return max + 1; // Add padding
  }
}
