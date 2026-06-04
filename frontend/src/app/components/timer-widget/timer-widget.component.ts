import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/types';
import { TaskService } from '../../services/task.service';

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
  imports: [CommonModule],
  template: `
    <div class="timer-widget">
      <div class="timer-display">
        <span class="timer-icon" [class.running]="isRunning()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </span>
        <span class="timer-time" [class.running]="isRunning()">{{ displayTime() }}</span>
      </div>
      <div class="timer-controls">
        @if (!isRunning()) {
          <button
            class="timer-btn start"
            (click)="startTimer()"
            [disabled]="timerLoading()"
            title="Start timer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </button>
        } @else {
          <button
            class="timer-btn stop"
            (click)="stopTimer()"
            [disabled]="timerLoading()"
            title="Stop timer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>
        }
      </div>
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

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.loggedMs = this.task.timeLogs.reduce((acc, l) => acc + l.duration, 0);

    if (this.task.activeTimerStart) {
      this.isRunning.set(true);
      this.startTick();
    } else {
      this.displayTime.set(formatMs(this.loggedMs));
    }
  }

  ngOnDestroy(): void {
    this.clearInterval();
  }

  startTimer(): void {
    this.timerLoading.set(true);
    this.taskService.startTimer(this.task._id).subscribe({
      next: (res) => {
        this.timerLoading.set(false);
        this.task = res.data;
        this.isRunning.set(true);
        this.startTick();
        this.timerUpdated.emit(res.data);
      },
      error: () => this.timerLoading.set(false),
    });
  }

  stopTimer(): void {
    this.timerLoading.set(true);
    this.clearInterval();
    this.taskService.stopTimer(this.task._id).subscribe({
      next: (res) => {
        this.timerLoading.set(false);
        this.task = res.data;
        this.loggedMs = res.data.timeLogs.reduce((acc, l) => acc + l.duration, 0);
        this.isRunning.set(false);
        this.displayTime.set(formatMs(this.loggedMs));
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
    this.intervalId = setInterval(() => {
      const elapsed = this.task.activeTimerStart
        ? Date.now() - new Date(this.task.activeTimerStart).getTime()
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
