import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PayrollService } from '../../services/payroll.service';
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
  PayrollRun,
  Payslip,
  SalaryAdjustment,
  EmployeeWithProfile
} from '../../models/types';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  icon?: ConfirmIcon;
  onConfirm: () => void;
  onCancel?: () => void;
}

@Component({
  selector: 'app-payroll-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, ConfirmDialogComponent, TranslatePipe],
  template: `
    <div class="page-ambient pb-12 animate-fade-up" [attr.data-locale]="locale.locale()">

      <app-page-header
        [eyebrow]="locale.t('payroll.eyebrow')"
        [title]="locale.t('payroll.title')"
        [description]="locale.t('payroll.description')"
        [badge]="locale.t('payroll.badge')"
        badgeTone="warning"
        [steps]="payrollSteps()"
        [tips]="payrollTips()"
      >
        <div header-actions class="flex items-center gap-2.5">
          <a routerLink="/admin-hr-portal" class="btn-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            {{ 'common.hrCenter' | translate }}
          </a>
        </div>
      </app-page-header>

      <!-- Tabs -->
      <div class="bg-bg-elevated border border-border rounded-xl p-1 mb-6 inline-flex gap-1">
        <button (click)="activeTab.set('runs')"
          class="relative px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 inline-flex items-center gap-2"
          [ngClass]="activeTab() === 'runs' ? 'bg-bg-base text-white shadow-card' : 'text-text-secondary hover:text-white'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
          {{ 'payroll.tab.runs' | translate }}
        </button>
        <button (click)="activeTab.set('adjustments')"
          class="relative px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 inline-flex items-center gap-2"
          [ngClass]="activeTab() === 'adjustments' ? 'bg-bg-base text-white shadow-card' : 'text-text-secondary hover:text-white'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ 'payroll.tab.adjustments' | translate }}
        </button>
      </div>

      <div class="tab-panel" [attr.data-tab]="activeTab()">

        <!-- ═══════════════ RUNS TAB ═══════════════ -->
        @if (activeTab() === 'runs') {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <!-- LEFT: Trigger New + Run History -->
            <div class="lg:col-span-1 flex flex-col gap-6">

              <!-- Generate New Run -->
              <div class="bg-bg-elevated border border-border rounded-2xl p-6">
                <h2 class="section-title mb-5"><span class="dot"></span>{{ 'common.generateRun' | translate }}</h2>
                <form [formGroup]="runForm" (ngSubmit)="submitRunPayroll()" class="flex flex-col gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.payrollMonth' | translate }}</label>
                    <input type="month" formControlName="month" class="field font-mono" />
                  </div>
                  <button type="submit" [disabled]="runForm.invalid || processing()" class="btn-accent w-full mt-1">
                    @if (processing()) {
                      <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      {{ 'common.calculating' | translate }}
                    } @else {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      {{ 'common.runPayroll' | translate }}
                    }
                  </button>
                </form>
              </div>

              <!-- Run History List -->
              <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
                <div class="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h2 class="section-title"><span class="dot"></span>{{ 'common.previousRuns' | translate }}</h2>
                  <span class="text-[10px] uppercase font-bold tracking-widest text-text-muted">{{ payrollRuns().length }}</span>
                </div>
                <div class="flex flex-col gap-2 p-3 max-h-[420px] overflow-y-auto hide-scrollbar">
                  @for (run of payrollRuns(); track run._id) {
                    <button (click)="selectRun(run)"
                      class="text-left p-3.5 rounded-xl border transition-all hover:bg-bg-hover animate-fade-up"
                      [ngClass]="selectedRun()?._id === run._id ? 'border-accent bg-accent-subtle' : 'border-border bg-bg-base'">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-mono font-extrabold text-white">{{ run.month }}</span>
                        <span class="chip" [ngClass]="runStatusChip(run.status)">
                          <span class="chip-dot"></span>{{ runStatusLabel(run.status) }}
                        </span>
                      </div>
                      <div class="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-border/50">
                        <div class="text-text-muted">
                          Net:
                          <span class="text-success font-mono font-bold">{{ run.summary.totalNetSalary | currency }}</span>
                        </div>
                        <div class="text-text-muted">
                          {{ 'common.staff' | translate }}:
                          <span class="text-white font-mono font-bold">{{ run.summary.employeesCount }}</span>
                        </div>
                      </div>
                    </button>
                  }
                  @if (payrollRuns().length === 0) {
                    <div class="text-center py-10 text-text-muted text-xs">{{ 'common.noPayrollRuns' | translate }}</div>
                  }
                </div>
              </div>
            </div>

            <!-- RIGHT: Run Details / Payslips -->
            <div class="lg:col-span-2">
              @if (!selectedRun()) {
                <div class="bg-bg-elevated border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 min-h-[420px]">
                  <div class="w-16 h-16 rounded-2xl bg-bg-base border border-border flex items-center justify-center text-text-muted">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                  </div>
                  <h3 class="text-base font-display font-bold text-white">{{ 'common.noRunSelected' | translate }}</h3>
                  <p class="text-sm text-text-muted max-w-sm">{{ 'common.noRunSelectedHint' | translate }}</p>
                </div>
              } @else {
                <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden animate-fade-up">

                  <!-- Run header + status control -->
                  <div class="px-6 py-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 class="text-base font-display font-bold text-white">
                        {{ 'common.monthLabel' | translate }} <span class="font-mono text-accent">{{ selectedRun()?.month }}</span>
                      </h3>
                      <p class="text-[11px] text-text-muted font-mono mt-1">{{ locale.t('common.calculatedAt', { date: (selectedRun()?.calculatedAt | date:'medium') || '' }) }}</p>
                    </div>
                    <div class="flex items-center gap-2.5">
                      <label class="text-[10px] uppercase font-bold tracking-widest text-text-muted">{{ 'common.lifecycle' | translate }}</label>
                      <select [value]="selectedRun()?.status"
                              (change)="onStatusChange($event)"
                              [disabled]="selectedRun()?.status === 'locked' && !isAdmin()"
                              class="field !py-1.5 !text-xs !w-auto font-semibold">
                        <option value="calculated">{{ locale.t('common.calculatedDraft') }}</option>
                        <option value="under_review">{{ locale.t('common.underReview') }}</option>
                        <option value="approved">{{ locale.t('common.approved') }}</option>
                        <option value="paid">{{ locale.t('common.paid') }}</option>
                        <option value="locked">{{ locale.t('common.locked') }}</option>
                      </select>
                    </div>
                  </div>

                  <!-- KPIs -->
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                    <div class="bg-bg-elevated p-4">
                      <div class="text-[10px] uppercase font-bold tracking-widest text-text-muted">{{ 'common.basicPayroll' | translate }}</div>
                      <div class="text-base font-display font-bold text-white mt-1 font-mono">{{ selectedRun()?.summary?.totalBasicSalary | currency }}</div>
                    </div>
                    <div class="bg-bg-elevated p-4">
                      <div class="text-[10px] uppercase font-bold tracking-widest text-text-muted">{{ 'common.bonuses' | translate }}</div>
                      <div class="text-base font-display font-bold text-success mt-1 font-mono">+{{ selectedRun()?.summary?.totalBonuses | currency }}</div>
                    </div>
                    <div class="bg-bg-elevated p-4">
                      <div class="text-[10px] uppercase font-bold tracking-widest text-text-muted">{{ 'common.deductions' | translate }}</div>
                      <div class="text-base font-display font-bold text-danger mt-1 font-mono">-{{ selectedRun()?.summary?.totalDeductions | currency }}</div>
                    </div>
                    <div class="bg-bg-elevated p-4">
                      <div class="text-[10px] uppercase font-bold tracking-widest text-text-muted">{{ 'common.netPayable' | translate }}</div>
                      <div class="text-base font-display font-extrabold text-white mt-1 font-mono">{{ selectedRun()?.summary?.totalNetSalary | currency }}</div>
                    </div>
                  </div>

                  <!-- Payslips table -->
                  <div class="overflow-x-auto hide-scrollbar">
                    <table class="hr-table">
                      <thead>
                        <tr>
                          <th>{{ 'common.employee' | translate }}</th>
                          <th class="text-right">{{ 'common.basic' | translate }}</th>
                          <th class="text-center">{{ 'common.daysWorkedAbsent' | translate }}</th>
                          <th class="text-center">{{ 'common.late' | translate }}</th>
                          <th class="text-center">{{ 'common.overtime' | translate }}</th>
                          <th class="text-right">{{ 'common.adjustments' | translate }}</th>
                          <th class="text-right">{{ 'common.net' | translate }}</th>
                          <th class="text-right no-print">{{ 'common.actions' | translate }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (slip of payslips(); track slip._id) {
                          <tr>
                            <td class="font-bold text-white">{{ getEmployeeName(slip.userId) }}</td>
                            <td class="text-right font-mono text-text-secondary">{{ slip.basicSalary | currency }}</td>
                            <td class="text-center font-mono">
                              <span class="text-success">{{ slip.workedDays }}d</span>
                              <span class="text-text-muted mx-1">/</span>
                              <span class="text-danger">{{ slip.absentDays }}d</span>
                            </td>
                            <td class="text-center font-mono" [class.opacity-40]="slip.lateMinutes === 0"
                                [class.text-danger]="slip.lateMinutes > 0">
                              {{ slip.lateMinutes }}m
                            </td>
                            <td class="text-center font-mono" [class.opacity-40]="slip.overtimeHours === 0">
                              <span class="text-accent font-bold">{{ slip.overtimeHours }}h</span>
                              <span class="block text-[9px] text-text-muted">({{ slip.overtimeAmount | currency }})</span>
                            </td>
                            <td class="text-right font-mono">
                              <div class="text-success">+{{ slip.bonuses | currency }}</div>
                              <div class="text-danger">-{{ slip.deductions | currency }}</div>
                            </td>
                            <td class="text-right font-mono font-extrabold text-white bg-bg-base/40">{{ slip.netSalary | currency }}</td>
                            <td class="text-right no-print">
                              <button type="button"
                                (click)="printPayslip(slip._id)"
                                [disabled]="printingDocId() === slip._id"
                                class="px-3 py-1.5 bg-accent-subtle hover:bg-accent text-accent hover:text-white border border-accent/25 hover:border-accent rounded-lg font-bold text-[11px] transition-all">
                                {{ 'common.printPayslip' | translate }}
                              </button>
                            </td>
                          </tr>
                        }
                        @if (payslips().length === 0) {
                          <tr><td colspan="8" class="text-center py-10 text-text-muted text-xs">{{ 'common.noPayslips' | translate }}</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- ═══════════════ ADJUSTMENTS TAB ═══════════════ -->
        @if (activeTab() === 'adjustments') {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <!-- Adjustment form -->
            <div class="lg:col-span-1">
              <div class="bg-bg-elevated border border-border rounded-2xl p-6">
                <h2 class="section-title mb-5"><span class="dot"></span>{{ 'common.addAdjustment' | translate }}</h2>
                <form [formGroup]="adjustmentForm" (ngSubmit)="submitAdjustment()" class="flex flex-col gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.employee' | translate }}</label>
                    <select formControlName="userId" class="field">
                      <option value="">{{ locale.t('common.choose') }}</option>
                      @for (emp of employees(); track emp._id) {
                        <option [value]="emp._id">{{ emp.name }} · {{ locale.roleLabel(emp.role) }}</option>
                      }
                    </select>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.type' | translate }}</label>
                      <select formControlName="type" (change)="onAdjustmentTypeChange()" class="field">
                        <option value="bonus">{{ locale.t('common.bonus') }}</option>
                        <option value="deduction">{{ locale.t('common.deduction') }}</option>
                      </select>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.category' | translate }}</label>
                      <select formControlName="subType" class="field">
                        @if (adjustmentForm.value.type === 'bonus') {
                          <option value="bonus">{{ locale.t('common.performanceBonus') }}</option>
                          <option value="allowance">{{ locale.t('common.allowance') }}</option>
                          <option value="commission">{{ locale.t('common.commission') }}</option>
                          <option value="manual">{{ locale.t('common.manual') }}</option>
                        }
                        @if (adjustmentForm.value.type === 'deduction') {
                          <option value="penalty">{{ locale.t('common.disciplinaryPenalty') }}</option>
                          <option value="manual">{{ locale.t('common.manualDeduction') }}</option>
                        }
                      </select>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.amount' | translate }}</label>
                      <input type="number" formControlName="amount" class="field font-mono" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.month' | translate }}</label>
                      <input type="month" formControlName="payrollMonth" class="field font-mono" />
                    </div>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] uppercase font-bold text-text-muted tracking-[0.18em]">{{ 'common.reason' | translate }}</label>
                    <textarea formControlName="reason" rows="3" [placeholder]="locale.t('common.explanationDetails')" class="field resize-none"></textarea>
                  </div>
                  <button type="submit" [disabled]="adjustmentForm.invalid || processing()" class="btn-accent w-full mt-1">
                    @if (processing()) {
                      <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    }
                    {{ 'common.saveAdjustment' | translate }}
                  </button>
                </form>
              </div>
            </div>

            <!-- Adjustments history -->
            <div class="lg:col-span-2">
              <div class="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-border">
                  <h2 class="section-title"><span class="dot"></span>{{ 'common.adjustmentsHistory' | translate }}</h2>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] uppercase font-bold text-text-muted tracking-widest">{{ 'common.period' | translate }}</span>
                    <input type="month" [value]="filterMonth()" (change)="onFilterMonthChange($event)"
                           class="field !py-1.5 !text-xs !w-auto font-mono" />
                  </div>
                </div>
                <div class="overflow-x-auto hide-scrollbar">
                  <table class="hr-table">
                    <thead>
                      <tr>
                        <th>{{ 'common.employee' | translate }}</th>
                        <th>{{ 'common.month' | translate }}</th>
                        <th>{{ 'common.category' | translate }}</th>
                        <th class="text-right">{{ 'common.amount' | translate }}</th>
                        <th>{{ 'common.reason' | translate }}</th>
                        <th class="text-center">{{ 'common.status' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (adj of salaryAdjustments(); track adj._id) {
                        <tr>
                          <td class="font-bold text-white">{{ getEmployeeName(adj.userId) }}</td>
                          <td class="font-mono text-text-muted">{{ adj.payrollMonth }}</td>
                          <td>
                            <span class="font-medium text-white capitalize">{{ adj.subType }}</span>
                            <span class="text-[10px] font-mono text-text-muted uppercase block tracking-wider">({{ adj.type }})</span>
                          </td>
                          <td class="text-right font-mono font-extrabold"
                              [ngClass]="adj.type === 'bonus' ? 'text-success' : 'text-danger'">
                            {{ adj.type === 'bonus' ? '+' : '-' }}{{ adj.amount | currency }}
                          </td>
                          <td class="text-text-muted max-w-xs truncate" [title]="adj.reason">{{ adj.reason }}</td>
                          <td class="text-center">
                            <span class="chip" [ngClass]="adjStatusChip(adj.status)">
                              <span class="chip-dot"></span>{{ adjStatusLabel(adj.status) }}
                            </span>
                          </td>
                        </tr>
                      }
                      @if (salaryAdjustments().length === 0) {
                        <tr><td colspan="6" class="text-center py-10 text-text-muted text-xs">{{ 'common.noAdjustmentsPeriod' | translate }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Confirm Modal -->
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
export class PayrollWorkspaceComponent implements OnInit {
  private payrollService = inject(PayrollService);
  private hrService = inject(HRService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private printDocs = inject(PrintDocumentService);
  locale = inject(LocaleService);

  payrollSteps = () => [
    { label: this.locale.t('payroll.step.adjustments'), description: this.locale.t('payroll.step.adjustmentsDesc'), tone: 'do' as const },
    { label: this.locale.t('payroll.step.calculate'), description: this.locale.t('payroll.step.calculateDesc'), tone: 'wait' as const },
    { label: this.locale.t('payroll.step.review'), description: this.locale.t('payroll.step.reviewDesc'), tone: 'wait' as const },
    { label: this.locale.t('payroll.step.lock'), description: this.locale.t('payroll.step.lockDesc'), tone: 'done' as const },
  ];

  payrollTips = () => [
    { title: this.locale.t('payroll.step.calculate'), body: this.locale.t('payroll.tip.order') },
    { title: this.locale.t('common.locked'), body: this.locale.t('payroll.tip.lockOneWay') },
    { title: this.locale.t('common.hrCenter'), body: this.locale.t('payroll.tip.hrContext') },
  ];

  activeTab = signal<'runs' | 'adjustments'>('runs');
  processing = signal(false);

  employees = signal<EmployeeWithProfile[]>([]);
  payrollRuns = signal<PayrollRun[]>([]);
  selectedRun = signal<PayrollRun | null>(null);
  payslips = signal<Payslip[]>([]);

  salaryAdjustments = signal<SalaryAdjustment[]>([]);
  filterMonth = signal('');

  runForm!: FormGroup;
  adjustmentForm!: FormGroup;

  confirmRequest = signal<ConfirmRequest | null>(null);
  printingDocId = signal<string | null>(null);

  ngOnInit() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.filterMonth.set(currentMonth);

    this.initForms(currentMonth);
    this.loadEmployees();
    this.loadRuns();
    this.loadAdjustments();
  }

  initForms(defaultMonth: string) {
    this.runForm = this.fb.group({
      month: [defaultMonth, Validators.required]
    });
    this.adjustmentForm = this.fb.group({
      userId:       ['', Validators.required],
      type:         ['bonus', Validators.required],
      subType:      ['bonus', Validators.required],
      amount:       [0, [Validators.required, Validators.min(1)]],
      payrollMonth: [defaultMonth, Validators.required],
      reason:       ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  loadEmployees() {
    this.hrService.getEmployees().subscribe({
      next: (res) => { if (res.success) this.employees.set(res.data); }
    });
  }

  loadRuns() {
    this.payrollService.getRuns().subscribe({
      next: (res) => {
        if (res.success) {
          this.payrollRuns.set(res.data);
          if (res.data.length > 0 && !this.selectedRun()) {
            this.selectRun(res.data[0]);
          }
        }
      }
    });
  }

  loadAdjustments() {
    this.payrollService.getAdjustments(this.filterMonth()).subscribe({
      next: (res) => { if (res.success) this.salaryAdjustments.set(res.data); }
    });
  }

  selectRun(run: PayrollRun) {
    this.selectedRun.set(run);
    this.payrollService.getPayslips(run._id).subscribe({
      next: (res) => { if (res.success) this.payslips.set(res.data); }
    });
  }

  isAdmin(): boolean { return this.authService.currentUser()?.role === 'admin'; }

  getEmployeeName(userId: string | any): string {
    const idStr = typeof userId === 'object' ? userId._id : userId;
    const emp = this.employees().find(e => e._id === idStr);
    if (emp) return emp.name;
    if (typeof userId === 'object' && userId.name) return userId.name;
    return this.locale.t('common.unknown');
  }

  runStatusLabel(status: string): string {
    const keys: Record<string, string> = {
      calculated: 'common.calculatedDraft',
      under_review: 'common.underReview',
      approved: 'common.approved',
      paid: 'common.paid',
      locked: 'common.locked',
    };
    const key = keys[status];
    return key ? this.locale.t(key) : status.replace(/_/g, ' ');
  }

  adjStatusLabel(status: string): string {
    const keys: Record<string, string> = {
      approved: 'common.approved',
      applied: 'common.approved',
      cancelled: 'common.rejected',
      pending: 'common.pending',
    };
    const key = keys[status];
    return key ? this.locale.t(key) : status;
  }

  onAdjustmentTypeChange() {
    const type = this.adjustmentForm.get('type')?.value;
    this.adjustmentForm.patchValue({ subType: type === 'bonus' ? 'bonus' : 'penalty' });
  }

  onFilterMonthChange(event: any) {
    const month = event.target.value;
    if (month) {
      this.filterMonth.set(month);
      this.loadAdjustments();
    }
  }

  // ─── Submissions ──────────────────────────────
  submitRunPayroll() {
    if (this.runForm.invalid) return;
    this.processing.set(true);
    const monthStr = this.runForm.value.month;
    this.payrollService.runPayroll(monthStr).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.toast.success(this.locale.t('payroll.toast.runGenerated', { month: monthStr }));
          this.loadRuns();
          if (res.data && res.data.run) this.selectRun(res.data.run);
        }
      },
      error: () => {
        this.processing.set(false);
      }
    });
  }

  onStatusChange(event: any) {
    if (!this.selectedRun()) return;
    const newStatus = event.target.value;
    const oldStatus = this.selectedRun()!.status;
    const runId = this.selectedRun()!._id;

    this.confirmRequest.set({
      title: this.locale.t('common.transitionTitle', { status: this.runStatusLabel(newStatus) }),
      message: this.locale.t('common.transitionMessage'),
      confirmLabel: this.locale.t('common.confirmTransition'),
      cancelLabel: this.locale.t('common.cancel'),
      variant: 'accent',
      icon: 'check',
      onConfirm: () => {
        this.processing.set(true);
        this.payrollService.updateStatus(runId, newStatus).subscribe({
          next: (res) => {
            this.processing.set(false);
            if (res.success) {
              this.toast.success(this.locale.t('payroll.toast.runTransitioned', { status: this.runStatusLabel(newStatus) }));
              this.loadRuns();
              this.selectedRun.set(res.data);
            }
          },
          error: () => {
            this.processing.set(false);
            event.target.value = oldStatus;
          }
        });
      },
      onCancel: () => { event.target.value = oldStatus; }
    });
  }

  submitAdjustment() {
    if (this.adjustmentForm.invalid) return;
    this.processing.set(true);
    this.payrollService.addAdjustment(this.adjustmentForm.value).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.toast.success(this.locale.t('payroll.toast.adjustmentSaved'));
          this.adjustmentForm.reset({
            type: 'bonus',
            subType: 'bonus',
            amount: 0,
            payrollMonth: this.filterMonth()
          });
          this.loadAdjustments();
        }
      },
      error: () => {
        this.processing.set(false);
      }
    });
  }

  async printPayslip(payslipId: string): Promise<void> {
    this.printingDocId.set(payslipId);
    try {
      await this.printDocs.printPayslip(payslipId);
    } finally {
      this.printingDocId.set(null);
    }
  }

  // ─── Confirm Modal ─────────────────────────────
  cancelConfirm() {
    const req = this.confirmRequest();
    this.confirmRequest.set(null);
    req?.onCancel?.();
  }
  executeConfirm() {
    const req = this.confirmRequest();
    this.confirmRequest.set(null);
    req?.onConfirm();
  }

  // ─── Chip helpers ──────────────────────────────
  runStatusChip(status: string): string {
    switch (status) {
      case 'calculated':  return 'chip-warning';
      case 'under_review': return 'chip-info';
      case 'approved':    return 'chip-accent';
      case 'paid':
      case 'locked':      return 'chip-success';
      default:            return 'chip-muted';
    }
  }
  adjStatusChip(status: string): string {
    if (status === 'approved' || status === 'applied') return 'chip-success';
    if (status === 'cancelled')                        return 'chip-danger';
    return 'chip-warning';
  }

}
