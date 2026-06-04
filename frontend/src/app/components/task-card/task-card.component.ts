import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskStatus, TaskPriority } from '../../models/types';
import { TaskService } from '../../services/task.service';
import { TimerWidgetComponent } from '../timer-widget/timer-widget.component';

@Component({
  selector: 'app-task-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TimerWidgetComponent],
  template: `
    <div class="task-card" [class]="'priority-' + task.priority" [class.completed]="task.status === 'completed'">
      <!-- Header -->
      <div class="task-card-header">
        <div class="task-title-row">
          <span class="priority-badge" [class]="'priority-' + task.priority">
            {{ task.priority }}
          </span>
          <h4 class="task-title" [class.line-through]="task.status === 'completed'">
            {{ task.title }}
          </h4>
        </div>
        <button
          class="icon-btn danger"
          (click)="onDelete()"
          title="Delete task"
          [disabled]="deleting()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6m4-6v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      <!-- Deadline -->
      @if (task.deadline) {
        <div class="task-deadline" [class.overdue]="isOverdue()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {{ formatDate(task.deadline) }}
          @if (isOverdue()) { <span class="overdue-badge">Overdue</span> }
        </div>
      }

      <!-- Status Select -->
      <div class="task-status-row">
        <label class="status-label">Status:</label>
        <select
          class="status-select"
          [class]="'status-' + currentStatus()"
          [ngModel]="currentStatus()"
          (ngModelChange)="updateStatus($event)"
          [disabled]="updating()"
          [id]="'status-' + task._id"
        >
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <!-- Timer -->
      <div class="task-timer">
        <app-timer-widget
          [task]="task"
          (timerUpdated)="onTimerUpdated($event)"
        />
      </div>
    </div>
  `,
})
export class TaskCardComponent {
  @Input({ required: true }) task!: Task;
  @Output() taskUpdated = new EventEmitter<Task>();
  @Output() taskDeleted = new EventEmitter<string>();

  updating = signal(false);
  deleting = signal(false);
  currentStatus = signal<TaskStatus>('not_started');

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.currentStatus.set(this.task.status);
  }

  updateStatus(newStatus: TaskStatus): void {
    if (newStatus === this.task.status) return;
    this.updating.set(true);
    this.taskService.update(this.task._id, { status: newStatus }).subscribe({
      next: (res) => {
        this.updating.set(false);
        this.currentStatus.set(res.data.status);
        this.taskUpdated.emit(res.data);
      },
      error: () => {
        this.updating.set(false);
        this.currentStatus.set(this.task.status);
      },
    });
  }

  onDelete(): void {
    this.deleting.set(true);
    this.taskService.delete(this.task._id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.taskDeleted.emit(this.task._id);
      },
      error: () => this.deleting.set(false),
    });
  }

  onTimerUpdated(updatedTask: Task): void {
    this.task = updatedTask;
    this.taskUpdated.emit(updatedTask);
  }

  isOverdue(): boolean {
    if (!this.task.deadline) return false;
    return (
      new Date(this.task.deadline) < new Date() &&
      this.task.status !== 'completed'
    );
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
