import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActiveTimerService } from '../../../services/active-timer.service';
import { TimeEntryService } from '../../../services/time-entry.service';
import { ToastService } from '../../../services/toast.service';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-tracking-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="tracking-banner tracking-banner--compact flex flex-col md:flex-row md:items-center md:justify-between gap-3"
         [class.opacity-75]="!anyTimerRunning()">
      <div class="flex items-center gap-2 text-[10px] font-bold text-text-muted tracking-widest uppercase shrink-0">
        @if (anyTimerRunning()) {
          <span class="w-2 h-2 rounded-full bg-danger animate-pulse"></span>
          {{ 'common.currentlyTracking' | translate }}
        } @else {
          <span class="w-2 h-2 rounded-full bg-text-muted/40"></span>
          {{ 'common.notTrackingBanner' | translate }}
        }
      </div>

      <div class="flex flex-wrap items-center gap-3 md:gap-4 md:justify-end flex-1 min-w-0">
        @if (anyTimerRunning()) {
          @if (trackingKind() === 'task') {
            <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-accent-subtle text-accent border border-accent/30 shrink-0">
              {{ 'shell.chip.task' | translate }}
            </span>
          } @else if (trackingKind() === 'quick') {
            <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-info/15 text-info border border-info/30 shrink-0">
              {{ 'shell.quickSession' | translate }}
            </span>
          }
          <span class="text-sm font-bold text-white truncate min-w-0 max-w-[140px] sm:max-w-[220px] md:max-w-sm">{{ runningLabel() }}</span>
          <span class="text-xl sm:text-2xl md:text-3xl font-mono font-extrabold tabular-nums text-accent shrink-0">{{ displayTime() }}</span>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-danger text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider hover:bg-danger/90 transition-colors shrink-0 disabled:opacity-50"
            [disabled]="stopping()"
            (click)="stopAny()">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            {{ 'shell.stop' | translate }}
          </button>
        } @else {
          <p class="text-xs text-text-secondary">{{ 'common.startTimerHint' | translate }}</p>
          <a routerLink="/dashboard" class="btn-soft text-xs shrink-0">{{ 'shell.startTimer' | translate }}</a>
        }
      </div>
    </div>
  `,
})
export class TrackingBannerComponent implements OnInit, OnDestroy {
  readonly activeTimer = inject(ActiveTimerService);
  private timeEntryService = inject(TimeEntryService);
  private toast = inject(ToastService);
  readonly locale = inject(LocaleService);

  displayTime = signal('00:00:00');
  stopping = signal(false);
  private timerInterval?: ReturnType<typeof setInterval>;
  private tickSessionKey: string | null = null;

  runningLabel = computed(() => {
    this.locale.locale();
    const task = this.activeTimer.activeTask();
    if (task) return task.title;
    const entry = this.timeEntryService.active();
    if (entry) return entry.description?.trim() || this.locale.t('shell.quickSession');
    return this.locale.t('dashboard.noActiveTask');
  });

  anyTimerRunning = computed(
    () => !!this.activeTimer.activeTask() || !!this.timeEntryService.active()
  );

  trackingKind = computed<'task' | 'quick' | null>(() => {
    if (this.activeTimer.activeTask()) return 'task';
    if (this.timeEntryService.active()) return 'quick';
    return null;
  });

  constructor() {
    effect(
      () => {
        const task = this.activeTimer.activeTask();
        const entry = this.timeEntryService.active();
        const sessionKey = task
          ? `task:${task._id}:${task.activeTimerStart ?? ''}`
          : entry
            ? `entry:${entry._id}:${entry.startedAt}`
            : null;

        if (!sessionKey) {
          this.stopTick();
          return;
        }

        if (this.tickSessionKey !== sessionKey) {
          this.tickSessionKey = sessionKey;
          this.startTickLoop();
        }
      },
      { allowSignalWrites: true }
    );
  }

  ngOnInit(): void {
    this.activeTimer.loadActive().subscribe();
    this.timeEntryService.loadActive().subscribe();
  }

  ngOnDestroy(): void {
    this.stopTick();
  }

  stopAny(): void {
    if (this.stopping()) return;
    const task = this.activeTimer.activeTask();
    if (task) {
      this.stopping.set(true);
      this.activeTimer.stopTimer();
      this.toast.info(this.locale.t('shell.toast.timerStopped'));
      this.stopping.set(false);
      return;
    }
    const entry = this.timeEntryService.active();
    if (entry) {
      this.stopping.set(true);
      this.timeEntryService.stop().subscribe({
        next: () => {
          this.activeTimer.setActiveTask(null);
          this.toast.info(this.locale.t('shell.toast.sessionStopped'));
          this.stopping.set(false);
        },
        error: () => this.stopping.set(false),
      });
    }
  }

  private startTickLoop(): void {
    this.stopTick(false);
    const tick = () => this.refreshDisplayTime();
    tick();
    this.timerInterval = setInterval(tick, 1000);
  }

  private refreshDisplayTime(): void {
    const task = this.activeTimer.activeTask();
    if (task) {
      const loggedMs =
        task.timeLogs?.reduce((acc, log) => acc + (log.duration || 0), 0) || 0;
      const entry = this.timeEntryService.active();
      const startRaw =
        task.activeTimerStart ||
        (entry?.taskId === task._id ? entry.startedAt : null);
      const elapsed = startRaw ? Date.now() - new Date(startRaw).getTime() : 0;
      this.updateDisplayTime(loggedMs + Math.max(0, elapsed));
      return;
    }

    const entry = this.timeEntryService.active();
    if (entry?.startedAt) {
      const elapsed = Date.now() - new Date(entry.startedAt).getTime();
      this.updateDisplayTime(Math.max(0, elapsed));
      return;
    }

    this.updateDisplayTime(0);
  }

  private updateDisplayTime(totalMs: number): void {
    const totalSec = Math.max(0, Math.floor(totalMs / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    this.displayTime.set(
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    );
  }

  private stopTick(resetDisplay = true): void {
    if (this.timerInterval !== undefined) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.tickSessionKey = null;
    if (resetDisplay) {
      this.displayTime.set('00:00:00');
    }
  }
}
