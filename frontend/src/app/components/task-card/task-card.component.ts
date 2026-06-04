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

      <!-- Assignee Badge -->
      <div class="task-assignee-row" style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem;">
        <span style="font-size: 0.7rem; color: #64748b; font-weight: 600;">Assignee:</span>
        <div *ngIf="task.assignedTo" style="display: flex; align-items: center; gap: 0.25rem; color: #cbd5e1; font-weight: 500;">
          <div style="width: 1.25rem; height: 1.25rem; border-radius: 50%; background: linear-gradient(to top right, #8b5cf6, #3b82f6); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: bold; border: 1px solid #475569;">
            {{ task.assignedTo.name.substring(0, 2).toUpperCase() }}
          </div>
          <span>{{ task.assignedTo.name }}</span>
        </div>
        <span *ngIf="!task.assignedTo" style="color: #475569; font-style: italic; font-size: 0.7rem;">Unassigned</span>
      </div>

      <!-- Subtasks Section -->
      <div class="mt-4 pt-3 border-t border-slate-800/60">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subtasks</span>
          <span class="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">{{ getCompletedSubtasksCount() }}/{{ task.subtasks.length }}</span>
        </div>
        
        <div class="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          @for (sub of task.subtasks; track sub._id) {
            <div class="flex items-start gap-2 group p-1.5 hover:bg-slate-800/50 rounded-md transition-colors border border-transparent hover:border-slate-700/50">
              <input type="checkbox" 
                     class="mt-0.5 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer w-3.5 h-3.5"
                     [checked]="sub.status === 'completed'"
                     (change)="toggleSubtaskStatus(sub)" 
                     [disabled]="updatingSubtask() === sub._id"/>
              <div class="flex-1 min-w-0 flex items-center justify-between">
                <span class="text-xs text-slate-300 truncate transition-all duration-200" 
                      [class.line-through]="sub.status === 'completed'"
                      [class.text-slate-500]="sub.status === 'completed'">
                  {{ sub.title }}
                </span>
                <button class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-0.5" 
                        (click)="deleteSubtask(sub._id)"
                        title="Delete subtask">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Add Subtask Input -->
        <div class="mt-2 flex gap-1.5">
          <input type="text" 
                 class="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-purple-500 placeholder:text-slate-600 transition-colors" 
                 placeholder="Add subtask..." 
                 [(ngModel)]="newSubtaskTitle"
                 (keyup.enter)="addSubtask()"
                 [disabled]="addingSubtask()" />
          <button class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1.5 rounded-md border border-slate-700 transition-colors flex items-center justify-center min-w-[28px]" 
                  (click)="addSubtask()"
                  [disabled]="!newSubtaskTitle.trim() || addingSubtask()">
            @if (addingSubtask()) {
              <div class="w-3 h-3 border-2 border-slate-400 border-t-purple-500 rounded-full animate-spin"></div>
            } @else {
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            }
          </button>
        </div>
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

  newSubtaskTitle = '';
  addingSubtask = signal(false);
  updatingSubtask = signal<string | null>(null);

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

  getCompletedSubtasksCount(): number {
    return this.task.subtasks?.filter(s => s.status === 'completed').length || 0;
  }

  addSubtask(): void {
    if (!this.newSubtaskTitle.trim() || this.addingSubtask()) return;
    this.addingSubtask.set(true);
    this.taskService.addSubtask(this.task._id, { title: this.newSubtaskTitle.trim() }).subscribe({
      next: (res) => {
        this.addingSubtask.set(false);
        this.newSubtaskTitle = '';
        this.task = res.data;
        this.taskUpdated.emit(res.data);
      },
      error: () => this.addingSubtask.set(false)
    });
  }

  toggleSubtaskStatus(subtask: any): void {
    if (this.updatingSubtask() === subtask._id) return;
    this.updatingSubtask.set(subtask._id);
    const newStatus: TaskStatus = subtask.status === 'completed' ? 'not_started' : 'completed';
    
    this.taskService.updateSubtask(this.task._id, subtask._id, { status: newStatus }).subscribe({
      next: (res) => {
        this.updatingSubtask.set(null);
        this.task = res.data;
        this.taskUpdated.emit(res.data);
      },
      error: () => this.updatingSubtask.set(null)
    });
  }

  deleteSubtask(subtaskId: string): void {
    if (this.updatingSubtask() === subtaskId) return;
    this.updatingSubtask.set(subtaskId);
    
    this.taskService.deleteSubtask(this.task._id, subtaskId).subscribe({
      next: () => {
        this.updatingSubtask.set(null);
        this.task.subtasks = this.task.subtasks.filter(s => s._id !== subtaskId);
        this.taskUpdated.emit(this.task); // Trigger update
      },
      error: () => this.updatingSubtask.set(null)
    });
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
