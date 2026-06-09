import { Injectable, signal } from '@angular/core';
import { AppLocale, TRANSLATIONS } from './translations/index';

const STORAGE_KEY = 'protrack-locale';

const STATUS_KEYS: Record<string, string> = {
  not_started: 'task.status.notStarted',
  in_progress: 'task.status.inProgress',
  in_review: 'task.status.inReview',
  completed: 'task.status.completed',
  todo: 'task.status.todo',
};

const PRIORITY_KEYS: Record<string, string> = {
  low: 'task.priority.low',
  medium: 'task.priority.medium',
  high: 'task.priority.high',
};

const ROLE_KEYS: Record<string, string> = {
  employee: 'role.global.employee',
  manager: 'role.global.manager',
  hr: 'role.global.hr',
  accountant: 'role.global.accountant',
  admin: 'role.global.admin',
};

@Injectable({ providedIn: 'root' })
export class LocaleService {
  readonly locale = signal<AppLocale>('en');

  init(): void {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
    if (saved === 'en' || saved === 'ar') {
      this.apply(saved, false);
    }
  }

  isRtl(): boolean {
    return this.locale() === 'ar';
  }

  toggleLocale(): AppLocale {
    const next = this.locale() === 'en' ? 'ar' : 'en';
    this.apply(next, true);
    return next;
  }

  setLocale(locale: AppLocale): void {
    this.apply(locale, true);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const loc = this.locale();
    let text = TRANSLATIONS[loc][key] ?? TRANSLATIONS.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }
    return text;
  }

  statusLabel(status: string): string {
    const key = STATUS_KEYS[status];
    return key ? this.t(key) : status.replace(/_/g, ' ');
  }

  priorityLabel(priority: string): string {
    const key = PRIORITY_KEYS[priority];
    return key ? this.t(key) : priority;
  }

  roleLabel(role: string): string {
    const key = ROLE_KEYS[role];
    return key ? this.t(key) : role;
  }

  private apply(locale: AppLocale, persist: boolean): void {
    this.locale.set(locale);
    if (persist) localStorage.setItem(STORAGE_KEY, locale);
    const rtl = locale === 'ar';
    document.documentElement.lang = locale;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.body.classList.toggle('is-rtl', rtl);
    document.body.classList.toggle('is-ltr', !rtl);
  }
}
