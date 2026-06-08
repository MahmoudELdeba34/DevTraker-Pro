import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HRService } from '../../services/hr.service';
import { Leave, Permission, Overtime } from '../../models/types';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';

type TabKey = 'leaves' | 'permissions' | 'overtime';

@Component({
  selector: 'app-request-center',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent],
  template: `
    <div class="page-ambient pb-12 animate-fade-up">

      <app-page-header
        eyebrow="HR Services"
        title="Request Center"
        description="File a leave, a permission (short hourly time-off), or claim overtime. HR receives your request immediately and you'll be notified when it's decided."
        [steps]="[
          { label: 'Pick a request type', description: 'Leaves, Permissions, or Overtime — pick what fits your need.', tone: 'do' },
          { label: 'Fill the form', description: 'Add dates, times, and a reason. Attach a file if required.', tone: 'do' },
          { label: 'HR decides', description: 'A notification arrives once HR approves or rejects — usually within 1–2 working days.', tone: 'wait' }
        ]"
        [tips]="[
          { title: 'Leave vs Permission', body: 'Leave is full days off. Permission is hourly (e.g. late arrival or early leave).' },
          { title: 'Overtime needs proof', body: 'Add a short reason and your manager will confirm the extra hours.' },
          { title: 'Want it back?', body: 'You can cancel any pending request from the history list on the right.' }
        ]"
      >
        <div header-actions class="flex items-center gap-2">
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated border border-border">
            <span class="w-2 h-2 rounded-full bg-warning"></span>
            <span class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Pending</span>
            <span class="text-sm font-mono font-extrabold text-white">{{ pendingCountAll() }}</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated border border-border">
            <span class="w-2 h-2 rounded-full bg-success"></span>
            <span class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Approved</span>
            <span class="text-sm font-mono font-extrabold text-white">{{ approvedCountAll() }}</span>
          </div>
        </div>
      </app-page-header>

      <!-- Tabs -->
      <div class="bg-bg-elevated border border-border rounded-xl p-1 mb-6 inline-flex gap-1 relative">
        <button (click)="activeTab.set('leaves')"
          class="relative px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 inline-flex items-center gap-2"
          [ngClass]="activeTab() === 'leaves' ? 'bg-bg-base text-white shadow-card' : 'text-text-secondary hover:text-white'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               [class.text-accent]="activeTab() === 'leaves'">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
          </svg>
          Leaves
          @if (pendingLeavesCount() > 0) {
            <span class="ml-1 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-mono font-bold">{{ pendingLeavesCount() }}</span>
          }
        </button>

        <button (click)="activeTab.set('permissions')"
          class="relative px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 inline-flex items-center gap-2"
          [ngClass]="activeTab() === 'permissions' ? 'bg-bg-base text-white shadow-card' : 'text-text-secondary hover:text-white'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               [class.text-info]="activeTab() === 'permissions'">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Permissions
          @if (pendingPermsCount() > 0) {
            <span class="ml-1 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-mono font-bold">{{ pendingPermsCount() }}</span>
          }
        </button>

        <button (click)="activeTab.set('overtime')"
          class="relative px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 inline-flex items-center gap-2"
          [ngClass]="activeTab() === 'overtime' ? 'bg-bg-base text-white shadow-card' : 'text-text-secondary hover:text-white'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               [class.text-warning]="activeTab() === 'overtime'">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Overtime
          @if (pendingOvertimeCount() > 0) {
            <span class="ml-1 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-mono font-bold">{{ pendingOvertimeCount() }}</span>
          }
        </button>
      </div>

      <!-- Feedback -->
      @if (error()) {
        <div class="flex items-center gap-3 p-3.5 mb-5 bg-danger/10 border border-danger/25 text-danger rounded-xl animate-fade-up">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p class="text-sm font-medium">{{ error() }}</p>
        </div>
      }
      @if (successMessage()) {
        <div class="flex items-center gap-3 p-3.5 mb-5 bg-success/10 border border-success/25 text-success rounded-xl animate-fade-up">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
          <p class="text-sm font-medium">{{ successMessage() }}</p>
        </div>
      }

      <!-- Content -->
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 tab-panel" [attr.data-tab]="activeTab()">

        <!-- ─── FORM COLUMN ─────────────────────────── -->
        <div class="xl:col-span-1">
          <div class="bg-bg-elevated border border-border rounded-2xl p-6 relative overflow-hidden">
            <!-- subtle accent line at top -->
            <div class="absolute top-0 left-0 right-0 h-px"
                 [style.background]="topAccentGradient()"></div>

            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-xl border flex items-center justify-center"
                   [ngClass]="iconWrapperClass()">
                <ng-container [ngSwitch]="activeTab()">
                  <svg *ngSwitchCase="'leaves'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>
                  <svg *ngSwitchCase="'permissions'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <svg *ngSwitchCase="'overtime'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </ng-container>
              </div>
              <div>
                <h2 class="text-base font-display font-bold text-white">{{ formTitle() }}</h2>
                <p class="text-xs text-text-muted mt-0.5">{{ formSubtitle() }}</p>
              </div>
            </div>

            <!-- LEAVES FORM -->
            @if (activeTab() === 'leaves') {
              <form [formGroup]="leaveForm" (ngSubmit)="submitLeave()" class="flex flex-col gap-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Leave Type</label>
                  <select formControlName="leaveType" class="field">
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="emergency">Emergency Leave</option>
                  </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Start Date</label>
                    <input type="date" formControlName="startDate" class="field font-mono" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">End Date</label>
                    <input type="date" formControlName="endDate" class="field font-mono" />
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Reason</label>
                  <textarea formControlName="reason" rows="3" placeholder="Brief explanation..." class="field resize-none"></textarea>
                </div>
                <button type="submit" [disabled]="leaveForm.invalid || sending()" class="btn-accent w-full mt-2">
                  @if (sending()) {
                    <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  }
                  Submit Leave Request
                </button>
              </form>
            }

            <!-- PERMISSIONS FORM -->
            @if (activeTab() === 'permissions') {
              <form [formGroup]="permissionForm" (ngSubmit)="submitPermission()" class="flex flex-col gap-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Request Type</label>
                  <select formControlName="type" class="field">
                    <option value="hourly">Hourly Permission</option>
                    <option value="late_arrival">Waive Late Arrival</option>
                    <option value="early_leave">Early Dismissal</option>
                    <option value="remote">Work from Home</option>
                    <option value="correction">Timecard Correction</option>
                  </select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Date</label>
                  <input type="date" formControlName="date" class="field font-mono" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">From</label>
                    <input type="time" formControlName="fromTime" class="field font-mono" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">To</label>
                    <input type="time" formControlName="toTime" class="field font-mono" />
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Reason</label>
                  <textarea formControlName="reason" rows="3" placeholder="Provide justification..." class="field resize-none"></textarea>
                </div>
                <button type="submit" [disabled]="permissionForm.invalid || sending()" class="btn-accent w-full mt-2">
                  @if (sending()) {
                    <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  }
                  Submit Permission
                </button>
              </form>
            }

            <!-- OVERTIME FORM -->
            @if (activeTab() === 'overtime') {
              <form [formGroup]="overtimeForm" (ngSubmit)="submitOvertime()" class="flex flex-col gap-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Date Worked</label>
                  <input type="date" formControlName="date" class="field font-mono" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Start</label>
                    <input type="time" formControlName="startTime" class="field font-mono" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">End</label>
                    <input type="time" formControlName="endTime" class="field font-mono" />
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">Work Description</label>
                  <textarea formControlName="reason" rows="3" placeholder="Tasks completed during overtime..." class="field resize-none"></textarea>
                </div>
                <button type="submit" [disabled]="overtimeForm.invalid || sending()" class="btn-accent w-full mt-2">
                  @if (sending()) {
                    <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  }
                  Log Overtime
                </button>
              </form>
            }
          </div>
        </div>

        <!-- ─── HISTORY COLUMN ───────────────────────── -->
        <div class="xl:col-span-2">
          <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 class="section-title"><span class="dot"></span>Request History</h2>
              <span class="text-[10px] uppercase font-bold text-text-muted tracking-widest">{{ currentHistoryCount() }} entries</span>
            </div>

            <!-- LEAVES HISTORY -->
            @if (activeTab() === 'leaves') {
              <div class="overflow-x-auto hide-scrollbar">
                <table class="hr-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Duration</th>
                      <th>Period</th>
                      <th class="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of leaves(); track item._id) {
                      <tr>
                        <td>
                          <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-accent-subtle text-accent flex items-center justify-center">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>
                            </div>
                            <span class="font-bold text-white capitalize">{{ item.leaveType }}</span>
                          </div>
                        </td>
                        <td><span class="font-mono text-white">{{ item.durationDays }} day{{ item.durationDays > 1 ? 's' : '' }}</span></td>
                        <td class="font-mono text-text-muted text-[11px]">{{ item.startDate | date:'MMM d' }} → {{ item.endDate | date:'MMM d, y' }}</td>
                        <td class="text-right">
                          <span class="chip" [ngClass]="statusChip(item.status)">
                            <span class="chip-dot"></span>{{ item.status }}
                          </span>
                        </td>
                      </tr>
                    }
                    @if (leaves().length === 0) {
                      <tr><td colspan="4">
                        <div class="flex flex-col items-center justify-center text-text-muted py-12 gap-3">
                          <div class="w-14 h-14 rounded-full bg-bg-base border border-border flex items-center justify-center">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <p class="text-sm">No leave requests yet.</p>
                          <span class="text-[11px] text-text-faint">Submit your first request from the panel on the left.</span>
                        </div>
                      </td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- PERMISSIONS HISTORY -->
            @if (activeTab() === 'permissions') {
              <div class="overflow-x-auto hide-scrollbar">
                <table class="hr-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Interval</th>
                      <th class="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of permissions(); track item._id) {
                      <tr>
                        <td>
                          <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-info/10 text-info flex items-center justify-center">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                            <span class="font-bold text-white capitalize">{{ item.type.replace('_', ' ') }}</span>
                          </div>
                        </td>
                        <td class="font-mono text-text-muted text-[11px]">{{ item.date | date:'MMM d, y' }}</td>
                        <td>
                          <span class="font-mono text-white text-[11px]">{{ item.fromTime }} – {{ item.toTime }}</span>
                          <span class="ml-2 text-[10px] text-text-muted font-mono">({{ item.durationMinutes }}m)</span>
                        </td>
                        <td class="text-right">
                          <span class="chip" [ngClass]="statusChip(item.status)">
                            <span class="chip-dot"></span>{{ item.status }}
                          </span>
                        </td>
                      </tr>
                    }
                    @if (permissions().length === 0) {
                      <tr><td colspan="4">
                        <div class="flex flex-col items-center justify-center text-text-muted py-12 gap-3">
                          <div class="w-14 h-14 rounded-full bg-bg-base border border-border flex items-center justify-center">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </div>
                          <p class="text-sm">No permissions logged.</p>
                        </div>
                      </td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- OVERTIME HISTORY -->
            @if (activeTab() === 'overtime') {
              <div class="overflow-x-auto hide-scrollbar">
                <table class="hr-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Interval</th>
                      <th>Hours / Rate</th>
                      <th class="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of overtime(); track item._id) {
                      <tr>
                        <td>
                          <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                            </div>
                            <span class="font-bold text-white font-mono">{{ item.date | date:'MMM d, y' }}</span>
                          </div>
                        </td>
                        <td><span class="font-mono text-white text-[11px]">{{ item.startTime }} – {{ item.endTime }}</span></td>
                        <td>
                          <div class="flex flex-col gap-0.5">
                            <span class="text-white font-bold text-xs">{{ item.durationHours }} hrs</span>
                            <span class="text-[10px] text-warning font-mono uppercase tracking-wider">{{ item.multiplier }}× rate</span>
                          </div>
                        </td>
                        <td class="text-right">
                          <span class="chip" [ngClass]="statusChip(item.status)">
                            <span class="chip-dot"></span>{{ item.status }}
                          </span>
                        </td>
                      </tr>
                    }
                    @if (overtime().length === 0) {
                      <tr><td colspan="4">
                        <div class="flex flex-col items-center justify-center text-text-muted py-12 gap-3">
                          <div class="w-14 h-14 rounded-full bg-bg-base border border-border flex items-center justify-center">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          </div>
                          <p class="text-sm">No overtime records yet.</p>
                        </div>
                      </td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RequestCenterComponent implements OnInit {
  private hrService = inject(HRService);
  private fb = inject(FormBuilder);

  activeTab = signal<TabKey>('leaves');
  sending = signal(false);
  error = signal('');
  successMessage = signal('');

  leaves = signal<Leave[]>([]);
  permissions = signal<Permission[]>([]);
  overtime = signal<Overtime[]>([]);

  leaveForm!: FormGroup;
  permissionForm!: FormGroup;
  overtimeForm!: FormGroup;

  // ─── Derived counts ───────────────────────────
  pendingLeavesCount    = computed(() => this.leaves().filter(l => l.status === 'pending').length);
  pendingPermsCount     = computed(() => this.permissions().filter(p => p.status === 'pending').length);
  pendingOvertimeCount  = computed(() => this.overtime().filter(o => o.status === 'pending').length);
  pendingCountAll       = computed(() => this.pendingLeavesCount() + this.pendingPermsCount() + this.pendingOvertimeCount());
  approvedCountAll      = computed(() =>
    this.leaves().filter(l => l.status === 'approved').length +
    this.permissions().filter(p => p.status === 'approved').length +
    this.overtime().filter(o => o.status === 'approved').length
  );

  currentHistoryCount = computed(() => {
    switch (this.activeTab()) {
      case 'leaves':      return this.leaves().length;
      case 'permissions': return this.permissions().length;
      case 'overtime':    return this.overtime().length;
    }
  });

  formTitle = computed(() => ({
    leaves: 'New Leave Request',
    permissions: 'New Permission',
    overtime: 'Log Overtime',
  }[this.activeTab()]));

  formSubtitle = computed(() => ({
    leaves: 'Apply for annual, sick, unpaid, or emergency leave',
    permissions: 'Hourly permissions, late arrivals, remote work',
    overtime: 'Log extra hours worked beyond your schedule',
  }[this.activeTab()]));

  topAccentGradient = computed(() => {
    switch (this.activeTab()) {
      case 'leaves':      return 'linear-gradient(90deg, transparent, #6366F1, transparent)';
      case 'permissions': return 'linear-gradient(90deg, transparent, #38BDF8, transparent)';
      case 'overtime':    return 'linear-gradient(90deg, transparent, #F59E0B, transparent)';
    }
  });

  iconWrapperClass = computed(() => {
    switch (this.activeTab()) {
      case 'leaves':      return 'bg-accent-subtle text-accent border-accent/20';
      case 'permissions': return 'bg-info/10 text-info border-info/20';
      case 'overtime':    return 'bg-warning/10 text-warning border-warning/20';
    }
  });

  ngOnInit() {
    this.initForms();
    this.loadLeaves();
    this.loadPermissions();
    this.loadOvertime();
  }

  initForms() {
    this.leaveForm = this.fb.group({
      leaveType: ['annual', Validators.required],
      startDate: ['', Validators.required],
      endDate:   ['', Validators.required],
      reason:    ['', [Validators.required, Validators.minLength(5)]],
    });
    this.permissionForm = this.fb.group({
      type:     ['hourly', Validators.required],
      date:     ['', Validators.required],
      fromTime: ['', Validators.required],
      toTime:   ['', Validators.required],
      reason:   ['', [Validators.required, Validators.minLength(5)]],
    });
    this.overtimeForm = this.fb.group({
      date:      ['', Validators.required],
      startTime: ['', Validators.required],
      endTime:   ['', Validators.required],
      reason:    ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  loadLeaves()      { this.hrService.getMyLeaves().subscribe({ next: (r) => { if (r.success) this.leaves.set(r.data); } }); }
  loadPermissions() { this.hrService.getMyPermissions().subscribe({ next: (r) => { if (r.success) this.permissions.set(r.data); } }); }
  loadOvertime()    { this.hrService.getMyOvertime().subscribe({ next: (r) => { if (r.success) this.overtime.set(r.data); } }); }

  // ─── Submissions ───────────────────────────────
  submitLeave() {
    if (this.leaveForm.invalid) return;
    this.flushMessages();
    this.sending.set(true);
    this.hrService.requestLeave(this.leaveForm.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.successMessage.set('Leave request submitted successfully.');
          this.leaveForm.reset({ leaveType: 'annual' });
          this.loadLeaves();
          this.autoDismiss();
        }
      },
      error: (err) => { this.sending.set(false); this.error.set(err.error?.error || 'Failed to submit leave request.'); },
    });
  }

  submitPermission() {
    if (this.permissionForm.invalid) return;
    this.flushMessages();
    this.sending.set(true);
    this.hrService.requestPermission(this.permissionForm.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.successMessage.set('Permission request submitted successfully.');
          this.permissionForm.reset({ type: 'hourly' });
          this.loadPermissions();
          this.autoDismiss();
        }
      },
      error: (err) => { this.sending.set(false); this.error.set(err.error?.error || 'Failed to submit permission.'); },
    });
  }

  submitOvertime() {
    if (this.overtimeForm.invalid) return;
    this.flushMessages();
    this.sending.set(true);
    this.hrService.requestOvertime(this.overtimeForm.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.successMessage.set('Overtime logged successfully.');
          this.overtimeForm.reset();
          this.loadOvertime();
          this.autoDismiss();
        }
      },
      error: (err) => { this.sending.set(false); this.error.set(err.error?.error || 'Failed to log overtime.'); },
    });
  }

  // ─── Helpers ───────────────────────────────────
  statusChip(status: string): string {
    if (status === 'approved') return 'chip-success';
    if (status === 'rejected') return 'chip-danger';
    if (status === 'pending')  return 'chip-warning';
    return 'chip-muted';
  }

  private flushMessages() { this.error.set(''); this.successMessage.set(''); }
  private autoDismiss() {
    setTimeout(() => { this.successMessage.set(''); this.error.set(''); }, 4000);
  }
}
