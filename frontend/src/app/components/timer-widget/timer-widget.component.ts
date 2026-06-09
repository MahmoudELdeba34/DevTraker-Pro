import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/types';
import { TaskService } from '../../services/task.service';
import { ActiveTimerService } from '../../services/active-timer.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

@Component({
  selector: 'app-timer-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="flex items-center gap-2 rounded-full pl-3 pr-1 py-1 transition-colors"
         [attr.data-locale]="locale.locale()"
         [ngClass]="{
           'bg-accent/10 border border-accent/20': !isRunning(),
           'bg-accent/20 border border-accent/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]': isRunning()
         }">
      <span class="text-xs font-bold font-mono tracking-wider"
            [ngClass]="isRunning() ? 'text-white' : 'text-accent'">
        {{ displayTime() }}
      </span>
      <button class="w-6 h-6 rounded-full text-white flex items-center justify-center transition-colors disabled:opacity-50"
              [ngClass]="isRunning() ? 'bg-danger hover:bg-danger/80' : 'bg-accent hover:bg-accent-hover'"
              (click)="toggleTimer($event)"
              [disabled]="timerLoading()"
              [title]="'timerWidget.title' | translate">
        @if (timerLoading()) {
          <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        } @else {
          @if (isRunning()) {
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          } @else {
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          }
        }
      </button>
    </div>
  `,
})
export class TimerWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) task!: Task;
  @Output() timerUpdated = new EventEmitter<Task>();

  isRunning = signal(false);
  timerLoading = signal(false);
  displayTime = signal('0:00:00');

  private intervalId?: ReturnType<typeof setInterval>;
  private loggedMs = 0;

  private taskService = inject(TaskService);
  private activeTimerService = inject(ActiveTimerService);
  private timeEntryService = inject(TimeEntryService);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  constructor() {
    effect(() => {
      const active = this.activeTimerService.activeTask();
      const activeId = active?._id;
      if (this.isRunning() && activeId !== this.task?._id) {
        this.clearInterval();
        this.isRunning.set(false);
        this.displayTime.set(formatMs(this.loggedMs));
      }
    });
  }

  ngOnInit(): void {
    this.loggedMs = (this.task.timeLogs || []).reduce((acc, l) => acc + l.duration, 0);

    const active = this.activeTimerService.activeTask();
    if (active?._id === this.task._id && active.activeTimerStart) {
      this.task = active;
      this.isRunning.set(true);
      this.startTick();
    } else if (this.task.activeTimerStart) {
      this.isRunning.set(true);
      this.activeTimerService.setActiveTask(this.task);
      this.startTick();
    } else {
      this.displayTime.set(formatMs(this.loggedMs));
    }
  }

  ngOnDestroy(): void {
    this.clearInterval();
  }

  toggleTimer(event: Event): void {
    event.stopPropagation();
    if (this.isRunning()) {
      this.stopTimer();
    } else {
      this.startTimer();
    }
  }

  private startTimer(): void {
    this.timerLoading.set(true);
    this.taskService.startTimer(this.task._id).subscribe({
      next: (res) => {
        this.timerLoading.set(false);
        this.task = res.data;
        this.isRunning.set(true);
        this.activeTimerService.setActiveTask(res.data);
        this.timeEntryService.active.set(null);
        this.toast.success(this.locale.t('timerWidget.started'));
        this.startTick();
        this.timerUpdated.emit(res.data);
      },
      error: () => this.timerLoading.set(false),
    });
  }

  private stopTimer(): void {
    this.timerLoading.set(true);
    this.clearInterval();
    this.taskService.stopTimer(this.task._id).subscribe({
      next: (res) => {
        this.timerLoading.set(false);
        this.task = res.data;
        this.loggedMs = res.data.timeLogs.reduce((acc: any, l: any) => acc + l.duration, 0);
        this.isRunning.set(false);
        if (this.activeTimerService.activeTask()?._id === this.task._id) {
          this.activeTimerService.setActiveTask(null);
        }
        this.displayTime.set(formatMs(this.loggedMs));
        this.toast.info(this.locale.t('timerWidget.stopped'));
        this.timerUpdated.emit(res.data);
      },
      error: () => {
        this.timerLoading.set(false);
        this.isRunning.set(false);
      },
    });
  }

  private startTick(): void {
    this.clearInterval();
    const timerStart =
      this.activeTimerService.activeTask()?._id === this.task._id
        ? this.activeTimerService.activeTask()?.activeTimerStart
        : this.task.activeTimerStart;
    this.intervalId = setInterval(() => {
      const elapsed = timerStart
        ? Date.now() - new Date(timerStart).getTime()
        : 0;
      this.displayTime.set(formatMs(this.loggedMs + elapsed));
    }, 1000);
  }

  private clearInterval(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}
