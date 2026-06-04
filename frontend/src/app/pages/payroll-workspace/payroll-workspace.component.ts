import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PayrollService } from '../../services/payroll.service';
import { HRService } from '../../services/hr.service';
import { AuthService } from '../../services/auth.service';
import {
  PayrollRun,
  Payslip,
  SalaryAdjustment,
  EmployeeWithProfile
} from '../../models/types';

@Component({
  selector: 'app-payroll-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      <!-- Header -->
      <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold text-white tracking-tight">
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              Payroll Processing Room
            </span>
          </h1>
          <p class="text-slate-400 text-sm mt-1">Run monthly calculations, review payslip line-items, and track adjustments.</p>
        </div>
        <div class="flex items-center gap-3">
          <a routerLink="/dashboard" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            Back to Dashboard
          </a>
          <a routerLink="/admin-hr-portal" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            HR Control Portal
          </a>
        </div>
      </div>

      <!-- Tab selectors -->
      <div class="max-w-7xl mx-auto mb-8 border-b border-slate-850 flex gap-6">
        <button (click)="activeTab.set('runs')" [class.border-purple-500]="activeTab() === 'runs'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200"
                [ngClass]="activeTab() === 'runs' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Payroll Runs
        </button>
        <button (click)="activeTab.set('adjustments')" [class.border-purple-500]="activeTab() === 'adjustments'"
                class="pb-3 text-sm font-semibold border-b-2 border-transparent transition duration-200"
                [ngClass]="activeTab() === 'adjustments' ? 'text-white' : 'text-slate-500 hover:text-slate-350'">
          Salary Adjustments (Bonuses & Deductions)
        </button>
      </div>

      <!-- Messages -->
      <div class="max-w-7xl mx-auto">
        @if (error()) {
          <div class="p-4 mb-6 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold">{{ error() }}</div>
        }
        @if (success()) {
          <div class="p-4 mb-6 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-semibold">{{ success() }}</div>
        }

        <!-- 1. Payroll Runs Tab -->
        <div *ngIf="activeTab() === 'runs'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Run Generator Panel -->
          <div class="lg:col-span-1 flex flex-col gap-6">
            <!-- Trigger New Run -->
            <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
              <h2 class="text-base font-bold text-white mb-4">Calculate New Month</h2>
              <form [formGroup]="runForm" (ngSubmit)="submitRunPayroll()" class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Payroll Period (YYYY-MM)</label>
                  <input type="month" formControlName="month" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
                <button type="submit" [disabled]="runForm.invalid || processing()"
                        class="w-full mt-2 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg text-xs transition duration-200 shadow-md shadow-pink-950/20">
                  {{ processing() ? 'Processing Calculation...' : 'GENERATE PAYROLL RUN' }}
                </button>
              </form>
            </div>

            <!-- Historical Runs List -->
            <div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-4">
              <h2 class="text-base font-bold text-white">Previous Runs</h2>
              <div class="flex flex-col gap-3 max-h-[350px] overflow-y-auto">
                <div *ngFor="let run of payrollRuns()" 
                     (click)="selectRun(run)"
                     [ngClass]="selectedRun()?._id === run._id ? 'border-purple-500 bg-purple-950/10' : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'"
                     class="border p-4 rounded-xl cursor-pointer transition flex flex-col gap-2 relative">
                  
                  <div class="flex justify-between items-start">
                    <span class="text-sm font-black text-white font-mono">{{ run.month }}</span>
                    <span class="px-2 py-0.5 rounded font-medium text-[9px] uppercase tracking-wider font-mono"
                          [ngClass]="{
                            'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20': run.status === 'calculated',
                            'bg-blue-500/10 text-blue-450 border border-blue-550/20': run.status === 'under_review',
                            'bg-indigo-500/10 text-indigo-405 border border-indigo-505/20': run.status === 'approved',
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': run.status === 'paid' || run.status === 'locked'
                          }">
                      {{ run.status }}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono mt-1 border-t border-slate-900 pt-2">
                    <div>Net: <span class="text-emerald-400 font-bold">{{ run.summary.totalNetSalary | currency }}</span></div>
                    <div>Staff: <span class="text-slate-200 font-semibold">{{ run.summary.employeesCount }}</span></div>
                  </div>
                </div>
                <div *ngIf="payrollRuns().length === 0" class="text-center py-6 text-slate-500 text-xs">
                  No payroll run history found.
                </div>
              </div>
            </div>
          </div>

          <!-- Payslip list / details panel -->
          <div class="lg:col-span-2 flex flex-col gap-6">
            <div *ngIf="!selectedRun()" class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-slate-700">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
                <line x1="12" y1="4" x2="12" y2="20"/>
              </svg>
              <h3 class="text-sm font-bold text-slate-400 mt-2">No Run Selected</h3>
              <p class="text-xs max-w-xs">Select a historical payroll run or generate a new month to examine detailed employee payslips and control run states.</p>
            </div>

            <!-- Run Control & Payslip Table -->
            <div *ngIf="selectedRun()" class="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6">
              
              <!-- Top run panel controls -->
              <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    Month Details: <span class="font-mono text-purple-400">{{ selectedRun()?.month }}</span>
                  </h3>
                  <p class="text-[10px] text-slate-500 font-mono mt-0.5">Calculated at: {{ selectedRun()?.calculatedAt | date:'medium' }}</p>
                </div>

                <div class="flex items-center gap-2.5">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Run Lifecycle State:</label>
                  <select [value]="selectedRun()?.status" 
                          (change)="onStatusChange($event)"
                          [disabled]="selectedRun()?.status === 'locked' && !isAdmin()"
                          class="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-200 font-semibold focus:outline-none">
                    <option value="calculated">Calculated (Draft)</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                    <option value="locked">Locked</option>
                  </select>
                </div>
              </div>

              <!-- General Stats Grid -->
              <div class="grid grid-cols-4 gap-4 bg-slate-950/40 p-4 border border-slate-850 rounded-xl font-mono text-[10px] text-slate-400">
                <div>
                  <div class="text-slate-500 uppercase tracking-widest text-[8px]">Basic Payroll</div>
                  <div class="text-sm font-bold text-slate-350 mt-1">{{ selectedRun()?.summary?.totalBasicSalary | currency }}</div>
                </div>
                <div>
                  <div class="text-slate-500 uppercase tracking-widest text-[8px]">Total Bonuses</div>
                  <div class="text-sm font-bold text-emerald-450 mt-1">+{{ selectedRun()?.summary?.totalBonuses | currency }}</div>
                </div>
                <div>
                  <div class="text-slate-500 uppercase tracking-widest text-[8px]">Total Deductions</div>
                  <div class="text-sm font-bold text-rose-450 mt-1">-{{ selectedRun()?.summary?.totalDeductions | currency }}</div>
                </div>
                <div>
                  <div class="text-slate-500 uppercase tracking-widest text-[8px]">Net Payout</div>
                  <div class="text-sm font-extrabold text-white mt-1">{{ selectedRun()?.summary?.totalNetSalary | currency }}</div>
                </div>
              </div>

              <!-- Payslips Table -->
              <div class="flex flex-col gap-2">
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">Employee Payslips Breakdown</h4>
                <div class="overflow-x-auto rounded-xl border border-slate-800/80">
                  <table class="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-450 font-medium">
                        <th class="p-3">Employee</th>
                        <th class="p-3 text-right">Basic</th>
                        <th class="p-3 text-center">Days (Wrk/Abs)</th>
                        <th class="p-3 text-center">Late Mins</th>
                        <th class="p-3 text-center">Overtime</th>
                        <th class="p-3 text-right">Adj (Bonus/Deduct)</th>
                        <th class="p-3 text-right font-semibold">Net Payable</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                      <tr *ngFor="let slip of payslips()" class="hover:bg-slate-800/10">
                        <td class="p-3">
                          <div class="font-bold text-slate-300">{{ getEmployeeName(slip.userId) }}</div>
                        </td>
                        <td class="p-3 text-right font-mono text-slate-400">{{ slip.basicSalary | currency }}</td>
                        <td class="p-3 text-center font-mono font-medium">
                          <span class="text-emerald-450">{{ slip.workedDays }}d</span> / 
                          <span class="text-rose-450">{{ slip.absentDays }}d</span>
                        </td>
                        <td class="p-3 text-center font-mono text-rose-400" [class.opacity-30]="slip.lateMinutes === 0">
                          {{ slip.lateMinutes }}m
                        </td>
                        <td class="p-3 text-center font-mono font-medium" [class.opacity-30]="slip.overtimeHours === 0">
                          <span class="text-purple-400">{{ slip.overtimeHours }}h</span> 
                          <span class="text-[9px] text-slate-500 block">({{ slip.overtimeAmount | currency }})</span>
                        </td>
                        <td class="p-3 text-right font-mono font-medium">
                          <span class="text-emerald-400">+{{ slip.bonuses | currency }}</span><br/>
                          <span class="text-rose-400">-{{ slip.deductions | currency }}</span>
                        </td>
                        <td class="p-3 text-right font-mono font-bold text-white bg-slate-950/20">
                          {{ slip.netSalary | currency }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- 2. Adjustments Tab -->
        <div *ngIf="activeTab() === 'adjustments'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Adjustment Creator Form -->
          <div class="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
            <h2 class="text-base font-bold text-white mb-4">Add Salary Adjustment</h2>
            <form [formGroup]="adjustmentForm" (ngSubmit)="submitAdjustment()" class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Employee *</label>
                <select formControlName="userId" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                  <option value="">-- Choose Employee --</option>
                  <option *ngFor="let emp of employees()" [value]="emp._id">{{ emp.name }} ({{ emp.role }})</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Adjustment Type *</label>
                  <select formControlName="type" (change)="onAdjustmentTypeChange()" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                    <option value="bonus">Bonus</option>
                    <option value="deduction">Deduction</option>
                  </select>
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sub-Category *</label>
                  <select formControlName="subType" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200">
                    <ng-container *ngIf="adjustmentForm.value.type === 'bonus'">
                      <option value="bonus">Performance Bonus</option>
                      <option value="allowance">Allowance</option>
                      <option value="commission">Commission</option>
                      <option value="manual">Manual Adjustment</option>
                    </ng-container>
                    <ng-container *ngIf="adjustmentForm.value.type === 'deduction'">
                      <option value="penalty">Disciplinary Penalty</option>
                      <option value="manual">Manual Deduction</option>
                    </ng-container>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Amount ($) *</label>
                  <input type="number" formControlName="amount" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Payroll Month *</label>
                  <input type="month" formControlName="payrollMonth" class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono" />
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Adjustment Reason *</label>
                <textarea formControlName="reason" rows="3" placeholder="Provide explanation details..." class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"></textarea>
              </div>

              <button type="submit" [disabled]="adjustmentForm.invalid || processing()"
                      class="mt-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition duration-200">
                Log Salary Adjustment
              </button>
            </form>
          </div>

          <!-- Adjustments History / Query Panel -->
          <div class="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 class="text-base font-bold text-white">Adjustments History</h2>
              
              <!-- Month Filter -->
              <div class="flex items-center gap-2">
                <span class="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Period:</span>
                <input type="month" [value]="filterMonth()" 
                       (change)="onFilterMonthChange($event)"
                       class="bg-slate-950 border border-slate-800 rounded py-1 px-2.5 text-[11px] font-mono text-slate-200" />
              </div>
            </div>

            <!-- Table of Adjustments -->
            <div class="overflow-x-auto rounded-xl border border-slate-800/80">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                    <th class="p-4">Employee</th>
                    <th class="p-4 font-mono">Month</th>
                    <th class="p-4">Category</th>
                    <th class="p-4 text-right">Amount</th>
                    <th class="p-4">Reason</th>
                    <th class="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                  <tr *ngFor="let adj of salaryAdjustments()" class="hover:bg-slate-800/10">
                    <td class="p-4">
                      <div class="font-bold text-slate-200">{{ getEmployeeName(adj.userId) }}</div>
                    </td>
                    <td class="p-4 font-mono text-slate-400">{{ adj.payrollMonth }}</td>
                    <td class="p-4">
                      <span class="font-medium capitalize text-slate-300">{{ adj.subType }}</span>
                      <span class="text-[9px] font-mono text-slate-500 uppercase block">({{ adj.type }})</span>
                    </td>
                    <td class="p-4 text-right font-mono font-bold"
                        [ngClass]="adj.type === 'bonus' ? 'text-emerald-400' : 'text-rose-400'">
                      {{ adj.type === 'bonus' ? '+' : '-' }}{{ adj.amount | currency }}
                    </td>
                    <td class="p-4 text-slate-400 max-w-xs truncate" [title]="adj.reason">{{ adj.reason }}</td>
                    <td class="p-4 text-center">
                      <span class="px-2 py-0.5 rounded font-medium text-[9px] uppercase tracking-wider font-mono"
                            [ngClass]="{
                              'bg-yellow-500/10 text-yellow-450 border border-yellow-505/20': adj.status === 'draft',
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': adj.status === 'approved' || adj.status === 'applied',
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20': adj.status === 'cancelled'
                            }">
                        {{ adj.status }}
                      </span>
                    </td>
                  </tr>
                  <tr *ngIf="salaryAdjustments().length === 0">
                    <td colspan="6" class="text-center py-8 text-slate-500">No adjustments logged for this period.</td>
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
export class PayrollWorkspaceComponent implements OnInit {
  private payrollService = inject(PayrollService);
  private hrService = inject(HRService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  activeTab = signal<'runs' | 'adjustments'>('runs');
  processing = signal(false);
  error = signal('');
  success = signal('');

  employees = signal<EmployeeWithProfile[]>([]);
  payrollRuns = signal<PayrollRun[]>([]);
  selectedRun = signal<PayrollRun | null>(null);
  payslips = signal<Payslip[]>([]);

  salaryAdjustments = signal<SalaryAdjustment[]>([]);
  filterMonth = signal('');

  runForm!: FormGroup;
  adjustmentForm!: FormGroup;

  ngOnInit() {
    // Default filter month to current YYYY-MM
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
      userId: ['', Validators.required],
      type: ['bonus', Validators.required],
      subType: ['bonus', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      payrollMonth: [defaultMonth, Validators.required],
      reason: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  loadEmployees() {
    this.hrService.getEmployees().subscribe({
      next: (res) => {
        if (res.success) this.employees.set(res.data);
      }
    });
  }

  loadRuns() {
    this.payrollService.getRuns().subscribe({
      next: (res) => {
        if (res.success) {
          this.payrollRuns.set(res.data);
          // Auto select first run if exists and none is selected yet
          if (res.data.length > 0 && !this.selectedRun()) {
            this.selectRun(res.data[0]);
          }
        }
      }
    });
  }

  loadAdjustments() {
    this.payrollService.getAdjustments(this.filterMonth()).subscribe({
      next: (res) => {
        if (res.success) this.salaryAdjustments.set(res.data);
      }
    });
  }

  selectRun(run: PayrollRun) {
    this.selectedRun.set(run);
    this.payrollService.getPayslips(run._id).subscribe({
      next: (res) => {
        if (res.success) this.payslips.set(res.data);
      }
    });
  }

  isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'admin';
  }

  getEmployeeName(userId: string | any): string {
    const idStr = typeof userId === 'object' ? userId._id : userId;
    const emp = this.employees().find(e => e._id === idStr);
    if (emp) return emp.name;
    if (typeof userId === 'object' && userId.name) return userId.name;
    return 'Unknown Employee';
  }

  onAdjustmentTypeChange() {
    const type = this.adjustmentForm.get('type')?.value;
    if (type === 'bonus') {
      this.adjustmentForm.patchValue({ subType: 'bonus' });
    } else {
      this.adjustmentForm.patchValue({ subType: 'penalty' });
    }
  }

  onFilterMonthChange(event: any) {
    const month = event.target.value;
    if (month) {
      this.filterMonth.set(month);
      this.loadAdjustments();
    }
  }

  // Generate Run
  submitRunPayroll() {
    if (this.runForm.invalid) return;
    this.processing.set(true);
    this.error.set('');
    this.success.set('');

    const monthStr = this.runForm.value.month;
    this.payrollService.runPayroll(monthStr).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.success.set(`Monthly payroll run generated for ${monthStr} successfully.`);
          this.loadRuns();
          if (res.data && res.data.run) {
            this.selectRun(res.data.run);
          }
        }
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Failed to execute payroll run calculations.');
      }
    });
  }

  // Update Run Lifecycle Status
  onStatusChange(event: any) {
    if (!this.selectedRun()) return;
    const status = event.target.value;
    const runId = this.selectedRun()!._id;

    if (!confirm(`Are you sure you want to transition this payroll run status to "${status}"?`)) {
      // Reset select element value
      event.target.value = this.selectedRun()!.status;
      return;
    }

    this.processing.set(true);
    this.error.set('');
    this.success.set('');

    this.payrollService.updateStatus(runId, status).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.success.set(`Payroll run status transitioned to ${status}.`);
          this.loadRuns();
          // Keep selected run updated
          this.selectedRun.set(res.data);
        }
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Failed to update payroll run status.');
        // Reset select element value
        event.target.value = this.selectedRun()!.status;
      }
    });
  }

  // Add Salary Adjustment
  submitAdjustment() {
    if (this.adjustmentForm.invalid) return;
    this.processing.set(true);
    this.error.set('');
    this.success.set('');

    this.payrollService.addAdjustment(this.adjustmentForm.value).subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          this.success.set('Salary adjustment successfully logged.');
          this.adjustmentForm.reset({
            type: 'bonus',
            subType: 'bonus',
            amount: 0,
            payrollMonth: this.filterMonth()
          });
          this.loadAdjustments();
        }
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.error || 'Failed to record salary adjustment.');
      }
    });
  }
}
