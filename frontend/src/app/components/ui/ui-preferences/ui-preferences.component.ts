import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleService } from '../../../core/i18n/locale.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-ui-preferences',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="inline-flex items-center gap-1.5" [class.flex-row-reverse]="compact()">
      <button
        type="button"
        class="pref-btn"
        [title]="locale.t('prefs.language')"
        (click)="toggleLanguage()"
      >
        <span class="text-[11px] font-bold tracking-wide">{{ locale.locale() === 'ar' ? 'EN' : 'ع' }}</span>
      </button>
      <button
        type="button"
        class="pref-btn"
        [title]="theme.isLight() ? locale.t('prefs.dark') : locale.t('prefs.light')"
        (click)="toggleTheme()"
      >
        @if (theme.isLight()) {
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        } @else {
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        }
      </button>
    </div>
  `,
  styles: [
    `
      .pref-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 0.625rem;
        border: 1px solid var(--color-border);
        background: var(--color-bg-elevated);
        color: var(--text-secondary);
        transition: all 0.15s ease;
      }
      .pref-btn:hover {
        color: var(--text-primary);
        border-color: var(--color-border-strong);
        background: var(--color-bg-hover);
      }
    `,
  ],
})
export class UiPreferencesComponent {
  compact = input(false);

  locale = inject(LocaleService);
  theme = inject(ThemeService);
  private toast = inject(ToastService);

  toggleLanguage(): void {
    const next = this.locale.toggleLocale();
    this.toast.info(next === 'ar' ? this.locale.t('toast.langAr') : this.locale.t('toast.langEn'));
  }

  toggleTheme(): void {
    const next = this.theme.toggleTheme();
    this.toast.info(
      next === 'light' ? this.locale.t('toast.themeLight') : this.locale.t('toast.themeDark')
    );
  }
}
