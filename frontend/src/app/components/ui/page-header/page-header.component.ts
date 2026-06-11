import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export interface PageHeaderStep {
  label: string;
  description?: string;
  /** Visual hint: 'do' (action), 'wait' (system step), 'done' (terminal) */
  tone?: 'do' | 'wait' | 'done';
}

export interface PageHeaderTip {
  title: string;
  body: string;
}

/**
 * A premium, ClickUp-inspired page header that explains:
 *   1. WHERE you are (eyebrow + title)
 *   2. WHAT you can do (description)
 *   3. HOW the flow works (collapsible "How it works" panel with steps + tips)
 *
 * Designed to be dropped at the top of any feature page.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="mb-6 animate-fade-up">
      <!-- Top row -->
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div class="min-w-0 flex-1">
          @if (eyebrow) {
            <div class="flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent font-bold mb-1.5">
              <span>{{ eyebrow }}</span>
              @if (badge) {
                <span class="px-1.5 py-0.5 rounded border font-bold normal-case tracking-normal text-[10px]"
                      [ngClass]="badgeClass()">{{ badge }}</span>
              }
            </div>
          }
          <h1 class="text-2xl sm:text-3xl md:text-[34px] font-display font-bold text-white tracking-tight leading-tight">
            {{ title }}
          </h1>
          @if (description) {
            <p class="text-sm text-text-secondary mt-1.5 max-w-3xl leading-relaxed">{{ description }}</p>
          }
        </div>
        <div class="flex flex-wrap items-center gap-2 w-full md:w-auto md:shrink-0">
          @if (hasSteps() || hasTips()) {
            <button
              (click)="toggleGuide()"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5"
              [ngClass]="expanded()
                ? 'bg-accent-subtle text-accent border-accent/40'
                : 'text-text-secondary border-border hover:text-white'"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              {{ expanded() ? ('pageHeader.hideGuide' | translate) : ('pageHeader.howItWorks' | translate) }}
            </button>
          }
          <ng-content select="[header-actions]"></ng-content>
        </div>
      </div>

      <!-- Guide panel (steps + tips) -->
      @if (expanded()) {
        <div class="mt-4 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent-subtle to-transparent p-5 animate-slide-down">
          @if (hasSteps()) {
            <div class="mb-4">
              <div class="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">{{ 'pageHeader.theFlow' | translate }}</div>
              <ol class="grid grid-cols-1 md:grid-cols-3 gap-3">
                @for (s of steps; track i; let i = $index) {
                  <li class="relative rounded-xl bg-bg-base border border-border p-3 flex gap-3">
                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                         [ngClass]="stepBubbleClass(s)">
                      {{ i + 1 }}
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-semibold text-white truncate">{{ s.label }}</div>
                      @if (s.description) {
                        <div class="text-[11px] text-text-muted mt-0.5 leading-snug">{{ s.description }}</div>
                      }
                    </div>
                    @if (i < steps.length - 1) {
                      <span class="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-4 h-4 items-center justify-center text-text-muted">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </span>
                    }
                  </li>
                }
              </ol>
            </div>
          }

          @if (hasTips()) {
            <div>
              <div class="text-[10px] font-bold text-accent uppercase tracking-widest mb-2">{{ 'pageHeader.goodToKnow' | translate }}</div>
              <ul class="space-y-2">
                @for (t of tips; track t.title) {
                  <li class="flex gap-2 text-xs text-text-secondary">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-accent shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <div>
                      <span class="text-white font-semibold">{{ t.title }}</span>
                      — <span>{{ t.body }}</span>
                    </div>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PageHeaderComponent {
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() description = '';
  @Input() badge?: string;
  @Input() badgeTone: 'info' | 'success' | 'warning' | 'danger' | 'accent' = 'accent';
  @Input() steps: PageHeaderStep[] = [];
  @Input() tips: PageHeaderTip[] = [];
  /** Open the guide panel by default — useful for first-time pages. */
  @Input() defaultOpen = false;

  expanded = signal(false);

  ngOnInit() {
    this.expanded.set(!!this.defaultOpen);
  }

  toggleGuide() {
    this.expanded.update((v) => !v);
  }

  hasSteps() {
    return this.steps && this.steps.length > 0;
  }

  hasTips() {
    return this.tips && this.tips.length > 0;
  }

  badgeClass(): string {
    switch (this.badgeTone) {
      case 'success':
        return 'bg-success/15 text-success border-success/40';
      case 'warning':
        return 'bg-warning/15 text-warning border-warning/40';
      case 'danger':
        return 'bg-danger/15 text-danger border-danger/40';
      case 'info':
        return 'bg-info/15 text-info border-info/40';
      default:
        return 'bg-accent-subtle text-accent border-accent/40';
    }
  }

  stepBubbleClass(s: PageHeaderStep): string {
    switch (s.tone) {
      case 'wait':
        return 'bg-warning/20 text-warning border border-warning/40';
      case 'done':
        return 'bg-success/20 text-success border border-success/40';
      default:
        return 'bg-accent/20 text-accent border border-accent/40';
    }
  }
}
