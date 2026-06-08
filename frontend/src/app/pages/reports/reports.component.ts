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
    <div class="h-full flex flex-col gap-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-display font-bold text-white tracking-tight">Reports</h1>
          <p class="text-sm text-text-secondary mt-1">Monitor working hours, project contributions, and overtime tracking.</p>
        </div>
        <div class="flex items-center gap-3">
          @if (isAdmin()) {
            <a routerLink="/admin" class="px-4 py-2 text-sm bg-bg-elevated border border-border hover:bg-bg-hover text-text-secondary hover:text-white rounded-lg transition duration-200">
              Admin Panel
            </a>
          }
        </div>
      </div>

      <!-- Controls Panel (Filters) -->
      <div class="bg-bg-elevated border border-border rounded-xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          
          <!-- User Selector (Admin/Manager only) -->
          @if (isPrivileged()) {
            <div class="flex flex-col gap-2">
              <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Employee</label>
              <select [(ngModel)]="selectedUserId" (change)="onFilterChange()"
                      class="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors">
                @for (u of systemUsers(); track u._id) {
                  <option [value]="u._id">{{ u.name }} ({{ u.role }})</option>
                }
              </select>
            </div>
          }

          <!-- Start Date -->
          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Start Date</label>
            <input type="date" [(ngModel)]="startDate" (change)="onFilterChange()"
                   class="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors color-scheme-dark" />
          </div>

          <!-- End Date -->
          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">End Date</label>
            <input type="date" [(ngModel)]="endDate" (change)="onFilterChange()"
                   class="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors color-scheme-dark" />
          </div>

          <!-- Reset Filters Button -->
          <div>
            <button (click)="resetFilters()"
                    class="w-full px-4 py-2 text-sm bg-bg-base hover:bg-bg-hover border border-border text-text-muted hover:text-white rounded-lg transition duration-200">
              Reset Filters
            </button>
          </div>

        </div>
      </div>

      <!-- Main Layout -->
      @if (reportData()) {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Sidebar: Stats Overview -->
          <div class="lg:col-span-1 flex flex-col gap-6">
            
            <!-- Summary Cards -->
            <div class="bg-bg-elevated border border-border rounded-xl p-6 flex flex-col gap-5">
              <h2 class="text-lg font-bold text-white border-b border-border pb-4">Workload Summary</h2>
              
              <div class="flex items-center justify-between">
                <span class="text-text-secondary text-sm">Total Logged Time</span>
                <span class="text-2xl font-black text-white font-mono">{{ reportData()?.summary?.totalHours }}h</span>
              </div>
              
              <div class="flex items-center justify-between border-t border-border pt-4">
                <span class="text-text-secondary text-sm">Regular Hours <span class="text-xs text-text-muted">(max 7h/day)</span></span>
                <span class="text-lg font-bold text-accent font-mono">{{ reportData()?.summary?.totalRegularHours }}h</span>
              </div>
              
              <div class="flex items-center justify-between border-t border-border pt-4">
                <span class="text-text-secondary text-sm">Overtime Time</span>
                <span class="text-lg font-bold text-danger font-mono">{{ reportData()?.summary?.totalOvertimeHours }}h</span>
              </div>

              <div class="flex items-center justify-between border-t border-border pt-4">
                <span class="text-text-secondary text-sm">Days Worked</span>
                <span class="text-lg font-bold text-white font-mono">{{ reportData()?.summary?.daysWorkedCount }} days</span>
              </div>
            </div>

            <!-- Profile Badge -->
            <div class="bg-bg-elevated border border-border rounded-xl p-6 flex items-center gap-4">
              <div class="w-12 h-12 bg-accent rounded-full flex items-center justify-center font-black text-white text-lg">
                {{ reportData()?.user?.name?.substring(0, 2)?.toUpperCase() }}
              </div>
              <div>
                <div class="font-bold text-white">{{ reportData()?.user?.name }}</div>
                <div class="text-text-muted text-xs mt-0.5">{{ reportData()?.user?.email }}</div>
                <div class="inline-block px-2 py-0.5 mt-2 bg-accent/10 border border-accent/20 text-[10px] text-accent rounded uppercase tracking-wider font-semibold">
                  {{ reportData()?.user?.role }}
                </div>
              </div>
            </div>

          </div>

          <!-- Timesheet Data & Visualization -->
          <div class="lg:col-span-2 flex flex-col gap-6">
            
            <!-- CSS Bar Chart -->
            <div class="bg-bg-elevated border border-border rounded-xl p-6">
              <h2 class="text-lg font-bold text-white mb-6">Daily Workload Chart</h2>
              
              @if ((reportData()?.days?.length ?? 0) === 0) {
                <div class="py-16 text-center text-text-muted">No timesheet data available to plot.</div>
              }

              @if ((reportData()?.days?.length ?? 0) > 0) {
                <div class="flex flex-col gap-4">
                  <div class="flex h-64 gap-3 items-end border-b border-l border-border pb-2 pl-2">
                    @for (day of reportData()?.days; track day.date) {
                      <div class="flex-1 flex flex-col justify-end items-center group h-full relative">
                        
                        <!-- Floating popover -->
                        <div class="absolute bottom-full mb-2 bg-bg-elevated border border-border text-[10px] p-2.5 rounded-lg opacity-0 group-hover:opacity-100 shadow-modal pointer-events-none transition duration-150 z-20 w-32 flex flex-col gap-1">
                          <span class="font-bold text-text-secondary">{{ day.date | date:'MMM d, y' }}</span>
                          <span class="text-accent">Regular: {{ day.regularHours }}h</span>
                          <span class="text-danger">Overtime: {{ day.overtimeHours }}h</span>
                          <span class="border-t border-border pt-1 text-white font-bold">Total: {{ day.totalHours }}h</span>
                        </div>

                        <!-- Stacked Bar -->
                        <div class="w-full max-w-[40px] flex flex-col justify-end rounded-t overflow-hidden bg-bg-base border border-border/50 h-full">
                          <!-- Overtime (Top) -->
                          <div class="bg-gradient-to-t from-danger to-red-400"
                               [style.height.%]="(day.overtimeHours / getMaxDailyHours()) * 100">
                          </div>
                          <!-- Regular (Bottom) -->
                          <div class="bg-gradient-to-t from-accent to-indigo-400 border-t border-accent/20"
                               [style.height.%]="(day.regularHours / getMaxDailyHours()) * 100">
                          </div>
                        </div>

                        <span class="text-[9px] text-text-muted mt-2 font-mono whitespace-nowrap rotate-45 md:rotate-0">
                          {{ day.date.substring(5) }}
                        </span>
                      </div>
                    }
                  </div>
                  
                  <!-- Legend -->
                  <div class="flex justify-end gap-6 text-[10px] text-text-muted mt-2">
                    <span class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 bg-accent rounded"></span>
                      Regular Hours (&lt;= 7h)
                    </span>
                    <span class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 bg-danger rounded"></span>
                      Overtime Hours (&gt; 7h)
                    </span>
                  </div>
                </div>
              }
            </div>

            <!-- Timesheet Breakdown Table -->
            <div class="bg-bg-elevated border border-border rounded-xl overflow-hidden">
              <div class="px-6 py-4 border-b border-border">
                <h2 class="text-lg font-bold text-white">Timesheet Breakdown</h2>
              </div>
              
              <div class="flex flex-col divide-y divide-border">
                @for (day of reportData()?.days; track day.date) {
                  <div class="overflow-hidden">
                    <!-- Day Header -->
                    <div class="p-4 bg-bg-base/50 flex items-center justify-between">
                      <div>
                        <h3 class="font-bold text-sm text-white">{{ day.date | date:'EEEE, MMM d, y' }}</h3>
                        <p class="text-xs text-text-muted mt-0.5">Tasks worked: {{ day.tasks.length }}</p>
                      </div>
                      <div class="text-right">
                        <div class="font-black text-white text-sm font-mono">{{ day.totalHours }} hrs</div>
                        <div class="text-[10px] text-text-muted mt-0.5 flex gap-2 justify-end">
                          <span>Reg: <strong class="text-accent font-mono">{{ day.regularHours }}h</strong></span>
                          @if (day.overtimeHours > 0) {
                            <span>OT: <strong class="text-danger font-mono">{{ day.overtimeHours }}h</strong></span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Day Tasks -->
                    <div class="divide-y divide-border/50">
                      @for (task of day.tasks; track task.title) {
                        <div class="p-4 flex flex-col md:flex-row justify-between md:items-center gap-2 hover:bg-bg-hover/30 transition-colors">
                          <div>
                            <div class="text-xs font-semibold text-white">{{ task.title }}</div>
                            <div class="text-[10px] text-text-muted mt-1 uppercase tracking-wider">Project: {{ task.projectTitle }}</div>
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
                    No logs recorded in this period.
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
            <span class="text-sm font-medium">Loading report...</span>
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
