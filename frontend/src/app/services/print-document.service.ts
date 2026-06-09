import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models/types';
import { LocaleService } from '../core/i18n/locale.service';
import { ToastService } from './toast.service';

interface PopulatedUser {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
}

interface PrintLine {
  key?: string;
  label: string;
  amount: number;
  detail?: string;
}

interface PayslipPrintData {
  reference: string;
  employee: PopulatedUser;
  profile: {
    department?: string;
    roleTitle?: string;
    employeeId?: string;
    hireDate?: string;
  } | null;
  payrollRun: { month?: string; status?: string };
  earnings: PrintLine[];
  deductions: PrintLine[];
  summary: {
    totalEarnings: number;
    totalDeductions: number;
    netSalary: number;
    workedDays: number;
    absentDays: number;
    paidLeaves: number;
    unpaidLeaves: number;
  };
  payslip: {
    lateMinutes: number;
    overtimeHours: number;
  };
  printedAt: string;
}

interface HrDocumentData {
  type: 'leave' | 'permission' | 'overtime';
  reference: string;
  employee: PopulatedUser;
  profile: { department?: string; roleTitle?: string; hireDate?: string } | null;
  status: string;
  reason: string;
  submittedAt: string;
  approvedBy?: PopulatedUser | null;
  approvedAt?: string;
  rejectionReason?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  permissionType?: string;
  date?: string;
  fromTime?: string;
  toTime?: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  multiplier?: number;
}

@Injectable({ providedIn: 'root' })
export class PrintDocumentService {
  private http = inject(HttpClient);
  private locale = inject(LocaleService);
  private toast = inject(ToastService);

  private readonly payrollUrl = `${environment.apiUrl}/payroll`;
  private readonly documentsUrl = `${environment.apiUrl}/documents`;

  async printPayslip(payslipId: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<PayslipPrintData>>(
          `${this.payrollUrl}/payslips/${payslipId}/print-data`
        )
      );
      if (!res.success || !res.data) {
        this.toast.error(this.locale.t('print.toast.loadFailed'));
        return;
      }
      const html = this.buildPayslipHtml(res.data);
      this.openPrintWindow(this.locale.t('print.payslip.title'), html);
    } catch {
      this.toast.error(this.locale.t('print.toast.loadFailed'));
    }
  }

  async printLeave(leaveId: string): Promise<void> {
    await this.printHrDocument('leave', leaveId);
  }

  async printPermission(permissionId: string): Promise<void> {
    await this.printHrDocument('permission', permissionId);
  }

  async printOvertime(overtimeId: string): Promise<void> {
    await this.printHrDocument('overtime', overtimeId);
  }

  private async printHrDocument(
    type: 'leave' | 'permission' | 'overtime',
    id: string
  ): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<HrDocumentData>>(`${this.documentsUrl}/${type}/${id}`)
      );
      if (!res.success || !res.data) {
        this.toast.error(this.locale.t('print.toast.loadFailed'));
        return;
      }
      const html = this.buildHrDocumentHtml(res.data);
      const title =
        type === 'leave'
          ? this.locale.t('print.leave.title')
          : type === 'permission'
            ? this.locale.t('print.permission.title')
            : this.locale.t('print.overtime.title');
      this.openPrintWindow(title, html);
    } catch {
      this.toast.error(this.locale.t('print.toast.loadFailed'));
    }
  }

  private buildPayslipHtml(data: PayslipPrintData): string {
    const emp = data.employee ?? {};
    const profile = data.profile;
    const month = data.payrollRun?.month ?? '—';
    const summary = data.summary;

    const earningsRows = data.earnings
      .filter((line) => line.amount !== 0 || line.key === 'basic')
      .map(
        (line) => `
        <tr>
          <td>${this.escape(this.translateLineLabel(line))}</td>
          <td class="muted">${this.escape(line.detail ?? '—')}</td>
          <td class="num">${this.formatMoney(line.amount)}</td>
        </tr>`
      )
      .join('');

    const deductionRows =
      data.deductions.length > 0
        ? data.deductions
            .map(
              (line) => `
        <tr>
          <td>${this.escape(this.translateLineLabel(line))}</td>
          <td class="muted">${this.escape(line.detail ?? '—')}</td>
          <td class="num danger">${this.formatMoney(line.amount)}</td>
        </tr>`
            )
            .join('')
        : `<tr><td colspan="3" class="muted center">—</td></tr>`;

    return `
      ${this.docHeader(this.locale.t('print.payslip.title'))}
      <div class="meta-grid">
        <div><span class="label">${this.locale.t('print.payslip.reference')}</span><strong>${this.escape(data.reference)}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.period')}</span><strong>${this.escape(month)}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.generatedAt')}</span><strong>${this.formatDateTime(data.printedAt)}</strong></div>
      </div>

      <h2>${this.locale.t('print.payslip.employeeInfo')}</h2>
      <div class="info-grid">
        <div><span class="label">${this.locale.t('common.employee')}</span><strong>${this.escape(emp.name ?? '—')}</strong></div>
        <div><span class="label">${this.locale.t('common.email')}</span><strong>${this.escape(emp.email ?? '—')}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.department')}</span><strong>${this.escape(profile?.department ?? '—')}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.jobTitle')}</span><strong>${this.escape(profile?.roleTitle ?? '—')}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.employeeId')}</span><strong>${this.escape(profile?.employeeId ?? '—')}</strong></div>
        <div><span class="label">${this.locale.t('common.role')}</span><strong>${this.escape(this.locale.roleLabel(emp.role ?? ''))}</strong></div>
      </div>

      <h2>${this.locale.t('print.payslip.attendanceSummary')}</h2>
      <div class="info-grid compact">
        <div><span class="label">${this.locale.t('print.payslip.workedDays')}</span><strong>${summary.workedDays}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.absentDays')}</span><strong>${summary.absentDays}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.paidLeaves')}</span><strong>${summary.paidLeaves}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.unpaidLeaves')}</span><strong>${summary.unpaidLeaves}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.lateMinutes')}</span><strong>${data.payslip.lateMinutes}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.overtimeHours')}</span><strong>${data.payslip.overtimeHours}</strong></div>
      </div>

      <div class="two-col">
        <div>
          <h2>${this.locale.t('print.payslip.earnings')}</h2>
          <table>
            <thead>
              <tr>
                <th>${this.locale.t('print.payslip.item')}</th>
                <th>${this.locale.t('print.payslip.detail')}</th>
                <th class="num">${this.locale.t('print.payslip.amount')}</th>
              </tr>
            </thead>
            <tbody>${earningsRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2"><strong>${this.locale.t('print.payslip.totalEarnings')}</strong></td>
                <td class="num"><strong>${this.formatMoney(summary.totalEarnings)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div>
          <h2>${this.locale.t('print.payslip.deductions')}</h2>
          <table>
            <thead>
              <tr>
                <th>${this.locale.t('print.payslip.item')}</th>
                <th>${this.locale.t('print.payslip.detail')}</th>
                <th class="num">${this.locale.t('print.payslip.amount')}</th>
              </tr>
            </thead>
            <tbody>${deductionRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2"><strong>${this.locale.t('print.payslip.totalDeductions')}</strong></td>
                <td class="num danger"><strong>${this.formatMoney(summary.totalDeductions)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="net-box">
        <span>${this.locale.t('print.payslip.netPay')}</span>
        <strong>${this.formatMoney(summary.netSalary)}</strong>
      </div>
    `;
  }

  private buildHrDocumentHtml(data: HrDocumentData): string {
    const emp = data.employee ?? {};
    const profile = data.profile;
    const title =
      data.type === 'leave'
        ? this.locale.t('print.leave.title')
        : data.type === 'permission'
          ? this.locale.t('print.permission.title')
          : this.locale.t('print.overtime.title');

    const typeRow =
      data.type === 'leave'
        ? `<div><span class="label">${this.locale.t('print.document.leaveType')}</span><strong>${this.escape(this.leaveTypeLabel(data.leaveType ?? ''))}</strong></div>`
        : data.type === 'permission'
          ? `<div><span class="label">${this.locale.t('print.document.permissionType')}</span><strong>${this.escape(this.permissionTypeLabel(data.permissionType ?? ''))}</strong></div>`
          : `<div><span class="label">${this.locale.t('print.document.rate')}</span><strong>${data.multiplier ?? 1}×</strong></div>`;

    const periodRow =
      data.type === 'leave'
        ? `<div><span class="label">${this.locale.t('print.document.period')}</span><strong>${this.formatDate(data.startDate)} → ${this.formatDate(data.endDate)}</strong></div>
           <div><span class="label">${this.locale.t('print.document.duration')}</span><strong>${data.durationDays ?? 0} ${this.locale.t('common.days')}</strong></div>`
        : data.type === 'permission'
          ? `<div><span class="label">${this.locale.t('print.document.date')}</span><strong>${this.formatDate(data.date)}</strong></div>
             <div><span class="label">${this.locale.t('print.document.time')}</span><strong>${this.escape(data.fromTime ?? '')} – ${this.escape(data.toTime ?? '')}</strong></div>
             <div><span class="label">${this.locale.t('print.document.duration')}</span><strong>${data.durationMinutes ?? 0} ${this.locale.t('common.minutes')}</strong></div>`
          : `<div><span class="label">${this.locale.t('print.document.date')}</span><strong>${this.formatDate(data.date)}</strong></div>
             <div><span class="label">${this.locale.t('print.document.time')}</span><strong>${this.escape(data.startTime ?? '')} – ${this.escape(data.endTime ?? '')}</strong></div>
             <div><span class="label">${this.locale.t('print.document.hours')}</span><strong>${data.durationHours ?? 0}</strong></div>`;

    const approvalBlock = data.approvedBy
      ? `<div><span class="label">${this.locale.t('print.document.approvedBy')}</span><strong>${this.escape(this.userName(data.approvedBy))}</strong></div>
         ${data.approvedAt ? `<div><span class="label">${this.locale.t('print.document.approvedAt')}</span><strong>${this.formatDateTime(data.approvedAt)}</strong></div>` : ''}`
      : '';

    const rejectionBlock =
      data.status === 'rejected' && data.rejectionReason
        ? `<div class="notice danger"><span class="label">${this.locale.t('print.document.rejectionReason')}</span><p>${this.escape(data.rejectionReason)}</p></div>`
        : '';

    return `
      ${this.docHeader(title)}
      <div class="meta-grid">
        <div><span class="label">${this.locale.t('print.document.reference')}</span><strong>${this.escape(data.reference)}</strong></div>
        <div><span class="label">${this.locale.t('print.document.submittedAt')}</span><strong>${this.formatDateTime(data.submittedAt)}</strong></div>
        <div><span class="label">${this.locale.t('common.status')}</span><strong>${this.escape(this.requestStatusLabel(data.status))}</strong></div>
      </div>

      <h2>${this.locale.t('print.payslip.employeeInfo')}</h2>
      <div class="info-grid">
        <div><span class="label">${this.locale.t('common.employee')}</span><strong>${this.escape(emp.name ?? '—')}</strong></div>
        <div><span class="label">${this.locale.t('common.email')}</span><strong>${this.escape(emp.email ?? '—')}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.department')}</span><strong>${this.escape(profile?.department ?? '—')}</strong></div>
        <div><span class="label">${this.locale.t('print.payslip.jobTitle')}</span><strong>${this.escape(profile?.roleTitle ?? '—')}</strong></div>
      </div>

      <h2>${this.locale.t('common.requestType')}</h2>
      <div class="info-grid">
        ${typeRow}
        ${periodRow}
      </div>

      <div class="notice">
        <span class="label">${this.locale.t('print.document.reason')}</span>
        <p>${this.escape(data.reason || '—')}</p>
      </div>

      ${rejectionBlock}

      ${approvalBlock ? `<h2>${this.locale.t('common.decision')}</h2><div class="info-grid">${approvalBlock}</div>` : ''}

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <span>${this.locale.t('print.document.employeeSignature')}</span>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <span>${this.locale.t('print.document.managerSignature')}</span>
        </div>
      </div>
    `;
  }

  private docHeader(title: string): string {
    return `
      <header class="doc-header">
        <div>
          <div class="brand">${this.locale.t('print.companyName')}</div>
          <h1>${this.escape(title)}</h1>
        </div>
      </header>
    `;
  }

  private openPrintWindow(title: string, bodyHtml: string): void {
    const html = this.buildPrintDocumentHtml(title, bodyHtml);
    const iframe = document.createElement('iframe');
    iframe.setAttribute(
      'style',
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    );
    iframe.setAttribute('title', title);
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) {
      iframe.remove();
      this.toast.error(this.locale.t('print.toast.loadFailed'));
      return;
    }

    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      win.onafterprint = null;
      iframe.remove();
    };

    win.onafterprint = cleanup;
    // Fallback if the browser never fires afterprint
    window.setTimeout(cleanup, 60_000);

    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = (): void => {
      if (cleanedUp) return;
      win.focus();
      win.print();
    };

    let printScheduled = false;
    const schedulePrint = (): void => {
      if (printScheduled) return;
      printScheduled = true;
      window.setTimeout(triggerPrint, 300);
    };

    iframe.onload = schedulePrint;
    if (doc.readyState === 'complete') {
      schedulePrint();
    }
  }

  private buildPrintDocumentHtml(title: string, bodyHtml: string): string {
    const dir = this.locale.isRtl() ? 'rtl' : 'ltr';
    const lang = this.locale.locale();
    const fontFamily = dir === 'rtl'
      ? "'Cairo', 'Segoe UI', Tahoma, sans-serif"
      : "'Segoe UI', system-ui, sans-serif";

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${this.escape(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: ${fontFamily};
      color: #111827;
      background: #fff;
      font-size: 13px;
      line-height: 1.5;
    }
    .doc-header { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
    .brand { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280; }
    h1 { margin: 4px 0 0; font-size: 22px; }
    h2 { margin: 20px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; }
    .label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 2px; }
    .meta-grid, .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 8px; }
    .info-grid.compact { grid-template-columns: repeat(6, 1fr); }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: start; vertical-align: top; }
    th { background: #f9fafb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    .num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .muted { color: #6b7280; font-size: 11px; }
    .center { text-align: center; }
    .danger { color: #b91c1c; }
    tfoot td { background: #f9fafb; }
    .net-box {
      margin-top: 24px;
      padding: 16px 20px;
      border: 2px solid #4f46e5;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
    }
    .net-box strong { font-size: 22px; color: #4f46e5; }
    .notice { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 12px 0; background: #f9fafb; }
    .notice.danger { border-color: #fecaca; background: #fef2f2; }
    .notice p { margin: 4px 0 0; white-space: pre-wrap; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
    .sig-box { text-align: center; }
    .sig-line { border-bottom: 1px solid #111; height: 48px; margin-bottom: 8px; }
    @media print {
      body { padding: 0; }
      @page { margin: 14mm; }
    }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
  }

  private translateLineLabel(line: PrintLine): string {
    const map: Record<string, string> = {
      basic: this.locale.t('common.basic'),
      overtime: this.locale.t('common.overtime'),
      late: this.locale.t('common.late'),
      absence: this.locale.t('common.absence'),
      bonus: this.locale.t('common.bonus'),
      allowance: this.locale.t('common.allowance'),
      commission: this.locale.t('common.commission'),
      penalty: this.locale.t('common.penalty'),
      manual: this.locale.t('common.manual'),
    };
    if (line.key && map[line.key]) return map[line.key];
    if (line.key?.startsWith('bonus-') || line.key?.startsWith('deduction-')) {
      const sub = line.label;
      return map[sub] ?? sub.replace(/_/g, ' ');
    }
    return line.label.replace(/_/g, ' ');
  }

  private leaveTypeLabel(type: string): string {
    const keys: Record<string, string> = {
      annual: 'common.annualLeave',
      sick: 'common.sickLeave',
      unpaid: 'common.unpaidLeave',
      emergency: 'common.emergencyLeave',
    };
    const key = keys[type];
    return key ? this.locale.t(key) : type;
  }

  private permissionTypeLabel(type: string): string {
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

  private requestStatusLabel(status: string): string {
    const keys: Record<string, string> = {
      pending: 'common.pending',
      approved: 'common.approved',
      rejected: 'common.rejected',
      cancelled: 'common.cancelled',
    };
    const key = keys[status];
    return key ? this.locale.t(key) : status;
  }

  private userName(user: PopulatedUser | null | undefined): string {
    if (!user) return '—';
    return user.name ?? '—';
  }

  private formatMoney(amount: number): string {
    const loc = this.locale.locale() === 'ar' ? 'ar-EG' : 'en-US';
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 2,
    }).format(amount ?? 0);
  }

  private formatDate(value?: string): string {
    if (!value) return '—';
    const loc = this.locale.locale() === 'ar' ? 'ar-EG' : 'en-US';
    return new Date(value).toLocaleDateString(loc, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private formatDateTime(value?: string): string {
    if (!value) return '—';
    const loc = this.locale.locale() === 'ar' ? 'ar-EG' : 'en-US';
    return new Date(value).toLocaleString(loc, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
