import { ActivityDay, ActivityReport } from '../../models/types';
import { ReportSummaryResponse } from '../../services/report.service';
import { LocaleService } from '../i18n/locale.service';
import { ExportableReport, ExportDailyRow, ExportDetailRow } from './report-export.types';

const DEFAULT_DAILY_THRESHOLD_MS = 7 * 60 * 60 * 1000;

function formatHm(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDecimalHours(ms: number): string {
  return `${(Math.max(0, ms) / 3_600_000).toFixed(2)}h`;
}

function formatHoursValue(ms: number): string {
  return `${formatDecimalHours(ms)} (${formatHm(ms)})`;
}

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

function dayWorkedMs(day: ActivityDay): number {
  return day.trackedMs || day.attendanceMs || 0;
}

function formatClock(iso: string | null | undefined, locale: LocaleService): string {
  if (!iso) return '—';
  return locale.formatClockTime(new Date(iso), false);
}

function formatDateLabel(date: string, locale: LocaleService): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(locale.dateLocale(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildFilenameBase(employeeName: string, from: string, to: string): string {
  const safe = employeeName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'report';
  const range = from && to ? `_${from}_${to}` : '';
  return `WorkTrack_${safe}${range}`;
}

function periodLabel(locale: LocaleService, from: string, to: string): string {
  if (from && to) {
    return locale.t('export.periodRange', { from, to });
  }
  return locale.t('export.periodAll');
}

export function activityReportToExportable(
  report: ActivityReport,
  locale: LocaleService,
  from: string,
  to: string,
  title: string
): ExportableReport {
  const thresholdMs = report.summary.dailyThresholdMs || DEFAULT_DAILY_THRESHOLD_MS;
  const thresholdHours = Math.round(thresholdMs / 3_600_000);

  let totalWorkedMs = 0;
  let totalRegularMs = 0;

  const daily: ExportDailyRow[] = report.daily.map((day) => {
    const worked = dayWorkedMs(day);
    const regular = Math.min(worked, thresholdMs);
    totalWorkedMs += worked;
    totalRegularMs += regular;

    return {
      date: day.date,
      dateLabel: formatDateLabel(day.date, locale),
      tracked: formatHoursValue(worked),
      regular: formatHoursValue(regular),
      overtime: formatHoursValue(day.overtimeMs),
      attendance: day.attendance?.status ?? '—',
      tasksCount: day.taskLogs.length + day.quickSessions.length,
    };
  });

  const summary = [
    { label: locale.t('export.overtimeRule'), value: locale.t('export.overtimeRuleValue', { hours: thresholdHours }) },
    { label: locale.t('export.totalHoursWorked'), value: formatHoursValue(totalWorkedMs) },
    {
      label: locale.t('export.regularHoursPerDay', { hours: thresholdHours }),
      value: formatHoursValue(totalRegularMs),
    },
    {
      label: locale.t('export.overtimeAfterHours', { hours: thresholdHours }),
      value: formatHoursValue(report.summary.totalOvertimeMs),
    },
    { label: locale.t('common.daysWorked'), value: String(report.summary.daysWorked) },
    { label: locale.t('common.tasksQuick'), value: `${report.summary.tasksWorked} / ${report.summary.quickSessionsCount}` },
    { label: locale.t('export.daysPresent'), value: String(report.summary.daysPresent) },
    { label: locale.t('export.daysLate'), value: String(report.summary.daysLate) },
    { label: locale.t('export.daysAbsent'), value: String(report.summary.daysAbsent) },
    { label: locale.t('export.avgDaily'), value: `${report.summary.averageDailyHours.toFixed(2)}h` },
  ];

  const details: ExportDetailRow[] = [];
  for (const day of report.daily) {
    for (const log of day.taskLogs) {
      details.push({
        date: day.date,
        type: locale.t('common.task'),
        title: log.taskTitle,
        project: log.projectTitle || '—',
        start: formatClock(log.start, locale),
        end: formatClock(log.end, locale),
        duration: formatHm(log.durationMs),
      });
    }
    for (const q of day.quickSessions) {
      details.push({
        date: day.date,
        type: locale.t('common.quick'),
        title: q.description || locale.t('export.quickSession'),
        project: '—',
        start: formatClock(q.startedAt, locale),
        end: formatClock(q.endedAt, locale),
        duration: formatHm(q.durationMs),
      });
    }
  }

  return {
    title,
    employeeName: report.user.name,
    employeeEmail: report.user.email,
    employeeRole: locale.roleLabel(report.user.role),
    periodLabel: periodLabel(locale, from, to),
    generatedAt: new Date().toLocaleString(locale.dateLocale()),
    companyName: locale.t('print.companyName'),
    summary,
    daily,
    details,
    filenameBase: buildFilenameBase(report.user.name, from, to),
  };
}

export function summaryReportToExportable(
  report: ReportSummaryResponse,
  locale: LocaleService,
  startDate: string,
  endDate: string,
  title: string
): ExportableReport {
  const thresholdHours = 7;

  const summary = [
    { label: locale.t('export.overtimeRule'), value: locale.t('export.overtimeRuleValue', { hours: thresholdHours }) },
    { label: locale.t('export.totalHoursWorked'), value: formatHours(report.summary.totalHours) },
    {
      label: locale.t('export.regularHoursPerDay', { hours: thresholdHours }),
      value: formatHours(report.summary.totalRegularHours),
    },
    {
      label: locale.t('export.overtimeAfterHours', { hours: thresholdHours }),
      value: formatHours(report.summary.totalOvertimeHours),
    },
    { label: locale.t('common.daysWorked'), value: String(report.summary.daysWorkedCount) },
  ];

  const daily: ExportDailyRow[] = report.days.map((day) => ({
    date: day.date,
    dateLabel: formatDateLabel(day.date, locale),
    tracked: formatHours(day.totalHours),
    regular: formatHours(day.regularHours),
    overtime: formatHours(day.overtimeHours),
    tasksCount: day.tasks.length,
  }));

  const details: ExportDetailRow[] = [];
  for (const day of report.days) {
    for (const task of day.tasks) {
      details.push({
        date: day.date,
        type: locale.t('common.task'),
        title: task.title,
        project: task.projectTitle || '—',
        duration: formatHours(task.hours),
      });
    }
  }

  return {
    title,
    employeeName: report.user.name,
    employeeEmail: report.user.email,
    employeeRole: locale.roleLabel(report.user.role),
    periodLabel: periodLabel(locale, startDate, endDate),
    generatedAt: new Date().toLocaleString(locale.dateLocale()),
    companyName: locale.t('print.companyName'),
    summary,
    daily,
    details,
    filenameBase: buildFilenameBase(report.user.name, startDate, endDate),
  };
}
