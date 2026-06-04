import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HRService } from '../../services/hr.service';
import { AuthService } from '../../services/auth.service';
import {
  EmployeeWithProfile,
  Attendance,
  Leave,
  Permission,
  Overtime
} from '../../models/types';

@Component({
  selector: 'app-admin-hr-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      <!-- Top header -->
      <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white tracking-tight">
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              Admin & HR Control Center
            </span>
          </h1>
          <p class="text-slate-400 text-sm mt-1">Manage employee profiles, adjust timesheets, and approve requests.</p>
        </div>
        <div class="flex items-center gap-3">
          <a routerLink="/dashboard" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            Back to Dashboard
          </a>
          <a routerLink="/employee-home" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            Clock Terminal
          </a>
          <a *ngIf="isAccountantOrAdmin()" routerLink="/payroll-workspace" class="px-4 py-2 text-sm bg-purple-650 hover:bg-purple-600 border border-purple-500/30 text-white font-medium rounded-lg transition duration-200 shadow-lg shadow-purple-950/20">
            Payroll Workspace
          </a>
        </div>
      </div>

      <!-- Stats overview grid -->
      <div class="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-1.5">
          <span class="text-slate-500 text-[10px] font-bold uppercase tracking-wider font-mono">Total Staff</span>
          <span class="text-3xl font-black text-white font-mono">{{ employees().length }}</span>
        </div>
        <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-1.5">
          <span class="text-slate-500 text-[10px] font-bold uppercase tracking-wider font-mono">Present Today</span>
          <span class="text-3xl font-black text-emerald-400 font-mono">{{ presentTodayCount() }}</span>
        </div>
        <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-1.5">
          <span class="text-slate-500 text-[10px] font-bold uppercase tracking-wider font-mono">Pending Requests</span>
          <span class="text-3xl font-black text-amber-400 font-mono">{{ totalPendingCount() }}</span>
        </div>
        <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-1.5">
          <span class="text-slate-500 text-[10px] font-bold uppercase tracking-wider font-mono">On Active Break</span>
          <span class="text-3xl font-black text-purple-400 font-mono">{{ onBreakCount() }}</span>
        </div>
      </div>

      <!-- Tab selectors -->
      <div class="max-w-7xl mx-auto mb-8 border-b border-slate-850 flex gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <button (click)="activeTab.set('overview')" [class.border-purple-500]="activeTab() === 'overview'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200"
                [ngClass]="activeTab() === 'overview' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Today's Attendance
        </button>
        <button (click)="activeTab.set('registry')" [class.border-purple-500]="activeTab() === 'registry'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200"
                [ngClass]="activeTab() === 'registry' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Employee Registry
        </button>
        <button (click)="activeTab.set('leaves')" [class.border-purple-500]="activeTab() === 'leaves'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200 relative"
                [ngClass]="activeTab() === 'leaves' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Leaves Approval
          <span *ngIf="pendingLeaves().length > 0" class="absolute -top-1.5 -right-3.5 bg-red-650 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full scale-90">{{ pendingLeaves().length }}</span>
        </button>
        <button (click)="activeTab.set('permissions')" [class.border-purple-500]="activeTab() === 'permissions'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200 relative"
                [ngClass]="activeTab() === 'permissions' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Permissions Approval
          <span *ngIf="pendingPermissions().length > 0" class="absolute -top-1.5 -right-3.5 bg-red-650 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full scale-90">{{ pendingPermissions().length }}</span>
        </button>
        <button (click)="activeTab.set('overtime')" [class.border-purple-500]="activeTab() === 'overtime'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200 relative"
                [ngClass]="activeTab() === 'overtime' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Overtime Log Approval
          <span *ngIf="pendingOvertime().length > 0" class="absolute -top-1.5 -right-3.5 bg-red-650 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full scale-90">{{ pendingOvertime().length }}</span>
        </button>
      </div>

      <!-- Main workspace -->
      <div class="max-w-7xl mx-auto">
        @if (error()) {
          <div class="p-4 mb-6 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold">{{ error() }}</div>
        }
        @if (success()) {
          <div class="p-4 mb-6 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-semibold">{{ success() }}</div>
        }

        <!-- 1. Today's Attendance Tab -->
        <div *ngIf="activeTab() === 'overview'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Attendance List -->
          <div class="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-4">Today's Timesheets</h2>
            <div class="overflow-x-auto rounded-xl border border-slate-800/80">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium font-mono">
                    <th class="p-4">Employee</th>
                    <th class="p-4">Check In</th>
                    <th class="p-4">Check Out</th>
                    <th class="p-4">Duration</th>
                    <th class="p-4">Break Time</th>
                    <th class="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                  <tr *ngFor="let item of todayAttendance()" class="hover:bg-slate-800/10">
                    <td class="p-4">
                      <div class="font-semibold text-slate-200">{{ getEmployeeName(item.userId) }}</div>
                      <div class="text-[10px] text-slate-500">{{ getEmployeeEmail(item.userId) }}</div>
                    </td>
                    <td class="p-4 text-slate-400 font-mono">{{ item.checkIn ? (item.checkIn | date:'h:mm:ss a') : '-' }}</td>
                    <td class="p-4 text-slate-400 font-mono">{{ item.checkOut ? (item.checkOut | date:'h:mm:ss a') : '-' }}</td>
                    <td class="p-4 text-slate-300 font-mono">{{ formatMinutes(item.workedMinutes) }}</td>
                    <td class="p-4 text-slate-400 font-mono">{{ formatBreakMinutes(item) }}</td>
                    <td class="p-4 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider"
                            [ngClass]="{
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': item.status === 'Present',
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20': item.status === 'Absent',
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20': ['Late', 'Early Leave', 'Half Day'].includes(item.status),
                              'bg-purple-500/10 text-purple-400 border border-purple-500/20': item.status === 'On Leave'
                            }">
                        {{ item.status }}
                      </span>
                    </td>
                  </tr>
                  <tr *ngIf="todayAttendance().length === 0">
                    <td colspan="6" class="text-center py-8 text-slate-500 font-medium">No attendance logs logged today yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Adjust Timecard Panel -->
          <div class="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-4">Adjust Attendance</h2>
            <form [formGroup]="adjustForm" (ngSubmit)="submitAdjust()" class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Employee *</label>
                <select formControlName="userId" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                  <option value="">-- Choose Employee --</option>
                  <option *ngFor="let emp of employees()" [value]="emp._id">{{ emp.name }} ({{ emp.role }})</option>
                </select>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Date *</label>
                <input type="date" formControlName="date" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Check In Time</label>
                  <input type="time" formControlName="checkIn" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Check Out Time</label>
                  <input type="time" formControlName="checkOut" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status Override *</label>
                <select formControlName="status" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                  <option value="Early Leave">Early Leave</option>
                  <option value="Half Day">Half Day</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Adjustment Reason *</label>
                <textarea formControlName="reason" rows="2" placeholder="Explain the adjustment..." class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"></textarea>
              </div>
              <button type="submit" [disabled]="adjustForm.invalid || processing()"
                      class="mt-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition duration-200">
                Apply Correction
              </button>
            </form>
          </div>
        </div>

        <!-- 2. Employee Registry Tab -->
        <div *ngIf="activeTab() === 'registry'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Registry Table -->
          <div class="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-4">Employee Roster</h2>
            <div class="overflow-x-auto rounded-xl border border-slate-800/80">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                    <th class="p-4">Name</th>
                    <th class="p-4">Department & Title</th>
                    <th class="p-4">System Role</th>
                    <th class="p-4">Salary info</th>
                    <th class="p-4 text-center">Status</th>
                    <th class="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                  <tr *ngFor="let item of employees()" class="hover:bg-slate-800/10">
                    <td class="p-4">
                      <div class="font-bold text-slate-200">{{ item.name }}</div>
                      <div class="text-[10px] text-slate-500">{{ item.email }}</div>
                    </td>
                    <td class="p-4">
                      <div class="text-slate-300 font-medium">{{ item.profile?.roleTitle || 'No Title' }}</div>
                      <div class="text-[10px] text-slate-500 font-mono">{{ item.profile?.department || 'No Dept' }}</div>
                    </td>
                    <td class="p-4 font-mono text-purple-400 capitalize">{{ item.role }}</td>
                    <td class="p-4 text-slate-350">
                      <div *ngIf="item.profile?.basicSalary" class="font-mono text-slate-200">
                        {{ item.profile!.basicSalary | currency }} / {{ item.profile!.salaryType || 'monthly' }}
                      </div>
                      <div *ngIf="!item.profile?.basicSalary" class="text-slate-500">Not Configured</div>
                    </td>
                    <td class="p-4 text-center">
                      <span class="px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider"
                            [ngClass]="{
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': item.profile?.status === 'active',
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20': item.profile?.status === 'suspended' || item.profile?.status === 'resigned'
                            }">
                        {{ item.profile?.status || 'New / Draft' }}
                      </span>
                    </td>
                    <td class="p-4 text-right">
                      <button (click)="selectEmployee(item)"
                              class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-purple-400 border border-slate-800 hover:border-purple-500/30 rounded font-medium transition duration-200">
                        Edit HR Details
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Edit Profile Panel -->
          <div class="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-4">Edit Profile</h2>
            <div *ngIf="!selectedEmployee()" class="text-center py-12 text-slate-500 border border-dashed border-slate-850 rounded-xl">
              Select an employee from the table to modify their HR profile details.
            </div>

            <form *ngIf="selectedEmployee()" [formGroup]="profileForm" (ngSubmit)="submitProfile()" class="flex flex-col gap-4">
              <div class="border-b border-slate-800/80 pb-3">
                <h3 class="text-sm font-bold text-purple-400">{{ selectedEmployee()?.name }}</h3>
                <p class="text-[10px] text-slate-500">{{ selectedEmployee()?.email }}</p>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">System Authorization Role</label>
                <select formControlName="role" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="hr">HR Specialist</option>
                  <option value="accountant">Accountant</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Department</label>
                  <input type="text" formControlName="department" placeholder="e.g. Engineering" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-250" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Role Title</label>
                  <input type="text" formControlName="roleTitle" placeholder="e.g. Lead Dev" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-250" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Basic Salary</label>
                  <input type="number" formControlName="basicSalary" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-250 font-mono" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Salary Type</label>
                  <select formControlName="salaryType" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Work Days / Wk</label>
                  <input type="number" formControlName="workingDays" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-250 font-mono" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Work Hours / Day</label>
                  <input type="number" formControlName="workingHours" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-250 font-mono" />
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Annual Vacation Balance (Days)</label>
                <input type="number" formControlName="annualLeaveBalance" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-250 font-mono" />
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hiring Status</label>
                <select formControlName="status" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="resigned">Resigned</option>
                </select>
              </div>

              <div class="flex gap-2.5 mt-4">
                <button type="submit" [disabled]="profileForm.invalid || processing()"
                        class="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition duration-200">
                  Save Changes
                </button>
                <button type="button" (click)="selectedEmployee.set(null)"
                        class="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-lg text-xs transition duration-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- 3. Leaves Tab -->
        <div *ngIf="activeTab() === 'leaves'" class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
          <h2 class="text-base font-bold text-white mb-4">Pending Leave Requests</h2>
          <div class="overflow-x-auto rounded-xl border border-slate-800/80">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                  <th class="p-4">Employee</th>
                  <th class="p-4">Leave Type</th>
                  <th class="p-4">Start Date</th>
                  <th class="p-4">End Date</th>
                  <th class="p-4">Duration</th>
                  <th class="p-4">Reason</th>
                  <th class="p-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                <tr *ngFor="let item of pendingLeaves()" class="hover:bg-slate-800/10">
                  <td class="p-4">
                    <div class="font-bold text-slate-200">{{ getEmployeeName(item.userId) }}</div>
                    <div class="text-[10px] text-slate-500">{{ getEmployeeEmail(item.userId) }}</div>
                  </td>
                  <td class="p-4 font-semibold uppercase text-purple-400">{{ item.leaveType }}</td>
                  <td class="p-4 text-slate-350 font-mono">{{ item.startDate | date:'MMM d, y' }}</td>
                  <td class="p-4 text-slate-350 font-mono">{{ item.endDate | date:'MMM d, y' }}</td>
                  <td class="p-4 text-slate-200 font-mono font-medium">{{ item.durationDays }} days</td>
                  <td class="p-4 text-slate-400 max-w-xs truncate" [title]="item.reason">{{ item.reason }}</td>
                  <td class="p-4 text-right flex justify-end gap-2">
                    <button (click)="onApproveLeave(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-[11px] transition duration-200">
                      Approve
                    </button>
                    <button (click)="onPromptRejectLeave(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-[11px] transition duration-200">
                      Reject
                    </button>
                  </td>
                </tr>
                <tr *ngIf="pendingLeaves().length === 0">
                  <td colspan="7" class="text-center py-8 text-slate-500">No pending leave requests to process.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. Permissions Tab -->
        <div *ngIf="activeTab() === 'permissions'" class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
          <h2 class="text-base font-bold text-white mb-4">Pending Hourly Permissions & Late Exceptions</h2>
          <div class="overflow-x-auto rounded-xl border border-slate-800/80">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                  <th class="p-4">Employee</th>
                  <th class="p-4">Permission Type</th>
                  <th class="p-4">Date</th>
                  <th class="p-4">Time Interval</th>
                  <th class="p-4">Duration</th>
                  <th class="p-4">Reason</th>
                  <th class="p-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                <tr *ngFor="let item of pendingPermissions()" class="hover:bg-slate-800/10">
                  <td class="p-4">
                    <div class="font-bold text-slate-200">{{ getEmployeeName(item.userId) }}</div>
                    <div class="text-[10px] text-slate-500">{{ getEmployeeEmail(item.userId) }}</div>
                  </td>
                  <td class="p-4 font-semibold uppercase text-blue-400">{{ item.type.replace('_', ' ') }}</td>
                  <td class="p-4 text-slate-350 font-mono">{{ item.date | date:'MMM d, y' }}</td>
                  <td class="p-4 text-slate-400 font-mono">{{ item.fromTime }} - {{ item.toTime }}</td>
                  <td class="p-4 text-slate-200 font-mono font-medium">{{ item.durationMinutes }} mins</td>
                  <td class="p-4 text-slate-400 max-w-xs truncate" [title]="item.reason">{{ item.reason }}</td>
                  <td class="p-4 text-right flex justify-end gap-2">
                    <button (click)="onApprovePermission(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-[11px] transition duration-200">
                      Approve
                    </button>
                    <button (click)="onRejectPermission(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-[11px] transition duration-200">
                      Reject
                    </button>
                  </td>
                </tr>
                <tr *ngIf="pendingPermissions().length === 0">
                  <td colspan="7" class="text-center py-8 text-slate-500">No pending hourly permission requests to process.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 5. Overtime Tab -->
        <div *ngIf="activeTab() === 'overtime'" class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
          <h2 class="text-base font-bold text-white mb-4">Pending Overtime Request Claims</h2>
          <div class="overflow-x-auto rounded-xl border border-slate-800/80">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                  <th class="p-4">Employee</th>
                  <th class="p-4">Work Date</th>
                  <th class="p-4">Interval</th>
                  <th class="p-4">Hours</th>
                  <th class="p-4">Multiplier</th>
                  <th class="p-4">Reason</th>
                  <th class="p-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                <tr *ngFor="let item of pendingOvertime()" class="hover:bg-slate-800/10">
                  <td class="p-4">
                    <div class="font-bold text-slate-200">{{ getEmployeeName(item.userId) }}</div>
                    <div class="text-[10px] text-slate-500">{{ getEmployeeEmail(item.userId) }}</div>
                  </td>
                  <td class="p-4 text-slate-350 font-mono">{{ item.date | date:'MMM d, y' }}</td>
                  <td class="p-4 text-slate-400 font-mono">{{ item.startTime }} - {{ item.endTime }}</td>
                  <td class="p-4 text-slate-200 font-mono font-medium">{{ item.durationHours }} hrs</td>
                  <td class="p-4 text-purple-400 font-mono font-bold">{{ item.multiplier }}x</td>
                  <td class="p-4 text-slate-400 max-w-xs truncate" [title]="item.reason">{{ item.reason }}</td>
                  <td class="p-4 text-right flex justify-end gap-2">
                    <button (click)="onApproveOvertime(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-[11px] transition duration-200">
                      Approve
                    </button>
                    <button (click)="onRejectOvertime(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-[11px] transition duration-200">
                      Reject
                    </button>
                  </td>
                </tr>
                <tr *ngIf="pendingOvertime().length === 0">
                  <td colspan="7" class="text-center py-8 text-slate-500">No pending overtime logs.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class AdminHrPortalComponent implements OnInit {
  private hrService = inject(HRService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  activeTab = signal<'overview' | 'registry' | 'leaves' | 'permissions' | 'overtime'>('overview');
  processing = signal(false);
  error = signal('');
  success = signal('');

  employees = signal<EmployeeWithProfile[]>([]);
  todayAttendance = signal<Attendance[]>([]);
  pendingLeaves = signal<Leave[]>([]);
  pendingPermissions = signal<Permission[]>([]);
  pendingOvertime = signal<Overtime[]>([]);

  selectedEmployee = signal<EmployeeWithProfile | null>(null);

  adjustForm!: FormGroup;
  profileForm!: FormGroup;

  ngOnInit() {
    this.initForms();
    this.loadAllData();
  }

  initForms() {
    this.adjustForm = this.fb.group({
      userId: ['', Validators.required],
      date: ['', Validators.required],
      checkIn: [''],
      checkOut: [''],
      status: ['Present', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.profileForm = this.fb.group({
      role: ['employee', Validators.required],
      department: [''],
      roleTitle: [''],
      basicSalary: [0, [Validators.required, Validators.min(0)]],
      salaryType: ['monthly', Validators.required],
      workingDays: [5, [Validators.required, Validators.min(1), Validators.max(7)]],
      workingHours: [8, [Validators.required, Validators.min(1), Validators.max(24)]],
      annualLeaveBalance: [21, [Validators.required, Validators.min(0)]],
      status: ['active', Validators.required]
    });
  }

  loadAllData() {
    this.loadEmployees();
    this.loadTodayAttendance();
    this.loadPendingLeaves();
    this.loadPendingPermissions();
    this.loadPendingOvertime();
  }

  loadEmployees() {
    this.hrService.getEmployees().subscribe({
      next: (res) => {
        if (res.success) this.employees.set(res.data);
      }
    });
  }

  loadTodayAttendance() {
    this.hrService.getTodayAdminAttendance().subscribe({
      next: (res) => {
        if (res.success) this.todayAttendance.set(res.data);
      }
    });
  }

  loadPendingLeaves() {
    this.hrService.getPendingLeaves().subscribe({
      next: (res) => {
        if (res.success) this.pendingLeaves.set(res.data);
      }
    });
  }

  loadPendingPermissions() {
    this.hrService.getPendingPermissions().subscribe({
      next: (res) => {
        if (res.success) this.pendingPermissions.set(res.data);
      }
    });
  }

  loadPendingOvertime() {
    this.hrService.getPendingOvertime().subscribe({
      next: (res) => {
        if (res.success) this.pendingOvertime.set(res.data);
      }
    });
  }

  isAccountantOrAdmin(): boolean {
    const role = this.authService.currentUser()?.role;
    return ['admin', 'hr', 'accountant'].includes(role || '');
  }

  // Helper mappings
  getEmployeeName(userId: string | any): string {
    const idStr = typeof userId === 'object' ? userId._id : userId;
    const emp = this.employees().find(e => e._id === idStr);
    if (emp) return emp.name;
    if (typeof userId === 'object' && userId.name) return userId.name;
    return 'Unknown Employee';
  }

  getEmployeeEmail(userId: string | any): string {
    const idStr = typeof userId === 'object' ? userId._id : userId;
    const emp = this.employees().find(e => e._id === idStr);
    if (emp) return emp.email;
    if (typeof userId === 'object' && userId.email) return userId.email;
    return '';
  }

  presentTodayCount(): number {
    return this.todayAttendance().filter(a => ['Present', 'Late', 'Early Leave', 'Half Day'].includes(a.status)).length;
  }

  onBreakCount(): number {
    return this.todayAttendance().filter(a => {
      if (a.checkOut || a.breaks.length === 0) return false;
      const last = a.breaks[a.breaks.length - 1];
      return !last.end;
    }).length;
  }

  totalPendingCount(): number {
    return this.pendingLeaves().length + this.pendingPermissions().length + this.pendingOvertime().length;
  }

  formatMinutes(mins: number): string {
    if (!mins) return '-';
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs === 0) return `${m}m`;
    return `${hrs}h ${m}m`;
  }

  formatBreakMinutes(att: Attendance): string {
    let totalMs = 0;
    att.breaks.forEach(b => {
      const end = b.end ? new Date(b.end).getTime() : Date.now();
      totalMs += (end - new Date(b.start).getTime());
    });
    const mins = Math.floor(totalMs / 60000);
    return mins > 0 ? `${mins} mins` : '0m';
  }

  // Adjust Attendance
  submitAdjust() {
    if (this.adjustForm.invalid) return;
    this.processing.set(true);
    this.error.set('');
    this.success.set('');

    this.hrService.adjustAttendance(this.adjustForm.value).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.success.set('Timesheet updated successfully.');
          this.adjustForm.reset({ status: 'Present' });
          this.loadTodayAttendance();
        }
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Failed to adjust timesheet.');
      }
    });
  }

  // Employee Profile selection and edit
  selectEmployee(emp: EmployeeWithProfile) {
    this.selectedEmployee.set(emp);
    this.profileForm.reset({
      role: emp.role,
      department: emp.profile?.department || '',
      roleTitle: emp.profile?.roleTitle || '',
      basicSalary: emp.profile?.basicSalary || 0,
      salaryType: emp.profile?.salaryType || 'monthly',
      workingDays: emp.profile?.workingDays || 5,
      workingHours: emp.profile?.workingHours || 8,
      annualLeaveBalance: emp.profile?.annualLeaveBalance || 21,
      status: emp.profile?.status || 'active'
    });
  }

  submitProfile() {
    if (this.profileForm.invalid || !this.selectedEmployee()) return;
    this.processing.set(true);
    this.error.set('');
    this.success.set('');

    const userId = this.selectedEmployee()!._id;
    this.hrService.updateProfile(userId, this.profileForm.value).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.success.set('Employee profile successfully updated.');
          this.selectedEmployee.set(null);
          this.loadEmployees();
        }
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Failed to update employee details.');
      }
    });
  }

  // Leaves Decision
  onApproveLeave(id: string) {
    if (!confirm('Approve this leave request?')) return;
    this.processing.set(true);
    this.hrService.approveLeave(id).subscribe({
      next: () => {
        this.processing.set(false);
        this.success.set('Leave request approved.');
        this.loadPendingLeaves();
        this.loadEmployees(); // Reload balances
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Approval failed.');
      }
    });
  }

  onPromptRejectLeave(id: string) {
    const reason = prompt('Enter a reason for rejecting this leave:');
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
      alert('A rejection reason is required.');
      return;
    }
    this.processing.set(true);
    this.hrService.rejectLeave(id, reason).subscribe({
      next: () => {
        this.processing.set(false);
        this.success.set('Leave request rejected.');
        this.loadPendingLeaves();
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Rejection failed.');
      }
    });
  }

  // Permissions Decision
  onApprovePermission(id: string) {
    if (!confirm('Approve this permission exception?')) return;
    this.processing.set(true);
    this.hrService.approvePermission(id).subscribe({
      next: () => {
        this.processing.set(false);
        this.success.set('Permission request approved.');
        this.loadPendingPermissions();
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Approval failed.');
      }
    });
  }

  onRejectPermission(id: string) {
    if (!confirm('Reject this permission exception?')) return;
    this.processing.set(true);
    this.hrService.rejectPermission(id).subscribe({
      next: () => {
        this.processing.set(false);
        this.success.set('Permission request rejected.');
        this.loadPendingPermissions();
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Rejection failed.');
      }
    });
  }

  // Overtime Decision
  onApproveOvertime(id: string) {
    if (!confirm('Approve this overtime log entry?')) return;
    this.processing.set(true);
    this.hrService.approveOvertime(id).subscribe({
      next: () => {
        this.processing.set(false);
        this.success.set('Overtime log approved.');
        this.loadPendingOvertime();
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Approval failed.');
      }
    });
  }

  onRejectOvertime(id: string) {
    if (!confirm('Reject this overtime log entry?')) return;
    this.processing.set(true);
    this.hrService.rejectOvertime(id).subscribe({
      next: () => {
        this.processing.set(false);
        this.success.set('Overtime log rejected.');
        this.loadPendingOvertime();
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Rejection failed.');
      }
    });
  }
}
