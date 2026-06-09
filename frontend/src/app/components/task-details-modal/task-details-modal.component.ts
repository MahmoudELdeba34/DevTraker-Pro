import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task, TaskStatus, TaskPriority, Subtask, User } from '../../models/types';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';
import { WorkspaceService, WorkspaceMember } from '../../services/workspace.service';
import { TimerWidgetComponent } from '../timer-widget/timer-widget.component';
import { DatePickerComponent } from '../ui/date-picker/date-picker.component';
import { OnChanges, SimpleChanges } from '@angular/core';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-task-details-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TimerWidgetComponent, DatePickerComponent, TranslatePipe],
  template: `
    <div class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" (click)="close.emit()" [attr.data-locale]="locale.locale()">
      <div class="modal w-full max-w-4xl max-h-[90vh] flex flex-col animate-modal overflow-hidden" (click)="$event.stopPropagation()">
        
        <!-- Inner Container for padding -->
        <div class="p-8 flex flex-col gap-6 overflow-y-auto w-full">
          
          <!-- Top Bar: Breadcrumbs & Close -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-medium">
              <span class="text-text-secondary">{{ projectName || locale.t('taskDetails.projectFallback') }}</span>
              <span class="text-text-muted">/</span>
              <span class="text-accent">{{ task.title }}</span>
            </div>
            <button class="text-text-muted hover:text-white transition-colors" (click)="close.emit()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Title -->
          <div class="flex items-center gap-3">
            <button class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                 [ngClass]="task.status === 'completed' ? 'border-success bg-success/20 text-success' : 'border-accent/50 bg-accent/20'"
                 (click)="toggleComplete()" [title]="locale.t('taskDetails.toggleComplete')">
              @if (task.status === 'completed') {
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              } @else {
                <div class="w-2.5 h-2.5 rounded-full bg-accent"></div>
              }
            </button>
            <h2 class="text-3xl font-display font-bold text-white tracking-tight" [class.line-through]="task.status === 'completed'" [class.text-text-secondary]="task.status === 'completed'">{{ task.title }}</h2>
          </div>

          <!-- Metadata Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 mt-2">
            
            <!-- Row 1: Status & Assignees -->
            <div class="flex items-center gap-4 relative">
              <span class="text-xs text-text-muted w-24 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                {{ 'taskDetails.taskStatus' | translate }}
              </span>
              <button class="bg-accent/20 text-accent border border-accent/30 text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-2 hover:bg-accent/30 transition-colors"
                      (click)="closeAllDropdowns(); showStatusDropdown.set(!showStatusDropdown())" [disabled]="updating()">
                {{ statusLabel }}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="ml-1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
              
              @if (showStatusDropdown()) {
                <div class="absolute top-full left-28 mt-1 w-36 bg-bg-elevated border border-border rounded-lg shadow-xl overflow-hidden z-50">
                  <div class="flex flex-col text-xs font-medium">
                    <button class="px-3 py-2 text-left hover:bg-bg-hover text-white transition-colors" (click)="toggleTaskStatus('not_started')">{{ locale.statusLabel('not_started') }}</button>
                    <button class="px-3 py-2 text-left hover:bg-bg-hover text-white transition-colors" (click)="toggleTaskStatus('in_progress')">{{ locale.statusLabel('in_progress') }}</button>
                    <button class="px-3 py-2 text-left hover:bg-bg-hover text-white transition-colors" (click)="toggleTaskStatus('in_review')">{{ locale.statusLabel('in_review') }}</button>
                    <button class="px-3 py-2 text-left hover:bg-bg-hover text-success transition-colors" (click)="toggleTaskStatus('completed')">{{ locale.statusLabel('completed') }}</button>
                  </div>
                </div>
              }
            </div>
            
            <div class="flex items-center gap-4 relative">
              <span class="text-xs text-text-muted w-24 flex items-center gap-2 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {{ 'taskDetails.assignee' | translate }}
              </span>
              <button
                type="button"
                class="text-xs font-semibold flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-colors min-w-0 max-w-[220px]"
                [ngClass]="task.assignedTo ? 'bg-accent/10 text-white border-accent/30 hover:bg-accent/20' : 'bg-bg-base text-text-secondary border-border hover:border-accent/40 hover:text-white'"
                (click)="toggleAssigneeDropdown()"
              >
                @if (task.assignedTo) {
                  <span class="w-6 h-6 rounded-full bg-accent/25 flex items-center justify-center text-[9px] font-bold text-accent shrink-0">
                    {{ task.assignedTo.name.substring(0, 2).toUpperCase() }}
                  </span>
                  <span class="truncate">{{ task.assignedTo.name }}</span>
                } @else {
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>{{ 'taskDetails.assignMember' | translate }}</span>
                }
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" class="ml-auto shrink-0 opacity-60"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>

              @if (showAssigneeDropdown()) {
                <div class="absolute top-full left-24 mt-1 w-72 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden z-[60]">
                  <div class="p-2 border-b border-border">
                    <input
                      type="text"
                      [ngModel]="assigneeSearch()"
                      (ngModelChange)="assigneeSearch.set($event)"
                      [placeholder]="locale.t('common.searchMembers')"
                      class="w-full bg-bg-base border border-border text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-accent"
                      (click)="$event.stopPropagation()"
                    />
                  </div>
                  <div class="flex flex-col max-h-52 overflow-y-auto py-1">
                    <button
                      type="button"
                      class="flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover text-text-secondary transition-colors text-xs"
                      (click)="unassignTask()"
                    >
                      <span class="w-6 h-6 rounded-full border border-dashed border-text-muted flex items-center justify-center shrink-0">—</span>
                      {{ 'taskDetails.unassigned' | translate }}
                    </button>
                    @for (member of filteredMembers(); track member._id) {
                      <button
                        type="button"
                        class="flex items-center gap-2.5 px-3 py-2 text-left hover:bg-bg-hover transition-colors w-full"
                        [ngClass]="{ 'bg-accent/10': isAssignedToMember(member._id) }"
                        (click)="assignTask(member)"
                      >
                        <span class="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent shrink-0">
                          {{ member.name.substring(0, 2).toUpperCase() }}
                        </span>
                        <span class="flex-1 min-w-0">
                          <span class="block text-xs font-semibold text-white truncate">{{ member.name }}</span>
                          <span class="block text-[10px] text-text-muted truncate">{{ member.email }}</span>
                        </span>
                        @if (isAssignedToMember(member._id)) {
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-accent shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                        }
                      </button>
                    }
                    @if (loadingMembers()) {
                      <div class="p-3 text-xs text-text-muted italic">{{ 'common.loadingMembers' | translate }}</div>
                    } @else if (!filteredMembers().length) {
                      <div class="p-3 text-xs text-text-muted italic">{{ 'common.noMembersInWorkspace' | translate }}</div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Row 2: Start date & Due date -->
            <div class="flex items-center gap-4 relative">
              <span class="text-xs text-text-muted w-24 flex items-center gap-2 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                {{ 'taskDetails.startDate' | translate }}
              </span>
              <app-date-picker
                [value]="toDateIso(task.startDate)"
                [placeholder]="locale.t('common.setStart')"
                (valueChange)="updateStartDate($event)"
              />
            </div>

            <div class="flex items-center gap-4 relative">
              <span class="text-xs text-text-muted w-24 flex items-center gap-2 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {{ 'taskDetails.dueDate' | translate }}
              </span>
              <app-date-picker
                [value]="toDateIso(task.deadline)"
                [placeholder]="locale.t('common.setDueDate')"
                [showOverdue]="true"
                (valueChange)="updateDeadline($event)"
              />
            </div>

            <div class="flex items-center gap-4">
              <span class="text-xs text-text-muted w-24 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                {{ 'taskDetails.progress' | translate }}
              </span>
              <div class="flex items-center gap-3 flex-1 max-w-[200px]">
                <span class="text-xs font-bold text-white w-8">{{ progress }}%</span>
                <div class="flex-1 h-1.5 bg-bg-base rounded-full overflow-hidden">
                  <div class="h-full bg-accent rounded-full transition-all duration-300" [style.width.%]="progress"></div>
                </div>
              </div>
            </div>

            <!-- Row 3: Priority & Track Time -->
            <div class="flex items-center gap-4 relative">
              <span class="text-xs text-text-muted w-24 flex items-center gap-2 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                {{ 'taskDetails.priority' | translate }}
              </span>
              <button
                type="button"
                class="text-[11px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 border transition-colors"
                [ngClass]="priorityClasses()"
                (click)="togglePriorityDropdown()"
                [disabled]="updating()"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path></svg>
                {{ priorityLabel }}
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" class="opacity-60"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>

              @if (showPriorityDropdown()) {
                <div class="absolute top-full left-24 mt-1 w-44 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden z-[60]">
                  @for (p of priorityOptions; track p.value) {
                    <button
                      type="button"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold hover:bg-bg-hover transition-colors"
                      [ngClass]="{ 'bg-accent/10': task.priority === p.value }"
                      (click)="setPriority(p.value)"
                    >
                      <span class="w-2 h-2 rounded-full shrink-0" [ngClass]="p.dotClass"></span>
                      {{ locale.priorityLabel(p.value) }}
                      @if (task.priority === p.value) {
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="ml-auto text-accent"><polyline points="20 6 9 17 4 12"/></svg>
                      }
                    </button>
                  }
                </div>
              }
            </div>

            <div class="flex items-center gap-4">
              <span class="text-xs text-text-muted w-24 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                {{ 'taskDetails.trackTime' | translate }}
              </span>
              <app-timer-widget [task]="task" (timerUpdated)="task = $event" />
            </div>

          </div>

          <div class="h-px bg-border my-2 w-full"></div>

          <!-- Description -->
          <div>
            <textarea 
              [(ngModel)]="task.description" 
              (blur)="saveDescription($event)"
              class="w-full bg-transparent text-sm text-white placeholder-text-muted outline-none resize-none min-h-[60px]" 
              [placeholder]="locale.t('taskDetails.addDescription')"></textarea>
          </div>

          <div class="h-px bg-border my-2 w-full"></div>

          <!-- Checklists -->
          <div class="flex flex-col gap-4">
            <button class="flex items-center gap-2 text-sm font-bold text-white hover:text-accent transition-colors w-max" (click)="checklistsExpanded = !checklistsExpanded">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform duration-200" [class.-rotate-90]="!checklistsExpanded"><polyline points="6 9 12 15 18 9"></polyline></svg>
              {{ locale.t('taskDetails.checklists', { count: task.subtasks.length || 0 }) }}
            </button>
            
            @if (checklistsExpanded) {
              <div class="bg-bg-base/50 border border-border rounded-lg flex flex-col p-2 gap-1 overflow-hidden">
                @for (sub of task.subtasks; track sub._id) {
                  <div class="flex items-center justify-between p-2 rounded-md hover:bg-bg-hover/50 transition-colors group cursor-pointer relative">
                    <div class="flex items-center gap-3 flex-1 min-w-0" (click)="toggleSubtask(sub)">
                      <div class="w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0"
                           [ngClass]="sub.status === 'completed' ? 'border-accent' : 'border-text-muted group-hover:border-accent'">
                        @if (sub.status === 'completed') {
                          <div class="w-2 h-2 rounded-full bg-accent"></div>
                        }
                      </div>
                      <span class="text-sm truncate" [class.text-text-secondary]="sub.status === 'completed'" [class.line-through]="sub.status === 'completed'" [class.text-white]="sub.status !== 'completed'">{{ sub.title }}</span>
                    </div>

                    <!-- Subtask Assignee -->
                    <div class="flex -space-x-1 shrink-0 ml-2">
                      @if (sub.assignedTo) {
                        <button class="w-5 h-5 rounded-full bg-accent/20 border border-bg-elevated flex items-center justify-center text-[8px] font-bold text-accent z-20 hover:bg-accent hover:text-white transition-colors" 
                                [title]="getSubtaskAssigneeName(sub.assignedTo)"
                                (click)="showSubtaskAssigneeDropdown.set(showSubtaskAssigneeDropdown() === sub._id ? null : sub._id)">
                          {{ getSubtaskAssigneeInitials(sub.assignedTo) }}
                        </button>
                      } @else {
                        <button class="w-5 h-5 rounded-full bg-bg-base border border-dashed border-text-muted flex items-center justify-center text-text-muted hover:text-white hover:border-accent transition-colors opacity-0 group-hover:opacity-100" [title]="locale.t('common.assignUser')" (click)="showSubtaskAssigneeDropdown.set(showSubtaskAssigneeDropdown() === sub._id ? null : sub._id)">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      }
                    </div>

                    <!-- Subtask Assignee Dropdown -->
                    @if (showSubtaskAssigneeDropdown() === sub._id) {
                      <div class="absolute top-full right-0 mt-1 w-48 bg-bg-elevated border border-border rounded-lg shadow-xl overflow-hidden z-50">
                        <div class="flex flex-col max-h-48 overflow-y-auto">
                          @for (member of workspaceMembers(); track member._id) {
                            <button class="flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover text-white transition-colors" (click)="assignSubtask(sub, member); $event.stopPropagation()">
                              <div class="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[8px] font-bold text-accent">
                                {{ member.name.substring(0, 2).toUpperCase() }}
                              </div>
                              <span class="text-xs truncate">{{ member.name }}</span>
                            </button>
                          }
                          @if (!workspaceMembers().length) {
                            <div class="p-3 text-xs text-text-muted italic">{{ 'common.noResults' | translate }}</div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
                
                @if (!task.subtasks.length) {
                  <div class="text-xs text-text-muted p-2 italic">{{ 'taskDetails.noSubtasks' | translate }}</div>
                }

                <!-- Add Item -->
                <div class="flex items-center gap-2 mt-1 px-2 py-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted shrink-0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <input type="text" [(ngModel)]="newSubtaskTitle" (keydown.enter)="addSubtask()" [placeholder]="locale.t('taskDetails.addItem')" class="bg-transparent outline-none text-sm text-white placeholder-text-muted flex-1" />
                  @if (newSubtaskTitle().trim()) {
                    <button class="text-xs text-accent font-semibold hover:text-accent-hover transition-colors" (click)="addSubtask()" [disabled]="updating()">{{ 'common.add' | translate }}</button>
                  }
                </div>
              </div>
            }
          </div>

        </div>
      </div>
    </div>
  `
})
export class TaskDetailsModalComponent implements OnInit, OnChanges {
  @Input({ required: true }) task!: Task;
  @Input() projectName?: string;
  /** Workspace whose members can be assigned. Falls back to active workspace. */
  @Input() workspaceId?: string | null;
  @Output() close = new EventEmitter<void>();
  @Output() taskUpdated = new EventEmitter<Task>();

  checklistsExpanded = true;
  showStatusDropdown = signal(false);
  showPriorityDropdown = signal(false);
  newSubtaskTitle = signal('');
  updating = signal(false);

  showAssigneeDropdown = signal(false);
  showSubtaskAssigneeDropdown = signal<string | null>(null);
  workspaceMembers = signal<WorkspaceMember[]>([]);
  assigneeSearch = signal('');
  loadingMembers = signal(false);

  readonly priorityOptions: { value: TaskPriority; dotClass: string }[] = [
    { value: 'low', dotClass: 'bg-info' },
    { value: 'medium', dotClass: 'bg-warning' },
    { value: 'high', dotClass: 'bg-danger' },
  ];

  locale = inject(LocaleService);
  private taskService = inject(TaskService);
  private workspaceService = inject(WorkspaceService);

  filteredMembers = computed(() => {
    const q = this.assigneeSearch().trim().toLowerCase();
    const list = this.workspaceMembers();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    this.loadMembers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['workspaceId'] && !changes['workspaceId'].firstChange) {
      this.loadMembers();
    }
  }

  isAssignedToMember(userId: string): boolean {
    const assigned = this.task.assignedTo;
    if (!assigned) return false;
    const id = typeof assigned === 'object' ? (assigned as User)._id : assigned;
    return id?.toString() === userId;
  }

  loadMembers() {
    const wsId = this.workspaceId || this.workspaceService.activeWorkspace()?._id;
    if (!wsId) return;
    this.loadingMembers.set(true);
    this.workspaceService.getMembers(wsId).subscribe({
      next: (members) => {
        this.workspaceMembers.set(members);
        this.loadingMembers.set(false);
      },
      error: () => this.loadingMembers.set(false),
    });
  }

  closeAllDropdowns() {
    this.showStatusDropdown.set(false);
    this.showPriorityDropdown.set(false);
    this.showAssigneeDropdown.set(false);
    this.assigneeSearch.set('');
  }

  toggleAssigneeDropdown() {
    const next = !this.showAssigneeDropdown();
    this.closeAllDropdowns();
    this.showAssigneeDropdown.set(next);
    if (next && !this.workspaceMembers().length) this.loadMembers();
  }

  togglePriorityDropdown() {
    const next = !this.showPriorityDropdown();
    this.closeAllDropdowns();
    this.showPriorityDropdown.set(next);
  }

  get priorityLabel(): string {
    return this.locale.priorityLabel(this.task.priority);
  }

  priorityClasses(): string {
    switch (this.task.priority) {
      case 'high':
        return 'bg-danger/15 text-danger border-danger/30 hover:bg-danger/25';
      case 'low':
        return 'bg-info/15 text-info border-info/30 hover:bg-info/25';
      default:
        return 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/25';
    }
  }

  setPriority(priority: TaskPriority) {
    this.showPriorityDropdown.set(false);
    if (this.task.priority === priority) return;
    this.updating.set(true);
    this.taskService.update(this.task._id, { priority }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false),
    });
  }

  private patchTask(updated: Task) {
    this.task = updated;
    this.taskUpdated.emit(updated);
  }

  get statusLabel(): string {
    return this.locale.statusLabel(this.task.status);
  }

  get progress(): number {
    if (!this.task.subtasks || this.task.subtasks.length === 0) return 0;
    const completed = this.task.subtasks.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.task.subtasks.length) * 100);
  }

  toggleComplete() {
    this.toggleTaskStatus(this.task.status === 'completed' ? 'in_progress' : 'completed');
  }

  toggleTaskStatus(status: TaskStatus) {
    this.showStatusDropdown.set(false);
    if (this.task.status === status) return;
    
    this.updating.set(true);
    this.taskService.update(this.task._id, { status }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false)
    });
  }

  saveDescription(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    if (this.task.description === target.value) return;
    
    this.task.description = target.value;
    this.taskService.update(this.task._id, { description: target.value }).subscribe();
  }

  toggleSubtask(subtask: Subtask) {
    const newStatus = subtask.status === 'completed' ? 'not_started' : 'completed';
    this.updating.set(true);
    this.taskService.updateSubtask(this.task._id, subtask._id, { status: newStatus }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false)
    });
  }

  addSubtask() {
    const title = this.newSubtaskTitle().trim();
    if (!title) return;
    
    this.updating.set(true);
    this.taskService.addSubtask(this.task._id, { title }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.newSubtaskTitle.set('');
        this.updating.set(false);
      },
      error: () => this.updating.set(false)
    });
  }

  assignTask(user: WorkspaceMember) {
    this.showAssigneeDropdown.set(false);
    this.assigneeSearch.set('');
    this.updating.set(true);
    this.taskService.update(this.task._id, { assignedTo: user._id }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false)
    });
  }

  unassignTask() {
    this.showAssigneeDropdown.set(false);
    this.assigneeSearch.set('');
    this.updating.set(true);
    this.taskService.update(this.task._id, { assignedTo: null }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false),
    });
  }

  assignSubtask(subtask: Subtask, user: WorkspaceMember) {
    this.showSubtaskAssigneeDropdown.set(null);
    this.updating.set(true);
    this.taskService.updateSubtask(this.task._id, subtask._id, { assignedTo: user._id }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false)
    });
  }

  toDateIso(value: string | undefined | null): string | null {
    if (!value) return null;
    return value.slice(0, 10);
  }

  updateStartDate(dateStr: string | null) {
    this.updating.set(true);
    this.taskService.update(this.task._id, { startDate: dateStr }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false),
    });
  }

  updateDeadline(dateStr: string | null) {
    this.updating.set(true);
    this.taskService.update(this.task._id, { deadline: dateStr }).subscribe({
      next: (res) => {
        this.patchTask(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false),
    });
  }

  getSubtaskAssigneeName(assignee: any): string {
    if (typeof assignee === 'string') return assignee;
    return assignee?.name || '';
  }

  getSubtaskAssigneeInitials(assignee: any): string {
    const name = this.getSubtaskAssigneeName(assignee);
    return name ? name.substring(0, 2).toUpperCase() : '??';
  }
}

