import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HRService } from '../../services/hr.service';
import { ToastService } from '../../services/toast.service';
import { PrintDocumentService } from '../../services/print-document.service';
import { Leave, Permission, Overtime } from '../../models/types';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { dateRangeValidator, leaveAdvanceNoticeValidator } from '../../core/validators/leave.validators';
import {
  formatClockTime,
  isPermissionWindowOpen,
  todayDateString,
} from '../../core/validators/permission.validators';
import { Subscription, interval } from 'rxjs';

type TabKey = 'leaves' | 'permissions' | 'overtime';

@Component({
  selector: 'app-request-center',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent, TranslatePipe],
  template: `
    <div class="page-ambient pb-12 animate-fade-up" [attr.data-locale]="locale.locale()">

      <app-page-header
        [eyebrow]="locale.t('requestCenter.eyebrow')"
        [title]="locale.t('requestCenter.title')"
        [description]="locale.t('requestCenter.description')"
        [steps]="requestCenterSteps()"
        [tips]="requestCenterTips()"
      >
        <div header-actions class="flex items-center gap-2">
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated border border-border">
            <span class="w-2 h-2 rounded-full bg-warning"></span>
            <span class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'common.pending' | translate }}</span>
            <span class="text-sm font-mono font-extrabold text-white">{{ pendingCountAll() }}</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated border border-border">
            <span class="w-2 h-2 rounded-full bg-success"></span>
            <span class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ 'common.approved' | translate }}</span>
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
          {{ 'requestCenter.tab.leaves' | translate }}
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
          {{ 'requestCenter.tab.permissions' | translate }}
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
          {{ 'requestCenter.tab.overtime' | translate }}
          @if (pendingOvertimeCount() > 0) {
            <span class="ml-1 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-mono font-bold">{{ pendingOvertimeCount() }}</span>
          }
        </button>
      </div>

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
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.leaveType' | translate }}</label>
                  <select formControlName="leaveType" class="field">
                    <option value="annual">{{ 'common.annualLeave' | translate }}</option>
                    <option value="sick">{{ 'common.sickLeave' | translate }}</option>
                    <option value="unpaid">{{ 'common.unpaidLeave' | translate }}</option>
                    <option value="emergency">{{ 'common.emergencyLeave' | translate }}</option>
                  </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.startDate' | translate }}</label>
                    <input type="date" formControlName="startDate" class="field font-mono" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.endDate' | translate }}</label>
                    <input type="date" formControlName="endDate" class="field font-mono" />
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.reason' | translate }}</label>
                  <textarea formControlName="reason" rows="3" [placeholder]="'common.briefExplanation' | translate" class="field resize-none"></textarea>
                </div>
                @if (leaveForm.hasError('advanceNotice')) {
                  <p class="text-xs text-warning font-medium">{{ 'requestCenter.validation.leaveAdvance' | translate }}</p>
                }
                @if (leaveForm.hasError('dateRange')) {
                  <p class="text-xs text-danger font-medium">{{ 'requestCenter.validation.dateRange' | translate }}</p>
                }
                @if (leaveForm.hasError('pastDate')) {
                  <p class="text-xs text-danger font-medium">{{ 'requestCenter.validation.pastDate' | translate }}</p>
                }
                <button type="submit" [disabled]="leaveForm.invalid || sending()" class="btn-accent w-full mt-2">
                  @if (sending()) {
                    <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  }
                  {{ 'requestCenter.form.submitLeave' | translate }}
                </button>
              </form>
            }

            <!-- PERMISSIONS FORM -->
            @if (activeTab() === 'permissions') {
              <form [formGroup]="permissionForm" (ngSubmit)="submitPermission()" class="flex flex-col gap-4">
                @if (!permissionWindowOpen()) {
                  <div class="rounded-xl border border-danger/30 bg-danger-muted px-4 py-3 flex items-start gap-3">
                    <svg class="shrink-0 mt-0.5 text-danger" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <div>
                      <p class="text-sm font-semibold text-danger">{{ 'requestCenter.permission.closedTitle' | translate }}</p>
                      <p class="text-xs text-text-secondary mt-1">{{ 'requestCenter.permission.closedHint' | translate }}</p>
                    </div>
                  </div>
                } @else {
                  <div class="rounded-xl border border-info/25 bg-info-muted px-4 py-3">
                    <p class="text-xs text-text-secondary">{{ 'requestCenter.permission.autoTimeHint' | translate }}</p>
                    <p class="text-sm font-mono font-bold text-white mt-1">{{ currentClock() }}</p>
                  </div>
                }
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.requestType' | translate }}</label>
                  <select formControlName="type" class="field" [disabled]="!permissionWindowOpen()">
                    <option value="hourly">{{ 'common.hourlyPermission' | translate }}</option>
                    <option value="late_arrival">{{ 'common.waiveLateArrival' | translate }}</option>
                    <option value="early_leave">{{ 'common.earlyDismissal' | translate }}</option>
                    <option value="remote">{{ 'common.workFromHome' | translate }}</option>
                    <option value="correction">{{ 'common.timecardCorrection' | translate }}</option>
                  </select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.date' | translate }}</label>
                  <input type="date" formControlName="date" class="field font-mono" [disabled]="!permissionWindowOpen()" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.reason' | translate }}</label>
                  <textarea formControlName="reason" rows="3" [placeholder]="'common.provideJustification' | translate" class="field resize-none" [disabled]="!permissionWindowOpen()"></textarea>
                </div>
                <button type="submit" [disabled]="permissionForm.invalid || sending() || !permissionWindowOpen()" class="btn-accent w-full mt-2">
                  @if (sending()) {
                    <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  }
                  {{ 'requestCenter.form.submitPermission' | translate }}
                </button>
              </form>
            }

            <!-- OVERTIME FORM -->
            @if (activeTab() === 'overtime') {
              <form [formGroup]="overtimeForm" (ngSubmit)="submitOvertime()" class="flex flex-col gap-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.dateWorked' | translate }}</label>
                  <input type="date" formControlName="date" class="field font-mono" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.from' | translate }}</label>
                    <input type="time" formControlName="startTime" class="field font-mono" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.to' | translate }}</label>
                    <input type="time" formControlName="endTime" class="field font-mono" />
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.workDescription' | translate }}</label>
                  <textarea formControlName="reason" rows="3" [placeholder]="'common.tasksCompletedOvertime' | translate" class="field resize-none"></textarea>
                </div>
                <button type="submit" [disabled]="overtimeForm.invalid || sending()" class="btn-accent w-full mt-2">
                  @if (sending()) {
                    <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  }
                  {{ 'common.logOvertime' | translate }}
                </button>
              </form>
            }
          </div>
        </div>

        <!-- ─── HISTORY COLUMN ───────────────────────── -->
        <div class="xl:col-span-2">
          <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 class="section-title"><span class="dot"></span>{{ 'requestCenter.history.title' | translate }}</h2>
              <span class="text-[10px] uppercase font-bold text-text-muted tracking-widest">{{ locale.t('common.entriesCount', { count: currentHistoryCount() }) }}</span>
            </div>

            <!-- LEAVES HISTORY -->
            @if (activeTab() === 'leaves') {
              <div class="overflow-x-auto hide-scrollbar">
                <table class="hr-table">
                  <thead>
                    <tr>
                      <th>{{ 'requestCenter.history.leaveType' | translate }}</th>
                      <th>{{ 'requestCenter.history.duration' | translate }}</th>
                      <th>{{ 'requestCenter.history.period' | translate }}</th>
                      <th class="text-right">{{ 'common.status' | translate }}</th>
                      <th class="text-right">{{ 'common.actions' | translate }}</th>
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
                            <span class="font-bold text-white">{{ leaveTypeLabel(item.leaveType) }}</span>
                          </div>
                        </td>
                        <td><span class="font-mono text-white">{{ item.durationDays }} {{ (item.durationDays > 1 ? 'common.days' : 'common.day') | translate }}</span></td>
                        <td class="font-mono text-text-muted text-[11px]">{{ item.startDate | date:'MMM d' }} → {{ item.endDate | date:'MMM d, y' }}</td>
                        <td class="text-right">
                          <span class="chip" [ngClass]="statusChip(item.status)">
                            <span class="chip-dot"></span>{{ requestStatusLabel(item.status) }}
                          </span>
                        </td>
                        <td class="text-right">
                          <button type="button" (click)="printLeave(item._id)"
                            class="px-3 py-1.5 bg-bg-base hover:bg-accent-subtle text-text-secondary hover:text-accent border border-border hover:border-accent/30 rounded-lg font-bold text-[11px] transition-all">
                            {{ 'common.print' | translate }}
                          </button>
                        </td>
                      </tr>
                    }
                    @if (leaves().length === 0) {
                      <tr><td colspan="5">
                        <div class="flex flex-col items-center justify-center text-text-muted py-12 gap-3">
                          <div class="w-14 h-14 rounded-full bg-bg-base border border-border flex items-center justify-center">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <p class="text-sm">{{ 'requestCenter.empty.noLeaves' | translate }}</p>
                          <span class="text-[11px] text-text-faint">{{ 'requestCenter.empty.noLeavesHint' | translate }}</span>
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
                      <th>{{ 'requestCenter.history.type' | translate }}</th>
                      <th>{{ 'requestCenter.history.date' | translate }}</th>
                      <th>{{ 'common.interval' | translate }}</th>
                      <th class="text-right">{{ 'common.status' | translate }}</th>
                      <th class="text-right">{{ 'common.actions' | translate }}</th>
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
                            <span class="font-bold text-white">{{ permissionTypeLabel(item.type) }}</span>
                          </div>
                        </td>
                        <td class="font-mono text-text-muted text-[11px]">{{ item.date | date:'MMM d, y' }}</td>
                        <td>
                          <span class="font-mono text-white text-[11px]">{{ item.fromTime }} – {{ item.toTime }}</span>
                          <span class="ml-2 text-[10px] text-text-muted font-mono">({{ item.durationMinutes }}m)</span>
                        </td>
                        <td class="text-right">
                          <span class="chip" [ngClass]="statusChip(item.status)">
                            <span class="chip-dot"></span>{{ requestStatusLabel(item.status) }}
                          </span>
                        </td>
                        <td class="text-right">
                          <button type="button" (click)="printPermission(item._id)"
                            class="px-3 py-1.5 bg-bg-base hover:bg-accent-subtle text-text-secondary hover:text-accent border border-border hover:border-accent/30 rounded-lg font-bold text-[11px] transition-all">
                            {{ 'common.print' | translate }}
                          </button>
                        </td>
                      </tr>
                    }
                    @if (permissions().length === 0) {
                      <tr><td colspan="5">
                        <div class="flex flex-col items-center justify-center text-text-muted py-12 gap-3">
                          <div class="w-14 h-14 rounded-full bg-bg-base border border-border flex items-center justify-center">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </div>
                          <p class="text-sm">{{ 'requestCenter.empty.noPermissions' | translate }}</p>
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
                      <th>{{ 'requestCenter.history.date' | translate }}</th>
                      <th>{{ 'common.interval' | translate }}</th>
                      <th>{{ 'requestCenter.history.hoursRate' | translate }}</th>
                      <th class="text-right">{{ 'common.status' | translate }}</th>
                      <th class="text-right">{{ 'common.actions' | translate }}</th>
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
                            <span class="text-white font-bold text-xs">{{ item.durationHours }} {{ 'common.hours' | translate }}</span>
                            <span class="text-[10px] text-warning font-mono uppercase tracking-wider">{{ overtimeRateLabel(item.multiplier) }}</span>
                          </div>
                        </td>
                        <td class="text-right">
                          <span class="chip" [ngClass]="statusChip(item.status)">
                            <span class="chip-dot"></span>{{ requestStatusLabel(item.status) }}
                          </span>
                        </td>
                        <td class="text-right">
                          <button type="button" (click)="printOvertime(item._id)"
                            class="px-3 py-1.5 bg-bg-base hover:bg-accent-subtle text-text-secondary hover:text-accent border border-border hover:border-accent/30 rounded-lg font-bold text-[11px] transition-all">
                            {{ 'common.print' | translate }}
                          </button>
                        </td>
                      </tr>
                    }
                    @if (overtime().length === 0) {
                      <tr><td colspan="5">
                        <div class="flex flex-col items-center justify-center text-text-muted py-12 gap-3">
                          <div class="w-14 h-14 rounded-full bg-bg-base border border-border flex items-center justify-center">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          </div>
                          <p class="text-sm">{{ 'requestCenter.empty.noOvertime' | translate }}</p>
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
export class RequestCenterComponent implements OnInit, OnDestroy {
  private hrService = inject(HRService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private printDocs = inject(PrintDocumentService);
  locale = inject(LocaleService);

  activeTab = signal<TabKey>('leaves');
  sending = signal(false);

  leaves = signal<Leave[]>([]);
  permissions = signal<Permission[]>([]);
  overtime = signal<Overtime[]>([]);

  leaveForm!: FormGroup;
  permissionForm!: FormGroup;
  overtimeForm!: FormGroup;

  permissionWindowOpen = signal(true);
  currentClock = signal('--:--');
  private clockSub?: Subscription;

  requestCenterSteps = () => [
    { label: this.locale.t('requestCenter.step.pickType'), description: this.locale.t('requestCenter.step.pickTypeDesc'), tone: 'do' as const },
    { label: this.locale.t('requestCenter.step.fillForm'), description: this.locale.t('requestCenter.step.fillFormDesc'), tone: 'do' as const },
    { label: this.locale.t('requestCenter.step.hrDecides'), description: this.locale.t('requestCenter.step.hrDecidesDesc'), tone: 'wait' as const },
  ];

  requestCenterTips = () => [
    { title: this.locale.t('common.leaveType'), body: this.locale.t('requestCenter.tip.leaveVsPermission') },
    { title: this.locale.t('common.overtime'), body: this.locale.t('requestCenter.tip.overtimeProof') },
    { title: this.locale.t('common.cancel'), body: this.locale.t('requestCenter.tip.cancelPending') },
  ];

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

  formTitle = computed(() => {
    switch (this.activeTab()) {
      case 'leaves':      return this.locale.t('requestCenter.form.newLeave');
      case 'permissions': return this.locale.t('requestCenter.form.newPermission');
      case 'overtime':    return this.locale.t('requestCenter.form.logOvertime');
    }
  });

  formSubtitle = computed(() => {
    switch (this.activeTab()) {
      case 'leaves':      return this.locale.t('requestCenter.form.newLeaveSubtitle');
      case 'permissions': return this.locale.t('requestCenter.form.newPermissionSubtitle');
      case 'overtime':    return this.locale.t('requestCenter.form.logOvertimeSubtitle');
    }
  });

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
    this.tickPermissionWindow();
    this.clockSub = interval(30_000).subscribe(() => this.tickPermissionWindow());
  }

  ngOnDestroy() {
    this.clockSub?.unsubscribe();
  }

  private tickPermissionWindow() {
    const now = new Date();
    this.permissionWindowOpen.set(isPermissionWindowOpen(now));
    this.currentClock.set(formatClockTime(now));
  }

  initForms() {
    this.leaveForm = this.fb.group(
      {
        leaveType: ['annual', Validators.required],
        startDate: ['', Validators.required],
        endDate: ['', Validators.required],
        reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
      },
      { validators: [leaveAdvanceNoticeValidator(), dateRangeValidator()] }
    );
    this.permissionForm = this.fb.group({
      type: ['hourly', Validators.required],
      date: [todayDateString(), Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
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

  printLeave(id: string): void { void this.printDocs.printLeave(id); }
  printPermission(id: string): void { void this.printDocs.printPermission(id); }
  printOvertime(id: string): void { void this.printDocs.printOvertime(id); }

  // ─── Submissions ───────────────────────────────
  submitLeave() {
    if (this.leaveForm.invalid) return;
    this.sending.set(true);
    this.hrService.requestLeave(this.leaveForm.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.toast.success(this.locale.t('requestCenter.toast.leaveSubmitted'));
          this.leaveForm.reset({ leaveType: 'annual' });
          this.loadLeaves();
        }
      },
      error: () => { this.sending.set(false); },
    });
  }

  submitPermission() {
    if (this.permissionForm.invalid || !this.permissionWindowOpen()) return;
    this.sending.set(true);
    const { type, date, reason } = this.permissionForm.value;
    this.hrService.requestPermission({ type, date, reason }).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.toast.success(this.locale.t('requestCenter.toast.permissionSubmitted'));
          this.permissionForm.reset({ type: 'hourly', date: todayDateString() });
          this.loadPermissions();
        }
      },
      error: (err) => {
        this.sending.set(false);
        const msg = err?.error?.error;
        this.toast.error(typeof msg === 'string' ? msg : this.locale.t('common.genericError'));
      },
    });
  }

  submitOvertime() {
    if (this.overtimeForm.invalid) return;
    this.sending.set(true);
    this.hrService.requestOvertime(this.overtimeForm.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        if (res.success) {
          this.toast.success(this.locale.t('requestCenter.toast.overtimeSubmitted'));
          this.overtimeForm.reset();
          this.loadOvertime();
        }
      },
      error: () => { this.sending.set(false); },
    });
  }

  // ─── Helpers ───────────────────────────────────
  requestStatusLabel(status: string): string {
    const keys: Record<string, string> = {
      pending: 'common.pending',
      approved: 'common.approved',
      rejected: 'common.rejected',
    };
    const key = keys[status];
    return key ? this.locale.t(key) : status;
  }

  leaveTypeLabel(type: string): string {
    const keys: Record<string, string> = {
      annual: 'common.annualLeave',
      sick: 'common.sickLeave',
      unpaid: 'common.unpaidLeave',
      emergency: 'common.emergencyLeave',
    };
    const key = keys[type];
    return key ? this.locale.t(key) : type;
  }

  permissionTypeLabel(type: string): string {
    const keys: Record<string, string> = {
      hourly: 'common.hourlyPermission',
      late_arrival: 'common.waiveLateArrival',
      early_leave: 'common.earlyDismissal',
      remote: 'common.workFromHome',
      correction: 'common.timecardCorrection',
    };
    const key = keys[type];
    return key ? this.locale.t(key) : type.replace(/_/g, ' ');
  }

  overtimeRateLabel(multiplier: number): string {
    return `${multiplier}× ${this.locale.t('hrPortal.table.rate').toLowerCase()}`;
  }

  statusChip(status: string): string {
    if (status === 'approved') return 'chip-success';
    if (status === 'rejected') return 'chip-danger';
    if (status === 'pending')  return 'chip-warning';
    return 'chip-muted';
  }

}
