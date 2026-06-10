export interface ExportSummaryRow {
  label: string;
  value: string;
}

export interface ExportDailyRow {
  date: string;
  dateLabel: string;
  tracked: string;
  regular?: string;
  overtime: string;
  attendance?: string;
  tasksCount: number;
}

export interface ExportDetailRow {
  date: string;
  type: string;
  title: string;
  project?: string;
  start?: string;
  end?: string;
  duration: string;
}

export interface ExportableReport {
  title: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  periodLabel: string;
  generatedAt: string;
  companyName: string;
  summary: ExportSummaryRow[];
  daily: ExportDailyRow[];
  details: ExportDetailRow[];
  filenameBase: string;
}

export type ReportExportFormat = 'pdf' | 'excel' | 'word';
