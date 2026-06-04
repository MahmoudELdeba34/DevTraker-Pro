import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HRService } from '../../services/hr.service';
import { Leave, Permission, Overtime } from '../../models/types';

@Component({
  selector: 'app-request-center',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      <!-- Header -->
      <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white">
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              Employee Request Hub
            </span>
          </h1>
          <p class="text-slate-400 text-sm mt-1">Submit leaves, hourly permissions, and overtime logs for approval.</p>
        </div>
        <div>
          <a routerLink="/employee-home" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            Back to Clock Terminal
          </a>
        </div>
      </div>

      <!-- Tab Selectors -->
      <div class="max-w-7xl mx-auto mb-8 border-b border-slate-850 flex gap-6">
        <button (click)="activeTab.set('leaves')" [class.border-purple-500]="activeTab() === 'leaves'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200"
                [ngClass]="activeTab() === 'leaves' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Leaves & Vacations
        </button>
        <button (click)="activeTab.set('permissions')" [class.border-purple-500]="activeTab() === 'permissions'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200"
                [ngClass]="activeTab() === 'permissions' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Hourly Permissions
        </button>
        <button (click)="activeTab.set('overtime')" [class.border-purple-500]="activeTab() === 'overtime'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200"
                [ngClass]="activeTab() === 'overtime' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Overtime Logs
        </button>
      </div>

      <!-- Main Hub Container -->
      <div class="max-w-7xl mx-auto">
        @if (error()) {
          <div class="p-4 mb-6 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold">{{ error() }}</div>
        }
        @if (successMessage()) {
          <div class="p-4 mb-6 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-semibold">{{ successMessage() }}</div>
        }

        <!-- 1. Leaves Workspace -->
        <div *ngIf="activeTab() === 'leaves'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Request Form -->
          <div class="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-6">File Leave Request</h2>
            <form [formGroup]="leaveForm" (ngSubmit)="submitLeave()" class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Leave Type</label>
                <select formControlName="leaveType" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="emergency">Emergency Leave</option>
                </select>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Start Date</label>
                <input type="date" formControlName="startDate" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">End Date</label>
                <input type="date" formControlName="endDate" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reason</label>
                <textarea formControlName="reason" rows="3" placeholder="Provide description..." class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"></textarea>
              </div>
              <button type="submit" [disabled]="leaveForm.invalid || sending()"
                      class="mt-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs transition duration-200">
                Submit Request
              </button>
            </form>
          </div>

          <!-- History -->
          <div class="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-6">Leave Requests History</h2>
            <div class="overflow-x-auto rounded-xl border border-slate-800/80">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                    <th class="p-4">Type</th>
                    <th class="p-4">Start Date</th>
                    <th class="p-4">End Date</th>
                    <th class="p-4">Duration</th>
                    <th class="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                  <tr *ngFor="let item of leaves()" class="hover:bg-slate-800/10">
                    <td class="p-4 font-semibold uppercase text-purple-400">{{ item.leaveType }}</td>
                    <td class="p-4 text-slate-300 font-mono">{{ item.startDate | date:'MMM d, y' }}</td>
                    <td class="p-4 text-slate-300 font-mono">{{ item.endDate | date:'MMM d, y' }}</td>
                    <td class="p-4 text-slate-350">{{ item.durationDays }} days</td>
                    <td class="p-4 text-center">
                      <span class="px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider"
                            [ngClass]="{
                              'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20': item.status === 'pending',
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': item.status === 'approved',
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20': item.status === 'rejected'
                            }">
                        {{ item.status }}
                      </span>
                    </td>
                  </tr>
                  <tr *ngIf="leaves().length === 0">
                    <td colspan="5" class="text-center py-8 text-slate-500">No leave requests found.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 2. Permissions Workspace -->
        <div *ngIf="activeTab() === 'permissions'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Request Form -->
          <div class="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-6">File Hourly Permission</h2>
            <form [formGroup]="permissionForm" (ngSubmit)="submitPermission()" class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Type</label>
                <select formControlName="type" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                  <option value="hourly">Hourly Permission</option>
                  <option value="late_arrival">Waive Late Arrival</option>
                  <option value="early_leave">Early Dismissal</option>
                  <option value="remote">Work from Home</option>
                  <option value="correction">Timecard Correction</option>
                </select>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date</label>
                <input type="date" formControlName="date" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">From Time</label>
                  <input type="time" formControlName="fromTime" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">To Time</label>
                  <input type="time" formControlName="toTime" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reason</label>
                <textarea formControlName="reason" rows="3" placeholder="Provide description..." class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"></textarea>
              </div>
              <button type="submit" [disabled]="permissionForm.invalid || sending()"
                      class="mt-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs transition duration-200">
                Submit Request
              </button>
            </form>
          </div>

          <!-- History -->
          <div class="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-6">Permissions History</h2>
            <div class="overflow-x-auto rounded-xl border border-slate-800/80">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                    <th class="p-4">Type</th>
                    <th class="p-4">Date</th>
                    <th class="p-4">Interval</th>
                    <th class="p-4">Duration</th>
                    <th class="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                  <tr *ngFor="let item of permissions()" class="hover:bg-slate-800/10">
                    <td class="p-4 font-semibold uppercase text-blue-400">{{ item.type.replace('_', ' ') }}</td>
                    <td class="p-4 text-slate-300 font-mono">{{ item.date | date:'MMM d, y' }}</td>
                    <td class="p-4 text-slate-400 font-mono">{{ item.fromTime }} - {{ item.toTime }}</td>
                    <td class="p-4 text-slate-350 font-mono">{{ item.durationMinutes }} mins</td>
                    <td class="p-4 text-center">
                      <span class="px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider"
                            [ngClass]="{
                              'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20': item.status === 'pending',
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': item.status === 'approved',
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20': item.status === 'rejected'
                            }">
                        {{ item.status }}
                      </span>
                    </td>
                  </tr>
                  <tr *ngIf="permissions().length === 0">
                    <td colspan="5" class="text-center py-8 text-slate-500">No permissions logs found.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 3. Overtime Workspace -->
        <div *ngIf="activeTab() === 'overtime'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Request Form -->
          <div class="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-6">Log Overtime Request</h2>
            <form [formGroup]="overtimeForm" (ngSubmit)="submitOvertime()" class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date</label>
                <input type="date" formControlName="date" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Start Time</label>
                  <input type="time" formControlName="startTime" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">End Time</label>
                  <input type="time" formControlName="endTime" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reason</label>
                <textarea formControlName="reason" rows="3" placeholder="Provide description..." class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"></textarea>
              </div>
              <button type="submit" [disabled]="overtimeForm.invalid || sending()"
                      class="mt-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs transition duration-200">
                Log Overtime
              </button>
            </form>
          </div>

          <!-- History -->
          <div class="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-6">Overtime History</h2>
            <div class="overflow-x-auto rounded-xl border border-slate-800/80">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                    <th class="p-4">Date</th>
                    <th class="p-4">Interval</th>
                    <th class="p-4">Duration</th>
                    <th class="p-4">Rate</th>
                    <th class="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                  <tr *ngFor="let item of overtime()" class="hover:bg-slate-800/10">
                    <td class="p-4 text-slate-300 font-medium font-mono">{{ item.date | date:'MMM d, y' }}</td>
                    <td class="p-4 text-slate-400 font-mono">{{ item.startTime }} - {{ item.endTime }}</td>
                    <td class="p-4 text-slate-350 font-mono">{{ item.durationHours }} hrs</td>
                    <td class="p-4 text-slate-350 font-mono">{{ item.multiplier }}x</td>
                    <td class="p-4 text-center">
                      <span class="px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider"
                            [ngClass]="{
                              'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20': item.status === 'pending',
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': item.status === 'approved',
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20': item.status === 'rejected'
                            }">
                        {{ item.status }}
                      </span>
                    </td>
                  </tr>
                  <tr *ngIf="overtime().length === 0">
                    <td colspan="5" class="text-center py-8 text-slate-500">No overtime logs found.</td>
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
export class RequestCenterComponent implements OnInit {
  private hrService = inject(HRService);
  private fb = inject(FormBuilder);

  activeTab = signal<'leaves' | 'permissions' | 'overtime'>('leaves');
  sending = signal(false);
  error = signal('');
  successMessage = signal('');

  leaves = signal<Leave[]>([]);
  permissions = signal<Permission[]>([]);
  overtime = signal<Overtime[]>([]);

  leaveForm!: FormGroup;
  permissionForm!: FormGroup;
  overtimeForm!: FormGroup;

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
      endDate: ['', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5)]]
    });

    this.permissionForm = this.fb.group({
      type: ['hourly', Validators.required],
      date: ['', Validators.required],
      fromTime: ['', Validators.required],
      toTime: ['', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5)]]
    });

    this.overtimeForm = this.fb.group({
      date: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  loadLeaves() {
    this.hrService.getMyLeaves().subscribe({
      next: (res) => {
        if (res.success) this.leaves.set(res.data);
      }
    });
  }

  loadPermissions() {
    this.hrService.getMyPermissions().subscribe({
      next: (res) => {
        if (res.success) this.permissions.set(res.data);
      }
    });
  }

  loadOvertime() {
    this.hrService.getMyOvertime().subscribe({
      next: (res) => {
        if (res.success) this.overtime.set(res.data);
      }
    });
  }

  submitLeave() {
    if (this.leaveForm.invalid) return;
    this.sending.set(true);
    this.error.set('');
    this.successMessage.set('');

    this.hrService.requestLeave(this.leaveForm.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.successMessage.set('Leave request submitted successfully!');
          this.leaveForm.reset({ leaveType: 'annual' });
          this.loadLeaves();
        }
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err.error?.error || 'Failed to submit leave request');
      }
    });
  }

  submitPermission() {
    if (this.permissionForm.invalid) return;
    this.sending.set(true);
    this.error.set('');
    this.successMessage.set('');

    this.hrService.requestPermission(this.permissionForm.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.successMessage.set('Permission request submitted successfully!');
          this.permissionForm.reset({ type: 'hourly' });
          this.loadPermissions();
        }
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err.error?.error || 'Failed to submit permission request');
      }
    });
  }

  submitOvertime() {
    if (this.overtimeForm.invalid) return;
    this.sending.set(true);
    this.error.set('');
    this.successMessage.set('');

    this.hrService.requestOvertime(this.overtimeForm.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.successMessage.set('Overtime logged successfully!');
          this.overtimeForm.reset();
          this.loadOvertime();
        }
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err.error?.error || 'Failed to submit overtime request');
      }
    });
  }
}
