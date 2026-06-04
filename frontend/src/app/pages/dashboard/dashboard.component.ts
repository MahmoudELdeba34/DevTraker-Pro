import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { Project, Task } from '../../models/types';

interface ProjectWithStats extends Project {
  taskCount: number;
  completedCount: number;
  progressPercent: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
          <a class="nav-item active" routerLink="/dashboard">
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
              <p class="user-email">{{ userEmail() }}</p>
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
        <div class="page-header">
          <div>
            <h1 class="page-title">Projects</h1>
            <p class="page-subtitle">{{ projects().length }} project{{ projects().length !== 1 ? 's' : '' }} in your workspace</p>
          </div>
          <button class="btn-primary" (click)="showCreateForm.set(true)" id="new-project-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Project
          </button>
        </div>

        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }

        <!-- Create Project Form -->
        @if (showCreateForm()) {
          <div class="card form-card">
            <h2 class="form-title">New Project</h2>
            <form [formGroup]="projectForm" (ngSubmit)="createProject()" class="inline-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="proj-title">Title *</label>
                  <input id="proj-title" type="text" formControlName="title" placeholder="My awesome project" />
                </div>
                <div class="form-group">
                  <label for="proj-deadline">Deadline</label>
                  <input id="proj-deadline" type="date" formControlName="deadline" />
                </div>
              </div>
              <div class="form-group">
                <label for="proj-desc">Description</label>
                <textarea id="proj-desc" formControlName="description" rows="2" placeholder="What are you building?"></textarea>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary" [disabled]="creating()">
                  {{ creating() ? 'Creating...' : 'Create Project' }}
                </button>
                <button type="button" class="btn-ghost" (click)="cancelCreate()">Cancel</button>
              </div>
            </form>
          </div>
        }

        <!-- Loading -->
        @if (loading()) {
          <div class="loading-grid">
            <div class="skeleton-card" *ngFor="let i of [1,2,3]"></div>
          </div>
        }

        <!-- Project Grid -->
        @if (!loading()) {
          @if (projects().length === 0) {
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>
                </svg>
              </div>
              <h3>No projects yet</h3>
              <p>Create your first project to get started tracking your work.</p>
              <button class="btn-primary" (click)="showCreateForm.set(true)">Create Project</button>
            </div>
          } @else {
            <div class="projects-grid">
              @for (project of projects(); track project._id) {
                <div class="project-card" [routerLink]="['/projects', project._id]">
                  <div class="project-card-header">
                    <div class="project-color-dot"></div>
                    <div class="project-card-actions" (click)="$event.stopPropagation()">
                      <button
                        class="icon-btn danger"
                        (click)="deleteProject(project._id, project.title)"
                        title="Delete project"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                          <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <h3 class="project-title">{{ project.title }}</h3>
                  @if (project.description) {
                    <p class="project-desc">{{ project.description }}</p>
                  }

                  <div class="project-meta">
                    @if (project.deadline) {
                      <span class="meta-badge" [class.overdue]="isOverdue(project.deadline)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        {{ formatDate(project.deadline) }}
                      </span>
                    }
                    <span class="meta-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l3 3L22 4"/>
                      </svg>
                      {{ project.taskCount }} task{{ project.taskCount !== 1 ? 's' : '' }}
                    </span>
                  </div>

                  <!-- Progress Bar -->
                  <div class="progress-section">
                    <div class="progress-label">
                      <span>Progress</span>
                      <span>{{ project.progressPercent }}%</span>
                    </div>
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        [style.width.%]="project.progressPercent"
                      ></div>
                    </div>
                    <p class="progress-sub">
                      {{ project.completedCount }} of {{ project.taskCount }} completed
                    </p>
                  </div>
                </div>
              }
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  projects = signal<ProjectWithStats[]>([]);
  loading = signal(true);
  error = signal('');
  creating = signal(false);
  showCreateForm = signal(false);

  projectForm!: FormGroup;

  constructor(
    private projectService: ProjectService,
    private taskService: TaskService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.projectForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      deadline: [''],
    });
    this.loadProjects();
  }

  userName = () => this.authService.currentUser()?.name ?? '';
  userEmail = () => this.authService.currentUser()?.email ?? '';
  userInitial = () => (this.authService.currentUser()?.name ?? 'U')[0].toUpperCase();

  loadProjects(): void {
    this.loading.set(true);
    this.projectService.getAll().subscribe({
      next: async (res) => {
        const projects = res.data;
        const withStats = await Promise.all(
          projects.map((p) => this.enrichProject(p))
        );
        this.projects.set(withStats);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load projects.');
        this.loading.set(false);
      },
    });
  }

  private enrichProject(project: Project): Promise<ProjectWithStats> {
    return new Promise((resolve) => {
      this.taskService.getByProject(project._id).subscribe({
        next: (res) => {
          const tasks: Task[] = res.data;
          const completedCount = tasks.filter(
            (t) => t.status === 'completed'
          ).length;
          const progressPercent =
            tasks.length > 0
              ? Math.round((completedCount / tasks.length) * 100)
              : 0;
          resolve({
            ...project,
            taskCount: tasks.length,
            completedCount,
            progressPercent,
          });
        },
        error: () => {
          resolve({
            ...project,
            taskCount: 0,
            completedCount: 0,
            progressPercent: 0,
          });
        },
      });
    });
  }

  createProject(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    const { title, description, deadline } = this.projectForm.value as {
      title: string;
      description: string;
      deadline: string;
    };

    this.projectService
      .create({ title, description: description || undefined, deadline: deadline || undefined })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.projectForm.reset();
          this.showCreateForm.set(false);
          this.loadProjects();
        },
        error: (err: { error?: { error?: string } }) => {
          this.creating.set(false);
          this.error.set(err.error?.error ?? 'Failed to create project.');
        },
      });
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.projectForm.reset();
  }

  deleteProject(id: string, title: string): void {
    if (!window.confirm(`Delete project "${title}" and all its tasks? This cannot be undone.`)) {
      return;
    }
    this.projectService.delete(id).subscribe({
      next: () => this.loadProjects(),
      error: () => this.error.set('Failed to delete project.'),
    });
  }

  isOverdue(deadline: string): boolean {
    return new Date(deadline) < new Date();
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
