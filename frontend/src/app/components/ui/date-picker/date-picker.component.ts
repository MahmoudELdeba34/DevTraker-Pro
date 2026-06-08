import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface CalendarCell {
  date: Date;
  inMonth: boolean;
  iso: string;
}

/**
 * Dark-themed date picker popover — replaces the ugly native browser calendar.
 * Emits ISO date strings (YYYY-MM-DD) or null when cleared.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="relative inline-block" #root>
      <button
        type="button"
        class="dp-trigger"
        [class.dp-trigger--filled]="!!value"
        [class.dp-trigger--open]="open()"
        (click)="toggle($event)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 opacity-70">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span class="truncate">{{ displayLabel() }}</span>
        @if (value) {
          <span
            class="dp-clear"
            role="button"
            tabindex="0"
            title="Clear date"
            (click)="clear($event)"
            (keydown.enter)="clear($event)"
          >×</span>
        }
      </button>

      @if (open()) {
        <div class="dp-popover animate-scale-in" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="dp-header">
            <button type="button" class="dp-nav" (click)="prevMonth()" aria-label="Previous month">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="dp-month-label">{{ monthLabel() }}</div>
            <button type="button" class="dp-nav" (click)="nextMonth()" aria-label="Next month">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <!-- Weekday headers -->
          <div class="dp-grid dp-grid--head">
            @for (d of weekDays; track d) {
              <span class="dp-dow">{{ d }}</span>
            }
          </div>

          <!-- Days -->
          <div class="dp-grid">
            @for (cell of calendarCells(); track cell.iso + cell.inMonth) {
              <button
                type="button"
                class="dp-day"
                [class.dp-day--muted]="!cell.inMonth"
                [class.dp-day--today]="isToday(cell.date)"
                [class.dp-day--selected]="isSelected(cell.iso)"
                [class.dp-day--overdue]="showOverdue && isOverdue(cell.iso)"
                (click)="selectDate(cell)"
              >
                {{ cell.date.getDate() }}
              </button>
            }
          </div>

          <!-- Footer -->
          <div class="dp-footer">
            <button type="button" class="dp-footer-btn" (click)="pickToday()">Today</button>
            <button type="button" class="dp-footer-btn dp-footer-btn--muted" (click)="clear($event)">Clear</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dp-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      max-width: 100%;
      padding: 0.4rem 0.65rem;
      border-radius: 0.5rem;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      color: #94a3b8;
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .dp-trigger:hover, .dp-trigger--open {
      color: #fff;
      border-color: rgba(99,102,241,0.45);
      background: rgba(99,102,241,0.08);
      box-shadow: 0 0 12px rgba(99,102,241,0.12);
    }
    .dp-trigger--filled { color: #e2e8f0; }
    .dp-clear {
      margin-left: 0.15rem;
      width: 1.1rem;
      height: 1.1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      font-size: 0.85rem;
      line-height: 1;
      color: #64748b;
      transition: all 0.15s;
    }
    .dp-clear:hover { background: rgba(239,68,68,0.15); color: #f87171; }

    .dp-popover {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 60;
      width: 17.5rem;
      padding: 0.75rem;
      border-radius: 0.875rem;
      border: 1px solid rgba(99,102,241,0.25);
      background: linear-gradient(165deg, #1a1d26 0%, #12141a 100%);
      box-shadow: 0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
    }

    .dp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.65rem;
    }
    .dp-month-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.02em;
    }
    .dp-nav {
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.45rem;
      color: #94a3b8;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .dp-nav:hover {
      color: #fff;
      background: rgba(99,102,241,0.15);
      border-color: rgba(99,102,241,0.3);
    }

    .dp-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .dp-grid--head { margin-bottom: 4px; }
    .dp-dow {
      text-align: center;
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      padding: 0.2rem 0;
    }

    .dp-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.45rem;
      font-size: 0.72rem;
      font-weight: 600;
      color: #e2e8f0;
      transition: all 0.12s ease;
    }
    .dp-day:hover:not(.dp-day--selected) {
      background: rgba(99,102,241,0.18);
      color: #fff;
    }
    .dp-day--muted { color: #475569; }
    .dp-day--today:not(.dp-day--selected) {
      box-shadow: inset 0 0 0 1px rgba(99,102,241,0.55);
      color: #a5b4fc;
    }
    .dp-day--selected {
      background: linear-gradient(135deg, #6366f1, #818cf8);
      color: #fff;
      box-shadow: 0 4px 14px rgba(99,102,241,0.45);
    }
    .dp-day--overdue:not(.dp-day--selected) {
      color: #fbbf24;
    }

    .dp-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 0.65rem;
      padding-top: 0.55rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .dp-footer-btn {
      font-size: 0.7rem;
      font-weight: 700;
      color: #818cf8;
      padding: 0.25rem 0.4rem;
      border-radius: 0.35rem;
      transition: all 0.15s;
    }
    .dp-footer-btn:hover { color: #fff; background: rgba(99,102,241,0.15); }
    .dp-footer-btn--muted { color: #64748b; }
    .dp-footer-btn--muted:hover { color: #94a3b8; background: rgba(255,255,255,0.05); }
  `],
})
export class DatePickerComponent {
  private el = inject(ElementRef<HTMLElement>);

  @Input() value: string | null | undefined = null;
  @Input() placeholder = 'Set date';
  @Input() showOverdue = false;
  @Output() valueChange = new EventEmitter<string | null>();

  open = signal(false);
  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth()); // 0-indexed

  readonly weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  monthLabel = computed(() => {
    const d = new Date(this.viewYear(), this.viewMonth(), 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  calendarCells = computed((): CalendarCell[] => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const first = new Date(y, m, 1);
    const startOffset = first.getDay();
    const cells: CalendarCell[] = [];

    const gridStart = new Date(y, m, 1 - startOffset);
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      cells.push({
        date,
        inMonth: date.getMonth() === m,
        iso: this.toIso(date),
      });
    }
    return cells;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.open()) return;
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  displayLabel(): string {
    if (!this.value) return this.placeholder;
    const d = new Date(this.value + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return this.placeholder;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  toggle(event: Event) {
    event.stopPropagation();
    const next = !this.open();
    this.open.set(next);
    if (next && this.value) {
      const d = new Date(this.value + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) {
        this.viewYear.set(d.getFullYear());
        this.viewMonth.set(d.getMonth());
      }
    }
  }

  prevMonth() {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
  }

  nextMonth() {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
  }

  selectDate(cell: CalendarCell) {
    this.valueChange.emit(cell.iso);
    this.open.set(false);
  }

  pickToday() {
    const today = new Date();
    const iso = this.toIso(today);
    this.valueChange.emit(iso);
    this.open.set(false);
  }

  clear(event: Event) {
    event.stopPropagation();
    this.valueChange.emit(null);
    this.open.set(false);
  }

  isToday(date: Date): boolean {
    const t = new Date();
    return (
      date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate()
    );
  }

  isSelected(iso: string): boolean {
    return !!this.value && this.value.slice(0, 10) === iso;
  }

  isOverdue(iso: string): boolean {
    if (!this.showOverdue) return false;
    const today = this.toIso(new Date());
    return iso < today;
  }

  private toIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
