import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskStatus } from '../../models/types';
import { TaskService } from '../../services/task.service';
import { TimerWidgetComponent } from '../timer-widget/timer-widget.component';
import { WorkspaceMember } from '../../services/workspace.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-task-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TimerWidgetComponent, TranslatePipe],
  template: `
    <div class="bg-[#2B2B36] rounded-xl p-5 hover:border-accent/50 transition-colors border border-transparent hover:shadow-glow group cursor-grab active:cursor-grabbing flex flex-col gap-4 relative overflow-hidden" [class.opacity-60]="task.status === 'completed'" [attr.data-locale]="locale.locale()" (click)="taskClicked.emit(task)">
      
      <div class="flex justify-between items-start gap-4">
        <h4 class="text-sm font-bold text-white leading-snug" [class.line-through]="task.status === 'completed'">
          {{ task.title }}
        </h4>
        
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-white hover:bg-bg-hover transition-colors relative" [title]="'taskCard.changeStatus' | translate" (click)="$event.stopPropagation()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              <select
                class="absolute inset-0 opacity-0 cursor-pointer"
                [ngModel]="currentStatus()"
                (ngModelChange)="updateStatus($event)"
                [disabled]="updating()"
                (click)="$event.stopPropagation()"
              >
                <option value="not_started">{{ 'taskCard.status.todo' | translate }}</option>
                <option value="in_progress">{{ 'taskCard.status.inProgress' | translate }}</option>
                <option value="in_review">{{ 'taskCard.status.inReview' | translate }}</option>
                <option value="completed">{{ 'taskCard.status.completed' | translate }}</option>
              </select>
            </button>
            <button
              class="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              (click)="onDelete(); $event.stopPropagation()"
              [title]="'taskCard.deleteTask' | translate"
              [disabled]="deleting()"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>

          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="flex-shrink-0"
               [ngClass]="{
                 'text-danger': task.priority === 'high',
                 'text-warning': task.priority === 'medium',
                 'text-success': task.priority === 'low'
               }">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v19h2v-7z"></path>
          </svg>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-[10px] font-bold text-text-muted">
          <span>{{ 'taskDetails.progress' | translate }}</span>
          <span class="text-white">{{ getProgressPercent() }}%</span>
        </div>
        <div class="h-1.5 w-full bg-bg-base rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-300" 
               [style.width.%]="getProgressPercent()"
               [ngClass]="{
                 'bg-[#4C4488]': task.status !== 'completed',
                 'bg-success': task.status === 'completed'
               }"></div>
        </div>
      </div>

      <div class="flex items-center justify-between mt-1">
        <div class="relative" (click)="$event.stopPropagation()">
          @if (canAssign && workspaceMembers.length) {
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-full transition-colors"
              (click)="toggleAssignMenu()"
              [title]="task.assignedTo ? task.assignedTo.name : ('taskDetails.assignMember' | translate)"
            >
              @if (task.assignedTo) {
                <span class="w-6 h-6 rounded-full border-2 border-[#2B2B36] bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent">
                  {{ task.assignedTo.name.substring(0, 2).toUpperCase() }}
                </span>
              } @else {
                <span class="w-6 h-6 rounded-full border-2 border-dashed border-text-muted/60 bg-bg-base flex items-center justify-center text-text-muted group-hover:border-accent/50 group-hover:text-accent transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
              }
              @if (task.assignedTo) {
                <span class="text-[10px] font-semibold text-text-secondary max-w-[72px] truncate hidden sm:inline">{{ task.assignedTo.name.split(' ')[0] }}</span>
              }
            </button>

            @if (showAssignMenu()) {
              <div class="absolute left-0 bottom-full mb-1 w-56 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden z-50">
                <div class="px-2 py-1.5 border-b border-border text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ 'common.assignUser' | translate }}</div>
                <div class="flex flex-col max-h-44 overflow-y-auto py-1">
                  <button
                    type="button"
                    class="flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover text-text-secondary text-xs"
                    (click)="assignMember(null)"
                  >
                    {{ 'common.unassigned' | translate }}
                  </button>
                  @for (member of workspaceMembers; track member._id) {
                    <button
                      type="button"
                      class="flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors w-full"
                      [ngClass]="{ 'bg-accent-subtle': isAssignedTo(member._id) }"
                      (click)="assignMember(member._id)"
                    >
                      <span class="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[8px] font-bold text-accent shrink-0">
                        {{ member.name.substring(0, 2).toUpperCase() }}
                      </span>
                      <span class="text-xs text-white truncate flex-1">{{ member.name }}</span>
                    </button>
                  }
                </div>
              </div>
            }
          } @else if (task.assignedTo) {
            <div class="w-6 h-6 rounded-full border-2 border-[#2B2B36] bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent" [title]="task.assignedTo.name">
              {{ task.assignedTo.name.substring(0, 2).toUpperCase() }}
            </div>
          }
        </div>

        <div class="flex items-center gap-2">
          <div (click)="$event.stopPropagation()">
            <app-timer-widget
              [task]="task"
              (timerUpdated)="onTimerUpdated($event)"
              class="scale-[0.85] origin-right block"
            />
          </div>
          <div class="flex items-center gap-1.5 text-[10px] font-medium text-text-muted bg-bg-base px-2 py-1 rounded-md">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>{{ getFormattedDateRange() }}</span>
          </div>
        </div>
      </div>
      
    </div>
  `,
})
export class TaskCardComponent {
  locale = inject(LocaleService);

  @Input({ required: true }) task!: Task;
  @Input() workspaceMembers: WorkspaceMember[] = [];
  @Input() canAssign = true;
  @Output() taskUpdated = new EventEmitter<Task>();
  @Output() taskDeleted = new EventEmitter<string>();
  @Output() taskClicked = new EventEmitter<Task>();

  updating = signal(false);
  deleting = signal(false);
  currentStatus = signal<TaskStatus>('not_started');
  showAssignMenu = signal(false);

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.currentStatus.set(this.task.status);
  }

  toggleAssignMenu(): void {
    this.showAssignMenu.update((v) => !v);
  }

  isAssignedTo(userId: string): boolean {
    const assigned = this.task.assignedTo;
    if (!assigned) return false;
    const id = typeof assigned === 'object' ? assigned._id : assigned;
    return id?.toString() === userId;
  }

  assignMember(userId: string | null): void {
    this.showAssignMenu.set(false);
    if (this.isAssignedTo(userId || '') && userId) return;
    if (!userId && !this.task.assignedTo) return;

    this.updating.set(true);
    this.taskService.update(this.task._id, { assignedTo: userId }).subscribe({
      next: (res) => {
        this.task = res.data;
        this.updating.set(false);
        this.taskUpdated.emit(res.data);
      },
      error: () => this.updating.set(false),
    });
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

  getProgressPercent(): number {
    if (this.task.status === 'completed') return 100;
    if (!this.task.subtasks || this.task.subtasks.length === 0) {
      if (this.task.status === 'not_started') return 0;
      if (this.task.status === 'in_progress') return 40;
      if (this.task.status === 'in_review') return 80;
      return 0;
    }
    const completed = this.task.subtasks.filter((st) => st.status === 'completed').length;
    return Math.round((completed / this.task.subtasks.length) * 100);
  }

  getFormattedDateRange(): string {
    if (this.task.deadline) {
      return new Date(this.task.deadline).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }
    return this.locale.t('common.setDueDate');
  }
}
