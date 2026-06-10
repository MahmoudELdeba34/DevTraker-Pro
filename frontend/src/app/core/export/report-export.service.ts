import { Injectable, inject } from '@angular/core';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  WidthType,
  AlignmentType,
} from 'docx';
import * as XLSX from 'xlsx';
import { LocaleService } from '../i18n/locale.service';
import { ToastService } from '../../services/toast.service';
import { ExportableReport, ReportExportFormat } from './report-export.types';

@Injectable({ providedIn: 'root' })
export class ReportExportService {
  private locale = inject(LocaleService);
  private toast = inject(ToastService);

  async export(format: ReportExportFormat, data: ExportableReport): Promise<void> {
    try {
      if (format === 'pdf') {
        await this.exportPdf(data);
      } else if (format === 'excel') {
        this.exportExcel(data);
      } else {
        await this.exportWord(data);
      }
      this.toast.success(this.locale.t('export.success'));
    } catch {
      this.toast.error(this.locale.t('export.failed'));
    }
  }

  private async exportPdf(data: ExportableReport): Promise<void> {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = this.buildHtmlElement(data);
    document.body.appendChild(element);

    try {
      await html2pdf()
        .set({
          margin: [12, 12, 12, 12],
          filename: `${data.filenameBase}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();
    } finally {
      document.body.removeChild(element);
    }
  }

  private exportExcel(data: ExportableReport): void {
    const t = this.locale.t.bind(this.locale);
    const wb = XLSX.utils.book_new();

    const metaRows = [
      [data.companyName],
      [data.title],
      [t('export.employee'), data.employeeName],
      [t('common.email'), data.employeeEmail],
      [t('common.status'), data.employeeRole],
      [t('export.period'), data.periodLabel],
      [t('export.generatedAt'), data.generatedAt],
      [],
    ];
    const summaryRows = [
      [t('export.sheet.summary')],
      [t('export.col.label'), t('export.col.value')],
      ...data.summary.map((r) => [r.label, r.value]),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([...metaRows, ...summaryRows]),
      t('export.sheet.summary')
    );

    const dailyTable = this.buildDailyTable(data);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([dailyTable.headers, ...dailyTable.rows]),
      t('export.sheet.daily')
    );

    const detailHeader = [
      t('export.col.date'),
      t('export.col.type'),
      t('export.col.title'),
      t('export.col.project'),
      t('export.col.start'),
      t('export.col.end'),
      t('export.col.duration'),
    ];
    const detailRows = data.details.map((d) => [
      d.date,
      d.type,
      d.title,
      d.project ?? '—',
      d.start ?? '—',
      d.end ?? '—',
      d.duration,
    ]);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]),
      t('export.sheet.details')
    );

    XLSX.writeFile(wb, `${data.filenameBase}.xlsx`);
  }

  private async exportWord(data: ExportableReport): Promise<void> {
    const t = this.locale.t.bind(this.locale);
    const rtl = this.locale.isRtl();

    const metaTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        this.wordRow([t('export.employee'), data.employeeName], rtl),
        this.wordRow([t('common.email'), data.employeeEmail], rtl),
        this.wordRow([t('common.status'), data.employeeRole], rtl),
        this.wordRow([t('export.period'), data.periodLabel], rtl),
        this.wordRow([t('export.generatedAt'), data.generatedAt], rtl),
      ],
    });

    const summaryTable = this.wordDataTable(
      [t('export.col.label'), t('export.col.value')],
      data.summary.map((r) => [r.label, r.value]),
      rtl
    );

    const dailyTableData = this.buildDailyTable(data);
    const dailyTable = this.wordDataTable(dailyTableData.headers, dailyTableData.rows, rtl);

    const detailTable = this.wordDataTable(
      [
        t('export.col.date'),
        t('export.col.type'),
        t('export.col.title'),
        t('export.col.project'),
        t('export.col.duration'),
      ],
      data.details.map((d) => [
        d.date,
        d.type,
        d.title,
        d.project ?? '—',
        d.duration,
      ]),
      rtl
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: data.companyName, bold: true, size: 28 })],
              alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            }),
            new Paragraph({
              text: data.title,
              heading: HeadingLevel.HEADING_1,
              bidirectional: rtl,
            }),
            metaTable,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: t('export.sheet.summary'),
              heading: HeadingLevel.HEADING_2,
              bidirectional: rtl,
            }),
            summaryTable,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: t('export.sheet.daily'),
              heading: HeadingLevel.HEADING_2,
              bidirectional: rtl,
            }),
            dailyTable,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: t('export.sheet.details'),
              heading: HeadingLevel.HEADING_2,
              bidirectional: rtl,
            }),
            detailTable,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    this.downloadBlob(blob, `${data.filenameBase}.docx`);
  }

  private wordRow(cells: [string, string], rtl: boolean): TableRow {
    return new TableRow({
      children: cells.map(
        (text, i) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: i === 0 })],
                bidirectional: rtl,
              }),
            ],
          })
      ),
    });
  }

  private wordDataTable(headers: string[], rows: string[][], rtl: boolean): Table {
    const headerRow = new TableRow({
      children: headers.map(
        (h) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true })],
                bidirectional: rtl,
              }),
            ],
          })
      ),
    });
    const bodyRows = rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: cell })],
                    bidirectional: rtl,
                  }),
                ],
              })
          ),
        })
    );
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...bodyRows],
    });
  }

  private buildHtmlElement(data: ExportableReport): HTMLElement {
    const t = this.locale.t.bind(this.locale);
    const rtl = this.locale.isRtl();
    const dir = rtl ? 'rtl' : 'ltr';
    const align = rtl ? 'right' : 'left';

    const summaryRows = data.summary
      .map(
        (r) =>
          `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;width:40%">${this.escapeHtml(r.label)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${this.escapeHtml(r.value)}</td></tr>`
      )
      .join('');

    const dailyTable = this.buildDailyTable(data);
    const th = (label: string) =>
      `<th style="padding:8px 10px;border:1px solid #c7d2fe;text-align:inherit;">${this.escapeHtml(label)}</th>`;
    const dailyHead = dailyTable.headers.map((h) => th(h)).join('');
    const dailyRows = dailyTable.rows
      .map(
        (cells) =>
          `<tr>${cells.map((c) => `<td style="padding:6px 10px;border:1px solid #e2e8f0">${this.escapeHtml(c)}</td>`).join('')}</tr>`
      )
      .join('');
    const dailyColspan = dailyTable.headers.length;

    const detailRows = data.details
      .map(
        (d) =>
          `<tr>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${this.escapeHtml(d.date)}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${this.escapeHtml(d.type)}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${this.escapeHtml(d.title)}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${this.escapeHtml(d.project ?? '—')}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${this.escapeHtml(d.duration)}</td>
          </tr>`
      )
      .join('');

    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:fixed;left:-9999px;top:0;width:794px;background:#fff;color:#0f172a;font-family:Cairo,Segoe UI,sans-serif;';
    wrapper.innerHTML = `
      <div dir="${dir}" style="padding:32px;text-align:${align};font-size:13px;line-height:1.5;">
        <div style="border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:24px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${this.escapeHtml(data.companyName)}</div>
          <h1 style="margin:8px 0 4px;font-size:22px;font-weight:800;color:#0f172a;">${this.escapeHtml(data.title)}</h1>
          <div style="font-size:12px;color:#475569;">${this.escapeHtml(data.employeeName)} · ${this.escapeHtml(data.employeeEmail)} · ${this.escapeHtml(data.employeeRole)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:6px;">${this.escapeHtml(data.periodLabel)} · ${t('export.generatedAt')}: ${this.escapeHtml(data.generatedAt)}</div>
        </div>

        <h2 style="font-size:15px;font-weight:700;margin:0 0 10px;color:#334155;">${t('export.sheet.summary')}</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${summaryRows}</table>

        <h2 style="font-size:15px;font-weight:700;margin:0 0 10px;color:#334155;">${t('export.sheet.daily')}</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
          <thead><tr style="background:#eef2ff;color:#3730a3;">${dailyHead}</tr></thead>
          <tbody>${dailyRows || `<tr><td colspan="${dailyColspan}" style="padding:12px;text-align:center;color:#94a3b8">${t('common.noLogsInPeriod')}</td></tr>`}</tbody>
        </table>

        <h2 style="font-size:15px;font-weight:700;margin:0 0 10px;color:#334155;">${t('export.sheet.details')}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#eef2ff;color:#3730a3;">
              <th style="padding:8px 10px;border:1px solid #c7d2fe;">${t('export.col.date')}</th>
              <th style="padding:8px 10px;border:1px solid #c7d2fe;">${t('export.col.type')}</th>
              <th style="padding:8px 10px;border:1px solid #c7d2fe;">${t('export.col.title')}</th>
              <th style="padding:8px 10px;border:1px solid #c7d2fe;">${t('export.col.project')}</th>
              <th style="padding:8px 10px;border:1px solid #c7d2fe;">${t('export.col.duration')}</th>
            </tr>
          </thead>
          <tbody>${detailRows || `<tr><td colspan="5" style="padding:12px;text-align:center;color:#94a3b8">${t('common.noLogsInPeriod')}</td></tr>`}</tbody>
        </table>
      </div>
    `;
    return wrapper;
  }

  private buildDailyTable(data: ExportableReport): { headers: string[]; rows: string[][] } {
    const t = this.locale.t.bind(this.locale);
    const hasRegular = !!data.daily[0]?.regular;
    const hasAttendance = data.daily.some((d) => d.attendance && d.attendance !== '—');

    if (hasRegular) {
      const headers = [
        t('export.col.date'),
        t('export.col.hoursWorked'),
        t('export.col.regularUpTo7'),
        t('export.col.overtimeAfter7'),
        ...(hasAttendance ? [t('export.col.attendance')] : []),
        t('export.col.tasks'),
      ];
      const rows = data.daily.map((d) => [
        d.dateLabel,
        d.tracked,
        d.regular ?? '—',
        d.overtime,
        ...(hasAttendance ? [d.attendance ?? '—'] : []),
        String(d.tasksCount),
      ]);
      return { headers, rows };
    }

    return {
      headers: [
        t('export.col.date'),
        t('export.col.hoursWorked'),
        t('export.col.overtimeAfter7'),
        t('export.col.attendance'),
        t('export.col.tasks'),
      ],
      rows: data.daily.map((d) => [
        d.dateLabel,
        d.tracked,
        d.overtime,
        d.attendance ?? '—',
        String(d.tasksCount),
      ]),
    };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
