import { Injectable, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'protrack-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<AppTheme>('light');

  init(): void {
    const saved = localStorage.getItem(STORAGE_KEY) as AppTheme | null;
    if (saved === 'light' || saved === 'dark') {
      this.apply(saved, false);
    } else {
      this.apply('light', true);
    }
  }

  toggleTheme(): AppTheme {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.apply(next, true);
    return next;
  }

  setTheme(theme: AppTheme): void {
    this.apply(theme, true);
  }

  isLight(): boolean {
    return this.theme() === 'light';
  }

  private apply(theme: AppTheme, persist: boolean): void {
    this.theme.set(theme);
    if (persist) localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }
}
