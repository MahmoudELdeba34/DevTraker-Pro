import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import { ToastService } from '../../services/toast.service';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { WorkspaceService, WorkspaceMember } from '../../services/workspace.service';
import { Task, Project, TaskPriority, TaskStatus } from '../../models/types';
import { TaskCardComponent } from '../../components/task-card/task-card.component';
import { TaskDetailsModalComponent } from '../../components/task-details-modal/task-details-modal.component';
import { TaskFormModalComponent } from '../../components/tasks/task-form-modal/task-form-modal.component';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TaskCardComponent,
    TaskDetailsModalComponent,
    TaskFormModalComponent,
    TranslatePipe,
],
  template: `
      <main class="h-full flex flex-col relative z-0" [attr.data-locale]="locale.locale()">
        <!-- Header -->
        <div class="px-8 py-6 border-b border-border bg-bg-base/50 backdrop-blur-md flex-shrink-0 z-10 sticky top-0">
          <div class="flex items-center text-xs text-text-muted mb-2 font-medium tracking-wide uppercase">
            <a routerLink="/dashboard" class="hover:text-white transition-colors">{{ 'projectDetail.breadcrumb' | translate }}</a>
            <svg class="mx-2 w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>
            <span class="text-accent truncate">{{ project()?.title ?? ('projectDetail.loading' | translate) }}</span>
          </div>
      
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 class="text-2xl font-display font-bold text-white tracking-tight">{{ project()?.title ?? '...' }}</h1>
              @if (project()?.description) {
                <p class="text-sm text-text-secondary mt-1 max-w-2xl">{{ project()?.description }}</p>
              }
            </div>
      
            <div class="flex items-center gap-3">
              <!-- Filter & View Icons -->
              <button class="w-9 h-9 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-secondary hover:text-white hover:bg-bg-hover transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              </button>
              <div class="flex -space-x-2">
                <div class="w-8 h-8 rounded-full border-2 border-bg-base bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent relative z-10">AR</div>
                <div class="w-8 h-8 rounded-full border-2 border-bg-base bg-info/20 flex items-center justify-center text-[10px] font-bold text-info relative z-0">JS</div>
              </div>
            </div>
          </div>
        </div>
      
        <!-- Add Task Modal -->
        <app-task-form-modal
          [open]="showAddTask()"
          [form]="taskForm"
          [saving]="addingTask()"
          [members]="workspaceMembers()"
          (submitForm)="createTask()"
          (cancelled)="cancelAddTask()"
        />
      
        <!-- Kanban Board -->
        <div class="flex-1 overflow-x-auto overflow-y-hidden p-8 flex gap-6 hide-scrollbar relative">
      
          <!-- Column: To Do -->
          <div class="flex flex-col min-w-[300px] max-w-[300px] bg-bg-base rounded-xl border border-border h-full max-h-full overflow-hidden">
            <div class="px-4 py-3 bg-[#39394B] flex items-center justify-between">
              <h3 class="font-bold text-white text-sm">{{ 'projectDetail.column.todo' | translate }}</h3>
              <button class="text-white/70 hover:text-white transition-colors" (click)="showAddTask.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar">
              @for (task of tasksByStatus('not_started'); track task._id) {
                <app-task-card [task]="task" [workspaceMembers]="workspaceMembers()" [canAssign]="!!project()?.workspaceId" (taskUpdated)="onTaskUpdated($event)" (taskDeleted)="onTaskDeleted($event)" (taskClicked)="selectedTask.set($event)"/>
              }
            </div>
            <div class="p-3 border-t border-border mt-auto">
              <button class="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors w-full" (click)="showAddTask.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                {{ 'projectDetail.addTask' | translate }}
              </button>
            </div>
          </div>
      
          <!-- Column: In Progress -->
          <div class="flex flex-col min-w-[300px] max-w-[300px] bg-bg-base rounded-xl border border-border h-full max-h-full overflow-hidden">
            <div class="px-4 py-3 bg-[#4C4488] flex items-center justify-between">
              <h3 class="font-bold text-white text-sm">{{ 'projectDetail.column.inProgress' | translate }}</h3>
              <button class="text-white/70 hover:text-white transition-colors" (click)="showAddTask.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar">
              @for (task of tasksByStatus('in_progress'); track task._id) {
                <app-task-card [task]="task" [workspaceMembers]="workspaceMembers()" [canAssign]="!!project()?.workspaceId" (taskUpdated)="onTaskUpdated($event)" (taskDeleted)="onTaskDeleted($event)" (taskClicked)="selectedTask.set($event)"/>
              }
            </div>
            <div class="p-3 border-t border-border mt-auto">
              <button class="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors w-full" (click)="showAddTask.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                {{ 'projectDetail.addTask' | translate }}
              </button>
            </div>
          </div>
      
          <!-- Column: In Review -->
          <div class="flex flex-col min-w-[300px] max-w-[300px] bg-bg-base rounded-xl border border-border h-full max-h-full overflow-hidden">
            <div class="px-4 py-3 bg-warning flex items-center justify-between">
              <h3 class="font-bold text-white text-sm">{{ 'projectDetail.column.inReview' | translate }}</h3>
              <button class="text-white/70 hover:text-white transition-colors" (click)="showAddTask.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar">
              @for (task of tasksByStatus('in_review'); track task._id) {
                <app-task-card [task]="task" [workspaceMembers]="workspaceMembers()" [canAssign]="!!project()?.workspaceId" (taskUpdated)="onTaskUpdated($event)" (taskDeleted)="onTaskDeleted($event)" (taskClicked)="selectedTask.set($event)"/>
              }
            </div>
            <div class="p-3 border-t border-border mt-auto">
              <button class="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors w-full" (click)="showAddTask.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                {{ 'projectDetail.addTask' | translate }}
              </button>
            </div>
          </div>
      
          <!-- Column: Completed -->
          <div class="flex flex-col min-w-[300px] max-w-[300px] bg-bg-base rounded-xl border border-border h-full max-h-full overflow-hidden">
            <div class="px-4 py-3 bg-success flex items-center justify-between">
              <h3 class="font-bold text-white text-sm">{{ 'projectDetail.column.completed' | translate }}</h3>
              <button class="text-white/70 hover:text-white transition-colors" (click)="showAddTask.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar">
              @for (task of tasksByStatus('completed'); track task._id) {
                <app-task-card [task]="task" [workspaceMembers]="workspaceMembers()" [canAssign]="!!project()?.workspaceId" (taskUpdated)="onTaskUpdated($event)" (taskDeleted)="onTaskDeleted($event)" (taskClicked)="selectedTask.set($event)"/>
              }
            </div>
            <div class="p-3 border-t border-border mt-auto">
              <button class="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors w-full" (click)="showAddTask.set(true)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                {{ 'projectDetail.addTask' | translate }}
              </button>
            </div>
          </div>
      
        </div>
      
        @if (selectedTask()) {
          <app-task-details-modal
            [task]="selectedTask()!"
            [projectName]="project()?.title"
            [workspaceId]="project()?.workspaceId"
            (taskUpdated)="onTaskUpdated($event)"
            (close)="selectedTask.set(null)"
          />
        }
      </main>
      `,
})
export class ProjectDetailComponent implements OnInit {
  project = signal<Project | null>(null);
  allTasks = signal<Task[]>([]);
  filteredTasks = signal<Task[]>([]);
  loading = signal(true);
  showAddTask = signal(false);
  addingTask = signal(false);
  workspaceMembers = signal<WorkspaceMember[]>([]);
  selectedTask = signal<Task | null>(null);

  taskForm!: FormGroup;
  private projectId!: string;

  private route = inject(ActivatedRoute);
  private taskService = inject(TaskService);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  ngOnInit(): void {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      priority: ['medium'],
      deadline: [''],
      assignedTo: [''],
    });

    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadProject();
    this.loadTasks();
  }

  userName = () => this.authService.currentUser()?.name ?? '';
  userEmail = () => this.authService.currentUser()?.email ?? '';
  userRole = () => this.authService.currentUser()?.role ?? 'employee';
  userInitial = () => (this.authService.currentUser()?.name ?? 'U')[0].toUpperCase();
  isAdmin = () => this.authService.currentUser()?.role === 'admin';
  isHRManagerAdmin = () => ['admin', 'hr', 'manager'].includes(this.authService.currentUser()?.role || '');
  isAccountantHRAdmin = () => ['admin', 'hr', 'accountant'].includes(this.authService.currentUser()?.role || '');

  loadProject(): void {
    this.projectService.getAll().subscribe({
      next: (res) => {
        const found = res.data.find((p) => p._id === this.projectId);
        this.project.set(found ?? null);
        
        // Auto-switch workspace if we navigated to a project from another workspace
        if (found && found.workspaceId) {
          const currentWsId = this.workspaceService.activeWorkspace()?._id;
          if (currentWsId !== found.workspaceId) {
            this.workspaceService.setActiveWorkspace(found.workspaceId);
          }
          this.loadWorkspaceMembers(found.workspaceId);
        }
      },
      error: () => {},
    });
  }

  loadWorkspaceMembers(workspaceId: string): void {
    this.workspaceService.getMembers(workspaceId).subscribe({
      next: (members) => this.workspaceMembers.set(members),
      error: () => this.workspaceMembers.set([]),
    });
  }

  loadTasks(): void {
    this.loading.set(true);
    this.taskService.getByProject(this.projectId).subscribe({
      next: (res) => {
        this.allTasks.set(res.data);
        this.filteredTasks.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  tasksByStatus(status: TaskStatus): Task[] {
    return this.filteredTasks().filter(t => t.status === status);
  }

  createTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }
    this.addingTask.set(true);
    const { title, priority, deadline, assignedTo } = this.taskForm.value as {
      title: string;
      priority: TaskPriority;
      deadline: string;
      assignedTo: string;
    };

    this.taskService
      .create(this.projectId, {
        title,
        priority,
        deadline: deadline || undefined,
        assignedTo: assignedTo || null,
      })
      .subscribe({
        next: (res) => {
          this.addingTask.set(false);
          this.taskForm.reset({ priority: 'medium', assignedTo: '' });
          this.showAddTask.set(false);
          this.allTasks.update((tasks) => [res.data, ...tasks]);
          this.filteredTasks.update((tasks) => [res.data, ...tasks]);
          this.toast.success(this.locale.t('projectDetail.toast.taskCreated'));
        },
        error: () => {
          this.addingTask.set(false);
        },
      });
  }

  cancelAddTask(): void {
    this.showAddTask.set(false);
    this.taskForm.reset({ priority: 'medium', assignedTo: '' });
  }

  onTaskUpdated(updatedTask: Task): void {
    this.allTasks.update((tasks) =>
      tasks.map((t) => (t._id === updatedTask._id ? updatedTask : t))
    );
    this.filteredTasks.update((tasks) =>
      tasks.map((t) => (t._id === updatedTask._id ? updatedTask : t))
    );
    if (this.selectedTask()?._id === updatedTask._id) {
      this.selectedTask.set(updatedTask);
    }
  }

  onTaskDeleted(taskId: string): void {
    this.allTasks.update((tasks) => tasks.filter((t) => t._id !== taskId));
    this.filteredTasks.update((tasks) => tasks.filter((t) => t._id !== taskId));
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
