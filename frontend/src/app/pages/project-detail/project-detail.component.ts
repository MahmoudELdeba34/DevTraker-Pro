import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { Task, Project, TaskPriority, TaskStatus } from '../../models/types';
import { TaskCardComponent } from '../../components/task-card/task-card.component';
import { FilterBarComponent } from '../../components/filter-bar/filter-bar.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TaskCardComponent,
    FilterBarComponent,
  ],
  template: `
    <div class="app-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
          <span>DevTracker Pro</span>
        </div>
        <nav class="sidebar-nav">
          <a class="nav-item" routerLink="/dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Dashboard
          </a>
        </nav>
        <div class="sidebar-footer">
          <div class="user-info">
            <div class="user-avatar">{{ userInitial() }}</div>
            <div>
              <p class="user-name">{{ userName() }}</p>
            </div>
          </div>
          <button class="btn-logout" (click)="logout()" title="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <a routerLink="/dashboard" class="breadcrumb-link">Projects</a>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span>{{ project()?.title ?? 'Loading...' }}</span>
        </div>

        <!-- Page Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">{{ project()?.title ?? '...' }}</h1>
            @if (project()?.description) {
              <p class="page-subtitle">{{ project()?.description }}</p>
            }
            @if (project()?.deadline) {
              <span class="meta-badge" style="margin-top:8px; display:inline-flex;">
                📅 Due {{ formatDate(project()!.deadline!) }}
              </span>
            }
          </div>
          <button class="btn-primary" (click)="showAddTask.set(true)" id="add-task-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Task
          </button>
        </div>

        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }

        <!-- Add Task Form -->
        @if (showAddTask()) {
          <div class="card form-card">
            <h2 class="form-title">New Task</h2>
            <form [formGroup]="taskForm" (ngSubmit)="createTask()" class="inline-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="task-title">Title *</label>
                  <input id="task-title" type="text" formControlName="title" placeholder="Task description" />
                </div>
                <div class="form-group">
                  <label for="task-priority">Priority</label>
                  <select id="task-priority" formControlName="priority">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="task-deadline">Deadline</label>
                  <input id="task-deadline" type="date" formControlName="deadline" />
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary" [disabled]="addingTask()">
                  {{ addingTask() ? 'Adding...' : 'Add Task' }}
                </button>
                <button type="button" class="btn-ghost" (click)="cancelAddTask()">Cancel</button>
              </div>
            </form>
          </div>
        }

        <!-- Filter Bar -->
        @if (allTasks().length > 0) {
          <app-filter-bar
            [tasks]="allTasks()"
            (filtered)="filteredTasks.set($event)"
          />
        }

        <!-- Tasks -->
        @if (loading()) {
          <div class="loading-grid">
            <div class="skeleton-card" *ngFor="let i of [1,2,3,4]"></div>
          </div>
        } @else if (allTasks().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <h3>No tasks yet</h3>
            <p>Add your first task to start tracking progress.</p>
            <button class="btn-primary" (click)="showAddTask.set(true)">Add Task</button>
          </div>
        } @else {
          <div class="tasks-grid">
            @for (task of filteredTasks(); track task._id) {
              <app-task-card
                [task]="task"
                (taskUpdated)="onTaskUpdated($event)"
                (taskDeleted)="onTaskDeleted($event)"
              />
            }
          </div>
          @if (filteredTasks().length === 0 && allTasks().length > 0) {
            <div class="empty-state small">
              <p>No tasks match the current filters.</p>
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class ProjectDetailComponent implements OnInit {
  project = signal<Project | null>(null);
  allTasks = signal<Task[]>([]);
  filteredTasks = signal<Task[]>([]);
  loading = signal(true);
  error = signal('');
  showAddTask = signal(false);
  addingTask = signal(false);

  taskForm!: FormGroup;
  private projectId!: string;

  constructor(
    private route: ActivatedRoute,
    private taskService: TaskService,
    private projectService: ProjectService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      priority: ['medium'],
      deadline: [''],
    });

    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadProject();
    this.loadTasks();
  }

  userName = () => this.authService.currentUser()?.name ?? '';
  userInitial = () => (this.authService.currentUser()?.name ?? 'U')[0].toUpperCase();

  loadProject(): void {
    this.projectService.getAll().subscribe({
      next: (res) => {
        const found = res.data.find((p) => p._id === this.projectId);
        this.project.set(found ?? null);
      },
      error: () => {},
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
        this.error.set('Failed to load tasks.');
        this.loading.set(false);
      },
    });
  }

  createTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }
    this.addingTask.set(true);
    const { title, priority, deadline } = this.taskForm.value as {
      title: string;
      priority: TaskPriority;
      deadline: string;
    };

    this.taskService
      .create(this.projectId, {
        title,
        priority,
        deadline: deadline || undefined,
      })
      .subscribe({
        next: (res) => {
          this.addingTask.set(false);
          this.taskForm.reset({ priority: 'medium' });
          this.showAddTask.set(false);
          this.allTasks.update((tasks) => [res.data, ...tasks]);
          this.filteredTasks.update((tasks) => [res.data, ...tasks]);
        },
        error: (err: { error?: { error?: string } }) => {
          this.addingTask.set(false);
          this.error.set(err.error?.error ?? 'Failed to create task.');
        },
      });
  }

  cancelAddTask(): void {
    this.showAddTask.set(false);
    this.taskForm.reset({ priority: 'medium' });
  }

  onTaskUpdated(updatedTask: Task): void {
    this.allTasks.update((tasks) =>
      tasks.map((t) => (t._id === updatedTask._id ? updatedTask : t))
    );
    this.filteredTasks.update((tasks) =>
      tasks.map((t) => (t._id === updatedTask._id ? updatedTask : t))
    );
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
