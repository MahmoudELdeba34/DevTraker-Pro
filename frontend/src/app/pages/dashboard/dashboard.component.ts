import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WorkspaceMembersModalComponent } from '../../components/ui/workspace-members-modal/workspace-members-modal.component';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { WorkspaceService } from '../../services/workspace.service';
import { NotificationService } from '../../services/notification.service';
import { Project, Task, User, Workspace } from '../../models/types';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

interface ProjectWithStats extends Project {
  taskCount: number;
  completedCount: number;
  progressPercent: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, WorkspaceMembersModalComponent, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
// Main Dashboard Component
export class DashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private workspaceService = inject(WorkspaceService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  projects = signal<ProjectWithStats[]>([]);
  workspaces = signal<Workspace[]>([]);
  activeWorkspace = signal<Workspace | null>(null);
  loading = signal(true);
  error = signal('');
  creating = signal(false);
  creatingWs = signal(false);
  showCreateForm = signal(false);
  showCreateWorkspace = signal(false);
  
  allUsers = signal<User[]>([]);
  selectedMembers = signal<string[]>([]);

  projectForm!: FormGroup;
  workspaceForm!: FormGroup;

  // --- Analytics Computed Signals ---
  totalProjects = computed(() => this.projects().length);
  totalTasks = computed(() => this.projects().reduce((sum, p) => sum + p.taskCount, 0));
  completedTasks = computed(() => this.projects().reduce((sum, p) => sum + p.completedCount, 0));
  overallProgress = computed(() => {
    const total = this.totalTasks();
    if (total === 0) return 0;
    return Math.round((this.completedTasks() / total) * 100);
  });

  // Chart Data
  public doughnutChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const completed = this.completedTasks();
    const pending = this.totalTasks() - completed;
    return {
      labels: ['Completed', 'In Progress / Pending'],
      datasets: [
        {
          data: [completed, pending],
          backgroundColor: ['#22C55E', '#3B4048'], // Green and Dark Gray
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    };
  });

  public doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#1A1D26',
        titleColor: '#FFFFFF',
        bodyColor: '#87909E',
        borderColor: '#3B4048',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true
      }
    }
  };

  ngOnInit(): void {
    this.projectForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      deadline: [''],
    });
    this.workspaceForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
    });
    this.loadWorkspaces();
    this.loadTeamUsers();
  }

  userName = () => this.authService.currentUser()?.name ?? '';
  userEmail = () => this.authService.currentUser()?.email ?? '';
  userRole = () => this.authService.currentUser()?.role ?? 'employee';
  userInitial = () => (this.authService.currentUser()?.name ?? 'U')[0].toUpperCase();
  getUserId = () => this.authService.currentUser()?._id ?? '';
  isAdmin = () => this.authService.currentUser()?.role === 'admin';
  isHRManagerAdmin = () => ['admin', 'hr', 'manager'].includes(this.authService.currentUser()?.role || '');
  isAccountantHRAdmin = () => ['admin', 'hr', 'accountant'].includes(this.authService.currentUser()?.role || '');

  loadWorkspaces(): void {
    this.workspaceService.getWorkspaces().subscribe({
      next: (res) => {
        this.workspaces.set(res);
        if (res.length > 0 && !this.activeWorkspace()) {
          this.activeWorkspace.set(res[0]);
        }
        this.loadProjects();
      },
      error: () => {
        this.error.set('Failed to load workspaces.');
        this.loadProjects();
      },
    });
  }

  selectWorkspace(id: string): void {
    if (!id) {
      this.activeWorkspace.set(null);
    } else {
      const ws = this.workspaces().find(w => w._id === id);
      this.activeWorkspace.set(ws || null);
    }
    this.loadProjects();
  }

  createWorkspace(): void {
    if (this.workspaceForm.invalid) {
      this.workspaceForm.markAllAsTouched();
      return;
    }
    this.creatingWs.set(true);
    this.workspaceService.createWorkspace(this.workspaceForm.value).subscribe({
      next: (ws) => {
        this.creatingWs.set(false);
        this.showCreateWorkspace.set(false);
        this.workspaceForm.reset();
        this.activeWorkspace.set(ws);
        this.loadWorkspaces();
      },
      error: () => {
        this.creatingWs.set(false);
        this.error.set('Failed to create workspace.');
      }
    });
  }

  loadProjects(): void {
    this.loading.set(true);
    const wsId = this.activeWorkspace() ? this.activeWorkspace()!._id : null;
    this.projectService.getAll(wsId).subscribe({
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

  loadTeamUsers(): void {
    const role = this.authService.currentUser()?.role;
    if (role === 'admin' || role === 'manager') {
      this.userService.getAll().subscribe({
        next: (res) => {
          if (res.success) {
            const currentUserId = this.authService.currentUser()?._id;
            this.allUsers.set(res.data.filter(u => u._id !== currentUserId));
          }
        }
      });
    }
  }

  toggleMember(userId: string): void {
    this.selectedMembers.update(list => 
      list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId]
    );
  }

  isMemberSelected(userId: string): boolean {
    return this.selectedMembers().includes(userId);
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
      .create({
        title, 
        description: description || undefined, 
        deadline: deadline || undefined,
        members: this.selectedMembers(),
        workspaceId: this.activeWorkspace() ? this.activeWorkspace()!._id : undefined
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.projectForm.reset();
          this.selectedMembers.set([]);
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
    this.selectedMembers.set([]);
  }

  deleteProject(id: string, title: string, event: Event): void {
    event.stopPropagation();
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

  getProjectStatus(project: ProjectWithStats): { label: string; class: string } {
    if (project.progressPercent === 100) return { label: 'Completed', class: 'status-completed' };
    if (project.deadline && this.isOverdue(project.deadline)) return { label: 'Overdue', class: 'status-overdue' };
    if (project.progressPercent > 0) return { label: 'In Progress', class: 'status-progress' };
    return { label: 'Not Started', class: 'status-not-started' };
  }
}
