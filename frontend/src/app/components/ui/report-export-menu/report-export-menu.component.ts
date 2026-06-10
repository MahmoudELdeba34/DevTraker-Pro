import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
} from '@angular/core';
import { ExportableReport, ReportExportFormat } from '../../../core/export/report-export.types';
import { ReportExportService } from '../../../core/export/report-export.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-report-export-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        class="btn-soft"
        [disabled]="disabled() || exporting()"
        (click)="export('pdf')"
        [attr.aria-label]="'export.pdf' | translate"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        {{ 'export.pdf' | translate }}
      </button>
      <button
        type="button"
        class="btn-soft"
        [disabled]="disabled() || exporting()"
        (click)="export('excel')"
        [attr.aria-label]="'export.excel' | translate"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
        {{ 'export.excel' | translate }}
      </button>
      <button
        type="button"
        class="btn-soft"
        [disabled]="disabled() || exporting()"
        (click)="export('word')"
        [attr.aria-label]="'export.word' | translate"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h6M8 16h4"/>
        </svg>
        {{ 'export.word' | translate }}
      </button>
      <button
        type="button"
        class="btn-accent"
        [disabled]="disabled()"
        (click)="printReport()"
        [attr.aria-label]="'common.printReport' | translate"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        {{ 'common.printReport' | translate }}
      </button>
    </div>
  `,
})
export class ReportExportMenuComponent {
  private exportService = inject(ReportExportService);

  payload = input<ExportableReport | null>(null);
  disabled = input(false);

  exporting = signal(false);

  async export(format: ReportExportFormat): Promise<void> {
    const data = this.payload();
    if (!data || this.exporting()) return;
    this.exporting.set(true);
    try {
      await this.exportService.export(format, data);
    } finally {
      this.exporting.set(false);
    }
  }

  printReport(): void {
    window.print();
  }
}
