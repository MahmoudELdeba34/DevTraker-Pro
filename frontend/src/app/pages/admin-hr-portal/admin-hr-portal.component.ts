import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HRService } from '../../services/hr.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { PrintDocumentService } from '../../services/print-document.service';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  ConfirmDialogComponent,
  ConfirmIcon,
  ConfirmVariant,
} from '../../components/ui/confirm-dialog/confirm-dialog.component';
import {
  EmployeeWithProfile,
  Attendance,
  Leave,
  Permission,
  Overtime
} from '../../models/types';

type Tab = 'overview' | 'registry' | 'leaves' | 'permissions' | 'overtime';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  icon?: ConfirmIcon;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
}

@Component({
  selector: 'app-admin-hr-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, ConfirmDialogComponent, TranslatePipe],
  template: `
    <div class="page-ambient pb-12 animate-fade-up" [attr.data-locale]="locale.locale()">

      <app-page-header
        [eyebrow]="locale.t('hrPortal.eyebrow')"
        [title]="locale.t('hrPortal.title')"
        [description]="locale.t('hrPortal.description')"
        [badge]="locale.t('hrPortal.badge')"
        badgeTone="accent"
        [steps]="hrPortalSteps()"
        [tips]="hrPortalTips()"
      >
        <div header-actions class="flex items-center gap-2.5">
          <a routerLink="/employee-home" class="btn-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ 'common.clockTerminal' | translate }}
          </a>
          @if (isAccountantOrAdmin()) {
            <a routerLink="/payroll-workspace" class="btn-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              {{ 'common.payrollWorkspace' | translate }}
            </a>
          }
        </div>
      </app-page-header>

      <!-- Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger">
        <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'hrPortal.stat.totalStaff' | translate }}</span>
            <div class="w-7 h-7 rounded-lg bg-accent-subtle text-accent flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
          </div>
          <div class="text-3xl font-display font-extrabold text-white font-mono tabular-nums">{{ employees().length }}</div>
        </div>
        <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'hrPortal.stat.presentToday' | translate }}</span>
            <div class="w-7 h-7 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div class="text-3xl font-display font-extrabold text-success font-mono tabular-nums">{{ presentTodayCount() }}</div>
        </div>
        <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'hrPortal.stat.pendingRequests' | translate }}</span>
            <div class="w-7 h-7 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            </div>
          </div>
          <div class="text-3xl font-display font-extrabold text-warning font-mono tabular-nums">{{ totalPendingCount() }}</div>
        </div>
        <div class="stat-tile bg-bg-elevated border border-border rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'hrPortal.stat.onBreak' | translate }}</span>
            <div class="w-7 h-7 rounded-lg bg-info/10 text-info flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/></svg>
            </div>
          </div>
          <div class="text-3xl font-display font-extrabold text-info font-mono tabular-nums">{{ onBreakCount() }}</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-bg-elevated border border-border rounded-xl p-1 mb-6 inline-flex gap-1 flex-wrap">
        @for (t of tabs(); track t.key) {
          <button (click)="activeTab.set(t.key)"
            class="relative px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 inline-flex items-center gap-2"
            [ngClass]="activeTab() === t.key ? 'bg-bg-base text-white shadow-card' : 'text-text-secondary hover:text-white'">
            {{ t.label }}
            @if (t.badge && t.badge() > 0) {
              <span class="px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-mono font-bold">{{ t.badge() }}</span>
            }
          </button>
        }
      </div>

      <!-- Tab content -->
      <div class="tab-panel" [attr.data-tab]="activeTab()">

        <!-- ─── Overview ─── -->
        @if (activeTab() === 'overview') {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-bg-elevated border border-border rounded-2xl overflow-hidden">
              <div class="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 class="section-title"><span class="dot"></span>{{ 'hrPortal.section.todayAttendance' | translate }}</h2>
                <span class="text-[10px] uppercase font-bold text-text-muted tracking-widest">{{ locale.t('common.entriesCount', { count: todayAttendance().length }) }}</span>
              </div>
              <div class="overflow-x-auto hide-scrollbar">
                <table class="hr-table">
                  <thead>
                    <tr>
                      <th>{{ 'hrPortal.table.employee' | translate }}</th>
                      <th>{{ 'hrPortal.table.checkIn' | translate }}</th>
                      <th>{{ 'hrPortal.table.checkOut' | translate }}</th>
                      <th>{{ 'hrPortal.table.duration' | translate }}</th>
                      <th>{{ 'hrPortal.table.break' | translate }}</th>
                      <th class="text-center">{{ 'common.status' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of todayAttendance(); track item._id) {
                      <tr>
                        <td>
                          <div class="font-bold text-white">{{ getEmployeeName(item.userId) }}</div>
                          <div class="text-[10px] text-text-muted">{{ getEmployeeEmail(item.userId) }}</div>
                        </td>
                        <td class="font-mono text-text-muted">{{ item.checkIn ? (item.checkIn | date:'h:mm a') : '—' }}</td>
                        <td class="font-mono text-text-muted">{{ item.checkOut ? (item.checkOut | date:'h:mm a') : '—' }}</td>
                        <td class="font-mono text-white font-medium">{{ formatMinutes(item.workedMinutes) }}</td>
                        <td class="font-mono text-text-muted">{{ formatBreakMinutes(item) }}</td>
                        <td class="text-center">
                          <span class="chip" [ngClass]="attendanceChip(item.status)">
                            <span class="chip-dot"></span>{{ attendanceStatusLabel(item.status) }}
                          </span>
                        </td>
                      </tr>
                    }
                    @if (todayAttendance().length === 0) {
                      <tr><td colspan="6" class="text-center py-10 text-text-muted text-xs">{{ 'hrPortal.empty.noAttendanceToday' | translate }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Adjust attendance form -->
            <div class="lg:col-span-1">
              <div class="bg-bg-elevated border border-border rounded-2xl p-6 sticky top-4">
                <h2 class="section-title mb-5"><span class="dot"></span>{{ 'hrPortal.section.adjustTimesheet' | translate }}</h2>
                <form [formGroup]="adjustForm" (ngSubmit)="submitAdjust()" class="flex flex-col gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'hrPortal.form.employeeRequired' | translate }}</label>
                    <select formControlName="userId" class="field">
                      <option value="">{{ 'common.choose' | translate }}</option>
                      @for (emp of employees(); track emp._id) {
                        <option [value]="emp._id">{{ emp.name }} · {{ locale.roleLabel(emp.role) }}</option>
                      }
                    </select>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'hrPortal.form.dateRequired' | translate }}</label>
                    <input type="date" formControlName="date" class="field font-mono" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.checkIn' | translate }}</label>
                      <input type="time" formControlName="checkIn" class="field font-mono" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.checkOut' | translate }}</label>
                      <input type="time" formControlName="checkOut" class="field font-mono" />
                    </div>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'hrPortal.form.statusRequired' | translate }}</label>
                    <select formControlName="status" class="field">
                      <option value="Present">{{ 'attendanceStatus.present' | translate }}</option>
                      <option value="Absent">{{ 'attendanceStatus.absent' | translate }}</option>
                      <option value="Late">{{ 'attendanceStatus.late' | translate }}</option>
                      <option value="Early Leave">{{ 'attendanceStatus.earlyLeave' | translate }}</option>
                      <option value="Half Day">{{ 'attendanceStatus.halfDay' | translate }}</option>
                      <option value="On Leave">{{ 'attendanceStatus.onLeave' | translate }}</option>
                    </select>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'hrPortal.form.reasonRequired' | translate }}</label>
                    <textarea formControlName="reason" rows="2" [placeholder]="'common.whyAdjustmentNeeded' | translate" class="field resize-none"></textarea>
                  </div>
                  <button type="submit" [disabled]="adjustForm.invalid || processing()" class="btn-accent w-full mt-1">
                    @if (processing()) {
                      <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    }
                    {{ 'hrPortal.form.applyCorrection' | translate }}
                  </button>
                </form>
              </div>
            </div>
          </div>
        }

        <!-- ─── Registry ─── -->
        @if (activeTab() === 'registry') {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-bg-elevated border border-border rounded-2xl overflow-hidden">
              <div class="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 class="section-title"><span class="dot"></span>{{ 'hrPortal.section.employeeRoster' | translate }}</h2>
                <span class="text-[10px] uppercase font-bold text-text-muted tracking-widest">{{ locale.t('common.peopleCount', { count: employees().length }) }}</span>
              </div>
              <div class="overflow-x-auto hide-scrollbar">
                <table class="hr-table">
                  <thead>
                    <tr>
                      <th>{{ 'hrPortal.table.name' | translate }}</th>
                      <th>{{ 'hrPortal.table.deptTitle' | translate }}</th>
                      <th>{{ 'hrPortal.table.role' | translate }}</th>
                      <th>{{ 'hrPortal.table.salary' | translate }}</th>
                      <th class="text-center">{{ 'common.status' | translate }}</th>
                      <th class="text-right">{{ 'hrPortal.table.action' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of employees(); track item._id) {
                      <tr>
                        <td>
                          <div class="font-bold text-white">{{ item.name }}</div>
                          <div class="text-[10px] text-text-muted">{{ item.email }}</div>
                        </td>
                        <td>
                          <div class="text-white font-medium">{{ item.profile?.roleTitle || '—' }}</div>
                          <div class="text-[10px] text-text-muted font-mono">{{ item.profile?.department || ('hrPortal.form.noDept' | translate) }}</div>
                        </td>
                        <td><span class="font-mono text-accent capitalize">{{ locale.roleLabel(item.role) }}</span></td>
                        <td>
                          @if (item.profile?.basicSalary) {
                            <div class="font-mono text-white">{{ item.profile!.basicSalary | currency }}</div>
                            <div class="text-[10px] text-text-muted">{{ salaryTypeLabel(item.profile!.salaryType || 'monthly') }}</div>
                          } @else {
                            <span class="text-text-muted text-xs italic">{{ 'hrPortal.form.notConfigured' | translate }}</span>
                          }
                        </td>
                        <td class="text-center">
                          <span class="chip" [ngClass]="profileStatusChip(item.profile?.status)">
                            <span class="chip-dot"></span>{{ employmentStatusLabel(item.profile?.status) }}
                          </span>
                        </td>
                        <td class="text-right">
                          <button (click)="selectEmployee(item)"
                            class="px-3 py-1.5 bg-bg-base hover:bg-accent-subtle text-accent border border-border hover:border-accent/40 rounded-lg font-bold text-[11px] transition-all">
                            {{ 'common.edit' | translate }}
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Edit profile -->
            <div class="lg:col-span-1">
              <div class="bg-bg-elevated border border-border rounded-2xl p-6 sticky top-4">
                <h2 class="section-title mb-5"><span class="dot"></span>{{ 'hrPortal.section.editProfile' | translate }}</h2>
                @if (!selectedEmployee()) {
                  <div class="text-center py-12 px-4 text-text-muted border border-dashed border-border rounded-xl text-sm">
                    {{ 'hrPortal.form.selectRosterHint' | translate }}
                  </div>
                } @else {
                  <form [formGroup]="profileForm" (ngSubmit)="submitProfile()" class="flex flex-col gap-4 animate-fade-up">
                    <div class="pb-3 border-b border-border">
                      <h3 class="text-sm font-bold text-accent">{{ selectedEmployee()?.name }}</h3>
                      <p class="text-[10px] text-text-muted">{{ selectedEmployee()?.email }}</p>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.systemRole' | translate }}</label>
                      <select formControlName="role" class="field">
                        <option value="employee">{{ locale.roleLabel('employee') }}</option>
                        <option value="manager">{{ locale.roleLabel('manager') }}</option>
                        <option value="hr">{{ locale.roleLabel('hr') }}</option>
                        <option value="accountant">{{ locale.roleLabel('accountant') }}</option>
                        <option value="admin">{{ locale.roleLabel('admin') }}</option>
                      </select>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.department' | translate }}</label>
                        <input type="text" formControlName="department" placeholder="Engineering" class="field" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.title' | translate }}</label>
                        <input type="text" formControlName="roleTitle" placeholder="Lead Dev" class="field" />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.basicSalary' | translate }}</label>
                        <input type="number" formControlName="basicSalary" class="field font-mono" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.salaryType' | translate }}</label>
                        <select formControlName="salaryType" class="field">
                          <option value="monthly">{{ 'common.monthly' | translate }}</option>
                          <option value="daily">{{ 'common.daily' | translate }}</option>
                          <option value="hourly">{{ 'common.hourly' | translate }}</option>
                        </select>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.daysPerWeek' | translate }}</label>
                        <input type="number" formControlName="workingDays" class="field font-mono" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.hrsPerDay' | translate }}</label>
                        <input type="number" formControlName="workingHours" class="field font-mono" />
                      </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.annualLeaveDays' | translate }}</label>
                      <input type="number" formControlName="annualLeaveBalance" class="field font-mono" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.employmentStatus' | translate }}</label>
                      <select formControlName="status" class="field">
                        <option value="active">{{ 'common.active' | translate }}</option>
                        <option value="suspended">{{ 'common.suspended' | translate }}</option>
                        <option value="resigned">{{ 'common.resigned' | translate }}</option>
                      </select>
                    </div>
                    <div class="flex gap-2.5 mt-2">
                      <button type="submit" [disabled]="profileForm.invalid || processing()" class="btn-accent flex-1">{{ 'common.save' | translate }}</button>
                      <button type="button" class="btn-soft" (click)="selectedEmployee.set(null)">{{ 'common.cancel' | translate }}</button>
                    </div>
                  </form>
                }
              </div>
            </div>
          </div>
        }

        <!-- ─── Leaves ─── -->
        @if (activeTab() === 'leaves') {
          <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 class="section-title"><span class="dot"></span>{{ 'hrPortal.section.pendingLeaves' | translate }}</h2>
              <span class="text-[10px] uppercase font-bold text-text-muted tracking-widest">{{ locale.t('common.waitingCount', { count: pendingLeaves().length }) }}</span>
            </div>
            <div class="overflow-x-auto hide-scrollbar">
              <table class="hr-table">
                <thead>
                  <tr>
                    <th>{{ 'hrPortal.table.employee' | translate }}</th>
                    <th>{{ 'hrPortal.table.type' | translate }}</th>
                    <th>{{ 'hrPortal.table.period' | translate }}</th>
                    <th>{{ 'hrPortal.table.days' | translate }}</th>
                    <th>{{ 'hrPortal.table.reason' | translate }}</th>
                    <th class="text-right">{{ 'common.decision' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of pendingLeaves(); track item._id) {
                    <tr>
                      <td>
                        <div class="font-bold text-white">{{ getEmployeeName(item.userId) }}</div>
                        <div class="text-[10px] text-text-muted">{{ getEmployeeEmail(item.userId) }}</div>
                      </td>
                      <td><span class="chip chip-accent">{{ item.leaveType }}</span></td>
                      <td class="font-mono text-text-muted text-[11px]">{{ item.startDate | date:'MMM d' }} → {{ item.endDate | date:'MMM d, y' }}</td>
                      <td class="font-mono text-white">{{ item.durationDays }}</td>
                      <td class="text-text-muted max-w-xs truncate" [title]="item.reason">{{ item.reason }}</td>
                      <td class="text-right">
                        <div class="inline-flex gap-1.5">
                          <button type="button" (click)="printLeave(item._id)"
                            class="px-3 py-1.5 bg-bg-base hover:bg-accent-subtle text-text-secondary hover:text-accent border border-border hover:border-accent/30 rounded-lg font-bold text-[11px] transition-all">{{ 'common.print' | translate }}</button>
                          <button (click)="promptApproveLeave(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-success/10 hover:bg-success text-success hover:text-white border border-success/25 hover:border-success rounded-lg font-bold text-[11px] transition-all">{{ 'common.approve' | translate }}</button>
                          <button (click)="promptRejectLeave(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/25 hover:border-danger rounded-lg font-bold text-[11px] transition-all">{{ 'common.reject' | translate }}</button>
                        </div>
                      </td>
                    </tr>
                  }
                  @if (pendingLeaves().length === 0) {
                    <tr><td colspan="6" class="text-center py-10 text-text-muted text-xs">{{ 'hrPortal.empty.noPendingLeaves' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- ─── Permissions ─── -->
        @if (activeTab() === 'permissions') {
          <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 class="section-title"><span class="dot"></span>{{ 'hrPortal.section.pendingPermissions' | translate }}</h2>
              <span class="text-[10px] uppercase font-bold text-text-muted tracking-widest">{{ locale.t('common.waitingCount', { count: pendingPermissions().length }) }}</span>
            </div>
            <div class="overflow-x-auto hide-scrollbar">
              <table class="hr-table">
                <thead>
                  <tr>
                    <th>{{ 'hrPortal.table.employee' | translate }}</th>
                    <th>{{ 'hrPortal.table.type' | translate }}</th>
                    <th>{{ 'hrPortal.table.date' | translate }}</th>
                    <th>{{ 'hrPortal.table.interval' | translate }}</th>
                    <th>{{ 'hrPortal.table.duration' | translate }}</th>
                    <th>{{ 'hrPortal.table.reason' | translate }}</th>
                    <th class="text-right">{{ 'common.decision' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of pendingPermissions(); track item._id) {
                    <tr>
                      <td>
                        <div class="font-bold text-white">{{ getEmployeeName(item.userId) }}</div>
                        <div class="text-[10px] text-text-muted">{{ getEmployeeEmail(item.userId) }}</div>
                      </td>
                      <td><span class="chip chip-info">{{ item.type.replace('_', ' ') }}</span></td>
                      <td class="font-mono text-text-muted text-[11px]">{{ item.date | date:'MMM d, y' }}</td>
                      <td class="font-mono text-text-muted">{{ item.fromTime }}–{{ item.toTime }}</td>
                      <td class="font-mono text-white">{{ item.durationMinutes }}m</td>
                      <td class="text-text-muted max-w-xs truncate" [title]="item.reason">{{ item.reason }}</td>
                      <td class="text-right">
                        <div class="inline-flex gap-1.5">
                          <button type="button" (click)="printPermission(item._id)"
                            class="px-3 py-1.5 bg-bg-base hover:bg-accent-subtle text-text-secondary hover:text-accent border border-border hover:border-accent/30 rounded-lg font-bold text-[11px] transition-all">{{ 'common.print' | translate }}</button>
                          <button (click)="promptApprovePermission(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-success/10 hover:bg-success text-success hover:text-white border border-success/25 hover:border-success rounded-lg font-bold text-[11px] transition-all">{{ 'common.approve' | translate }}</button>
                          <button (click)="promptRejectPermission(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/25 hover:border-danger rounded-lg font-bold text-[11px] transition-all">{{ 'common.reject' | translate }}</button>
                        </div>
                      </td>
                    </tr>
                  }
                  @if (pendingPermissions().length === 0) {
                    <tr><td colspan="7" class="text-center py-10 text-text-muted text-xs">{{ 'hrPortal.empty.noPendingPermissions' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- ─── Overtime ─── -->
        @if (activeTab() === 'overtime') {
          <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 class="section-title"><span class="dot"></span>{{ 'hrPortal.section.pendingOvertime' | translate }}</h2>
              <span class="text-[10px] uppercase font-bold text-text-muted tracking-widest">{{ locale.t('common.waitingCount', { count: pendingOvertime().length }) }}</span>
            </div>
            <div class="overflow-x-auto hide-scrollbar">
              <table class="hr-table">
                <thead>
                  <tr>
                    <th>{{ 'hrPortal.table.employee' | translate }}</th>
                    <th>{{ 'hrPortal.table.date' | translate }}</th>
                    <th>{{ 'hrPortal.table.interval' | translate }}</th>
                    <th>{{ 'hrPortal.table.hours' | translate }}</th>
                    <th>{{ 'hrPortal.table.rate' | translate }}</th>
                    <th>{{ 'hrPortal.table.reason' | translate }}</th>
                    <th class="text-right">{{ 'common.decision' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of pendingOvertime(); track item._id) {
                    <tr>
                      <td>
                        <div class="font-bold text-white">{{ getEmployeeName(item.userId) }}</div>
                        <div class="text-[10px] text-text-muted">{{ getEmployeeEmail(item.userId) }}</div>
                      </td>
                      <td class="font-mono text-text-muted text-[11px]">{{ item.date | date:'MMM d, y' }}</td>
                      <td class="font-mono text-text-muted">{{ item.startTime }}–{{ item.endTime }}</td>
                      <td class="font-mono text-white font-bold">{{ item.durationHours }}h</td>
                      <td class="font-mono text-warning font-bold">{{ item.multiplier }}×</td>
                      <td class="text-text-muted max-w-xs truncate" [title]="item.reason">{{ item.reason }}</td>
                      <td class="text-right">
                        <div class="inline-flex gap-1.5">
                          <button type="button" (click)="printOvertime(item._id)"
                            class="px-3 py-1.5 bg-bg-base hover:bg-accent-subtle text-text-secondary hover:text-accent border border-border hover:border-accent/30 rounded-lg font-bold text-[11px] transition-all">{{ 'common.print' | translate }}</button>
                          <button (click)="promptApproveOvertime(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-success/10 hover:bg-success text-success hover:text-white border border-success/25 hover:border-success rounded-lg font-bold text-[11px] transition-all">{{ 'common.approve' | translate }}</button>
                          <button (click)="promptRejectOvertime(item._id)" [disabled]="processing()"
                            class="px-3 py-1.5 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/25 hover:border-danger rounded-lg font-bold text-[11px] transition-all">{{ 'common.reject' | translate }}</button>
                        </div>
                      </td>
                    </tr>
                  }
                  @if (pendingOvertime().length === 0) {
                    <tr><td colspan="7" class="text-center py-10 text-text-muted text-xs">{{ 'hrPortal.empty.noPendingOvertime' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>

      <!-- ─── Confirm Modal ─── -->
      @if (confirmRequest(); as req) {
        <app-confirm-dialog
          [open]="true"
          [title]="req.title"
          [message]="req.message"
          [confirmLabel]="req.confirmLabel"
          [cancelLabel]="req.cancelLabel"
          [variant]="req.variant"
          [icon]="req.icon ?? 'alert'"
          [showTextarea]="!!req.requireReason"
          [inputPlaceholder]="req.reasonPlaceholder || locale.t('common.provideReason')"
          (confirmed)="executeConfirm($event)"
          (cancelled)="cancelConfirm()"
        />
      }
    </div>
  `,
})
export class AdminHrPortalComponent implements OnInit {
  private hrService = inject(HRService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private printDocs = inject(PrintDocumentService);
  locale = inject(LocaleService);

  hrPortalSteps = () => [
    { label: this.locale.t('hrPortal.step.clearQueue'), description: this.locale.t('hrPortal.step.clearQueueDesc'), tone: 'do' as const },
    { label: this.locale.t('hrPortal.step.auditAttendance'), description: this.locale.t('hrPortal.step.auditAttendanceDesc'), tone: 'wait' as const },
    { label: this.locale.t('hrPortal.step.roster'), description: this.locale.t('hrPortal.step.rosterDesc'), tone: 'wait' as const },
    { label: this.locale.t('hrPortal.step.payroll'), description: this.locale.t('hrPortal.step.payrollDesc'), tone: 'done' as const },
  ];

  hrPortalTips = () => [
    { title: this.locale.t('hrPortal.step.clearQueue'), body: this.locale.t('hrPortal.tip.rejectionReason') },
    { title: this.locale.t('hrPortal.step.auditAttendance'), body: this.locale.t('hrPortal.tip.statsClickable') },
    { title: this.locale.t('hrPortal.step.roster'), body: this.locale.t('hrPortal.tip.salariesSensitive') },
  ];

  tabs = (): { key: Tab; label: string; badge?: () => number }[] => [
    { key: 'overview',    label: this.locale.t('hrPortal.tab.todayAttendance') },
    { key: 'registry',    label: this.locale.t('hrPortal.tab.employeeRegistry') },
    { key: 'leaves',      label: this.locale.t('hrPortal.tab.leaves'),      badge: () => this.pendingLeaves().length },
    { key: 'permissions', label: this.locale.t('hrPortal.tab.permissions'), badge: () => this.pendingPermissions().length },
    { key: 'overtime',    label: this.locale.t('hrPortal.tab.overtime'),    badge: () => this.pendingOvertime().length },
  ];

  activeTab = signal<Tab>('overview');
  processing = signal(false);

  employees = signal<EmployeeWithProfile[]>([]);
  todayAttendance = signal<Attendance[]>([]);
  pendingLeaves = signal<Leave[]>([]);
  pendingPermissions = signal<Permission[]>([]);
  pendingOvertime = signal<Overtime[]>([]);

  selectedEmployee = signal<EmployeeWithProfile | null>(null);

  confirmRequest = signal<ConfirmRequest | null>(null);

  adjustForm!: FormGroup;
  profileForm!: FormGroup;

  ngOnInit() {
    this.initForms();
    this.loadAllData();
  }

  initForms() {
    this.adjustForm = this.fb.group({
      userId:   ['', Validators.required],
      date:     ['', Validators.required],
      checkIn:  [''],
      checkOut: [''],
      status:   ['Present', Validators.required],
      reason:   ['', [Validators.required, Validators.minLength(4)]]
    });

    this.profileForm = this.fb.group({
      role:               ['employee', Validators.required],
      department:         [''],
      roleTitle:          [''],
      basicSalary:        [0, [Validators.required, Validators.min(0)]],
      salaryType:         ['monthly', Validators.required],
      workingDays:        [5, [Validators.required, Validators.min(1), Validators.max(7)]],
      workingHours:       [8, [Validators.required, Validators.min(1), Validators.max(24)]],
      annualLeaveBalance: [21, [Validators.required, Validators.min(0)]],
      status:             ['active', Validators.required]
    });
  }

  loadAllData() {
    this.loadEmployees();
    this.loadTodayAttendance();
    this.loadPendingLeaves();
    this.loadPendingPermissions();
    this.loadPendingOvertime();
  }

  loadEmployees()          { this.hrService.getEmployees().subscribe({ next: (r) => { if (r.success) this.employees.set(r.data); } }); }
  loadTodayAttendance()    { this.hrService.getTodayAdminAttendance().subscribe({ next: (r) => { if (r.success) this.todayAttendance.set(r.data); } }); }
  loadPendingLeaves()      { this.hrService.getPendingLeaves().subscribe({ next: (r) => { if (r.success) this.pendingLeaves.set(r.data); } }); }
  loadPendingPermissions() { this.hrService.getPendingPermissions().subscribe({ next: (r) => { if (r.success) this.pendingPermissions.set(r.data); } }); }
  loadPendingOvertime()    { this.hrService.getPendingOvertime().subscribe({ next: (r) => { if (r.success) this.pendingOvertime.set(r.data); } }); }

  isAccountantOrAdmin(): boolean {
    const role = this.authService.currentUser()?.role;
    return ['admin', 'hr', 'accountant'].includes(role || '');
  }

  // ─── Helpers ──────────────────────────────────
  getEmployeeName(userId: string | any): string {
    const idStr = typeof userId === 'object' ? userId._id : userId;
    const emp = this.employees().find(e => e._id === idStr);
    if (emp) return emp.name;
    if (typeof userId === 'object' && userId.name) return userId.name;
    return this.locale.t('common.unknown');
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
    if (!mins) return '—';
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
    return mins > 0 ? `${mins}m` : '—';
  }

  attendanceStatusLabel(status: string): string {
    const keys: Record<string, string> = {
      'Present': 'attendanceStatus.present',
      'Absent': 'attendanceStatus.absent',
      'Late': 'attendanceStatus.late',
      'Early Leave': 'attendanceStatus.earlyLeave',
      'Half Day': 'attendanceStatus.halfDay',
      'On Leave': 'attendanceStatus.onLeave',
      'Weekend': 'attendanceStatus.weekend',
      'Holiday': 'attendanceStatus.holiday',
      'Permission': 'attendanceStatus.permission',
      'Remote': 'attendanceStatus.remote',
      'Missing Check-out': 'attendanceStatus.missingCheckout',
    };
    const key = keys[status];
    return key ? this.locale.t(key) : status;
  }

  employmentStatusLabel(status?: string): string {
    const keys: Record<string, string> = {
      active: 'common.active',
      suspended: 'common.suspended',
      resigned: 'common.resigned',
      draft: 'common.draft',
    };
    const key = status ? keys[status] : undefined;
    return key ? this.locale.t(key) : this.locale.t('common.draft');
  }

  salaryTypeLabel(type?: string): string {
    const keys: Record<string, string> = {
      monthly: 'common.monthly',
      daily: 'common.daily',
      hourly: 'common.hourly',
    };
    const key = type ? keys[type] : undefined;
    return key ? this.locale.t(key) : (type || '');
  }

  attendanceChip(status: string): string {
    if (status === 'Present')                                 return 'chip-success';
    if (status === 'Absent')                                  return 'chip-danger';
    if (['Late','Early Leave','Half Day'].includes(status))   return 'chip-warning';
    if (status === 'On Leave')                                return 'chip-info';
    return 'chip-muted';
  }
  profileStatusChip(status?: string): string {
    if (status === 'active')                                 return 'chip-success';
    if (status === 'suspended' || status === 'resigned')     return 'chip-danger';
    return 'chip-muted';
  }

  // ─── Adjust attendance ────────────────────────
  submitAdjust() {
    if (this.adjustForm.invalid) return;
    this.processing.set(true);
    this.hrService.adjustAttendance(this.adjustForm.value).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.toast.success(this.locale.t('hrPortal.toast.timesheetUpdated'));
          this.adjustForm.reset({ status: 'Present' });
          this.loadTodayAttendance();
        }
      },
      error: () => { this.processing.set(false); }
    });
  }

  // ─── Profile editing ──────────────────────────
  selectEmployee(emp: EmployeeWithProfile) {
    this.selectedEmployee.set(emp);
    this.profileForm.reset({
      role:               emp.role,
      department:         emp.profile?.department || '',
      roleTitle:          emp.profile?.roleTitle || '',
      basicSalary:        emp.profile?.basicSalary || 0,
      salaryType:         emp.profile?.salaryType || 'monthly',
      workingDays:        emp.profile?.workingDays || 5,
      workingHours:       emp.profile?.workingHours || 8,
      annualLeaveBalance: emp.profile?.annualLeaveBalance || 21,
      status:             emp.profile?.status || 'active'
    });
  }
  submitProfile() {
    if (this.profileForm.invalid || !this.selectedEmployee()) return;
    this.processing.set(true);
    const userId = this.selectedEmployee()!._id;
    this.hrService.updateProfile(userId, this.profileForm.value).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.toast.success(this.locale.t('hrPortal.toast.profileUpdated'));
          this.selectedEmployee.set(null);
          this.loadEmployees();
        }
      },
      error: () => { this.processing.set(false); }
    });
  }

  printLeave(id: string): void { void this.printDocs.printLeave(id); }
  printPermission(id: string): void { void this.printDocs.printPermission(id); }
  printOvertime(id: string): void { void this.printDocs.printOvertime(id); }

  // ─── Approve / Reject prompts ─────────────────
  promptApproveLeave(id: string) {
    this.openConfirm({
      title: this.locale.t('hrPortal.confirm.approveLeaveTitle'),
      message: this.locale.t('common.approveLeaveMessage'),
      confirmLabel: this.locale.t('common.approve'),
      cancelLabel: this.locale.t('common.cancel'),
      variant: 'accent',
      icon: 'check',
      onConfirm: () => this.doApproveLeave(id)
    });
  }
  promptRejectLeave(id: string) {
    this.openConfirm({
      title: this.locale.t('hrPortal.confirm.rejectLeaveTitle'),
      message: this.locale.t('common.rejectLeaveMessage'),
      confirmLabel: this.locale.t('common.rejectLeave'),
      cancelLabel: this.locale.t('common.cancel'),
      variant: 'danger',
      icon: 'alert',
      requireReason: true,
      reasonPlaceholder: this.locale.t('common.explainRejection'),
      onConfirm: (reason) => this.doRejectLeave(id, reason!)
    });
  }
  promptApprovePermission(id: string) {
    this.openConfirm({
      title: this.locale.t('hrPortal.confirm.approvePermissionTitle'),
      message: this.locale.t('common.approvePermissionMessage'),
      confirmLabel: this.locale.t('common.approve'),
      cancelLabel: this.locale.t('common.cancel'),
      variant: 'accent',
      icon: 'clock',
      onConfirm: () => this.doApprovePermission(id)
    });
  }
  promptRejectPermission(id: string) {
    this.openConfirm({
      title: this.locale.t('hrPortal.confirm.rejectPermissionTitle'),
      message: this.locale.t('common.rejectPermissionMessage'),
      confirmLabel: this.locale.t('common.reject'),
      cancelLabel: this.locale.t('common.cancel'),
      variant: 'danger',
      icon: 'alert',
      onConfirm: () => this.doRejectPermission(id)
    });
  }
  promptApproveOvertime(id: string) {
    this.openConfirm({
      title: this.locale.t('hrPortal.confirm.approveOvertimeTitle'),
      message: this.locale.t('common.approveOvertimeMessage'),
      confirmLabel: this.locale.t('common.approve'),
      cancelLabel: this.locale.t('common.cancel'),
      variant: 'accent',
      icon: 'check',
      onConfirm: () => this.doApproveOvertime(id)
    });
  }
  promptRejectOvertime(id: string) {
    this.openConfirm({
      title: this.locale.t('hrPortal.confirm.rejectOvertimeTitle'),
      message: this.locale.t('common.rejectOvertimeMessage'),
      confirmLabel: this.locale.t('common.reject'),
      cancelLabel: this.locale.t('common.cancel'),
      variant: 'danger',
      icon: 'alert',
      onConfirm: () => this.doRejectOvertime(id)
    });
  }

  // ─── Action runners ───────────────────────────
  private doApproveLeave(id: string) {
    this.processing.set(true);
    this.hrService.approveLeave(id).subscribe({
      next: () => { this.processing.set(false); this.toast.success(this.locale.t('hrPortal.toast.leaveApproved')); this.loadPendingLeaves(); this.loadEmployees(); },
      error: () => { this.processing.set(false); }
    });
  }
  private doRejectLeave(id: string, reason: string) {
    this.processing.set(true);
    this.hrService.rejectLeave(id, reason).subscribe({
      next: () => { this.processing.set(false); this.toast.success(this.locale.t('hrPortal.toast.leaveRejected')); this.loadPendingLeaves(); },
      error: () => { this.processing.set(false); }
    });
  }
  private doApprovePermission(id: string) {
    this.processing.set(true);
    this.hrService.approvePermission(id).subscribe({
      next: () => { this.processing.set(false); this.toast.success(this.locale.t('hrPortal.toast.permissionApproved')); this.loadPendingPermissions(); },
      error: () => { this.processing.set(false); }
    });
  }
  private doRejectPermission(id: string) {
    this.processing.set(true);
    this.hrService.rejectPermission(id).subscribe({
      next: () => { this.processing.set(false); this.toast.success(this.locale.t('hrPortal.toast.permissionRejected')); this.loadPendingPermissions(); },
      error: () => { this.processing.set(false); }
    });
  }
  private doApproveOvertime(id: string) {
    this.processing.set(true);
    this.hrService.approveOvertime(id).subscribe({
      next: () => { this.processing.set(false); this.toast.success(this.locale.t('hrPortal.toast.overtimeApproved')); this.loadPendingOvertime(); },
      error: () => { this.processing.set(false); }
    });
  }
  private doRejectOvertime(id: string) {
    this.processing.set(true);
    this.hrService.rejectOvertime(id).subscribe({
      next: () => { this.processing.set(false); this.toast.success(this.locale.t('hrPortal.toast.overtimeRejected')); this.loadPendingOvertime(); },
      error: () => { this.processing.set(false); }
    });
  }

  // ─── Confirm modal infra ──────────────────────
  private openConfirm(req: ConfirmRequest) {
    this.confirmRequest.set(req);
  }
  cancelConfirm() {
    this.confirmRequest.set(null);
  }
  executeConfirm(reason?: string | void) {
    const req = this.confirmRequest();
    if (!req) return;
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (req.requireReason && !trimmed) return;
    this.confirmRequest.set(null);
    req.onConfirm(trimmed || undefined);
  }

}
