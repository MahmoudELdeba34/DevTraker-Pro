import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
  computed,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { ActiveTimerService } from '../../services/active-timer.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { TimeEntry } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { WorkspaceService } from '../../services/workspace.service';
import { Project, Task } from '../../models/types';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { ConfirmDialogComponent } from '../../components/ui/confirm-dialog/confirm-dialog.component';
import { ProjectFormModalComponent } from '../../components/projects/project-form-modal/project-form-modal.component';
import { ToastService } from '../../services/toast.service';
import { ProjectListComponent } from '../../components/projects/project-list/project-list.component';
import { WorkspaceMember } from '../../services/workspace.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActivityService } from '../../services/activity.service';
import { ActivityReport } from '../../models/types';

interface ProjectWithStats extends Project {
  taskCount: number;
  completedCount: number;
  progressPercent: number;
}

interface WorkspaceTask extends Task {
  projectName: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    BaseChartDirective,
    ConfirmDialogComponent,
    ProjectFormModalComponent,
    ProjectListComponent,
    TranslatePipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
// Main Dashboard Component
export class DashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private authService = inject(AuthService);
  workspaceService = inject(WorkspaceService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public activeTimerService = inject(ActiveTimerService);
  private timeEntryService = inject(TimeEntryService);
  locale = inject(LocaleService);
  private toast = inject(ToastService);
  private activityService = inject(ActivityService);

  projects = signal<ProjectWithStats[]>([]);
  weekReport = signal<ActivityReport | null>(null);
  workspaceTasks = signal<WorkspaceTask[]>([]);
  loading = signal(true);
  creating = signal(false);
  showCreateForm = signal(false);
  editingProjectId = signal<string | null>(null);
  
  workspaceMembers = signal<WorkspaceMember[]>([]);
  selectedMembers = signal<string[]>([]);
  deleteProjectConfirm = signal<{ id: string; title: string } | null>(null);

  deleteProjectMessage = computed(() => {
    this.locale.locale();
    const req = this.deleteProjectConfirm();
    if (!req) return '';
    return this.locale.t('common.deleteProjectMessage', { title: req.title });
  });

  projectForm!: FormGroup;

  // New properties for UI
  weekStart: Date = new Date();
  weekEnd: Date = new Date();
  globalDisplayTime = signal('00:00:00');
  private timerInterval?: ReturnType<typeof setInterval>;
  
  /** Unified label — task title OR quick session description. */
  runningLabel = computed(() => {
    this.locale.locale();
    const task = this.activeTimerService.activeTask();
    if (task) return task.title;
    const entry = this.timeEntryService.active();
    if (entry) return entry.description?.trim() || this.locale.t('shell.quickSession');
    return this.locale.t('dashboard.noActiveTask');
  });

  anyTimerRunning = computed(
    () => !!this.activeTimerService.activeTask() || !!this.timeEntryService.active()
  );

  trackingKind = computed<'task' | 'quick' | null>(() => {
    if (this.activeTimerService.activeTask()) return 'task';
    if (this.timeEntryService.active()) return 'quick';
    return null;
  });

  constructor() {
    effect(() => {
      // Re-run loadProjects whenever activeWorkspace changes
      const ws = this.workspaceService.activeWorkspace();
      // Only load if workspace is loaded (prevent initial double load if not ready)
      if (ws !== undefined) {
        this.loadProjects();
        this.loadWorkspaceMembers();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const task = this.activeTimerService.activeTask();
      const entry = this.timeEntryService.active();
      if (task) {
        this.startTickForTask(task);
      } else if (entry) {
        this.startTickForEntry(entry);
      } else {
        this.stopTick();
      }
    }, { allowSignalWrites: true });
    
    // Set current week dates
    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + 1; // First day is Monday
    const last = first + 6; // last day is Sunday
    this.weekStart = new Date(curr.setDate(first));
    this.weekEnd = new Date(curr.setDate(last));
  }

  // --- Analytics Computed Signals ---
  totalProjects = computed(() => this.projects().length);
  totalTasks = computed(() => this.projects().reduce((sum, p) => sum + p.taskCount, 0));
  completedTasks = computed(() => this.projects().reduce((sum, p) => sum + p.completedCount, 0));
  overallProgress = computed(() => {
    const total = this.totalTasks();
    if (total === 0) return 0;
    return Math.round((this.completedTasks() / total) * 100);
  });

  weekHoursMs = computed(() => this.weekReport()?.summary.totalTrackedMs ?? 0);
  weekOvertimeMs = computed(() => this.weekReport()?.summary.totalOvertimeMs ?? 0);
  weekDaysWorked = computed(() => this.weekReport()?.summary.daysWorked ?? 0);

  formatHm = (ms: number): string => {
    const totalMin = Math.max(0, Math.floor(ms / 60_000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  // Chart Data
  public doughnutChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    this.locale.locale();
    const completed = this.completedTasks();
    const pending = this.totalTasks() - completed;
    return {
      labels: [this.locale.t('common.chartCompleted'), this.locale.t('common.chartInProgressPending')],
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

  currentDate = new Date();

  public lineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    this.locale.locale();
    const weekDays = this.buildWeekDaySeries();
    const labels = weekDays.map((d) => d.label);
    const actual = weekDays.map((d) => d.hours);
    const goal = weekDays.map((d) => (d.isWeekend ? 0 : 7));
    return {
      labels,
      datasets: [
        {
          data: actual,
          label: this.locale.t('common.actualHours'),
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45, 212, 191, 0.12)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#2dd4bf',
          pointBorderColor: '#0a0f1a',
          pointHoverBackgroundColor: '#0a0f1a',
          pointHoverBorderColor: '#2dd4bf',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          data: goal,
          label: this.locale.t('reports.chart.goal7h'),
          borderColor: '#F59E0B',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
        },
      ],
    };
  });

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 12,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        border: {
          display: false
        },
        ticks: {
          color: '#87909E',
          font: {
            size: 11
          },
          stepSize: 4
        }
      },
      x: {
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          color: '#87909E',
          font: {
            size: 11
          }
        }
      }
    },
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
        usePointStyle: true,
        mode: 'index',
        intersect: false
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  ngOnInit(): void {
    this.activeTimerService.loadActive().subscribe();
    this.timeEntryService.loadActive().subscribe();
    this.loadWeekAnalytics();

    this.projectForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      deadline: [''],
    });
    this.loadWorkspaceMembers();

    // Check for create project query param from sidebar
    this.route.queryParams.subscribe(params => {
      if (params['create'] === 'true') {
        // Use timeout to ensure it runs after change detection cycle
        setTimeout(() => {
          this.openCreateForm();
          // Remove the query param from the URL
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { create: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
        });
      }
    });
  }

  userName = () => this.authService.currentUser()?.name ?? '';
  userEmail = () => this.authService.currentUser()?.email ?? '';
  userRole = () => this.authService.currentUser()?.role ?? 'employee';
  userInitial = () => (this.authService.currentUser()?.name ?? 'U')[0].toUpperCase();
  getUserId = () => this.authService.currentUser()?._id ?? '';
  isAdmin = () => this.authService.currentUser()?.role === 'admin';
  isHRManagerAdmin = () => ['admin', 'hr', 'manager'].includes(this.authService.currentUser()?.role || '');
  isAccountantHRAdmin = () => ['admin', 'hr', 'accountant'].includes(this.authService.currentUser()?.role || '');

  private loadWeekAnalytics(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7;
    const from = new Date(today);
    from.setDate(today.getDate() - dow);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    this.activityService
      .getMyReport({ from: this.toYmd(from), to: this.toYmd(to) })
      .subscribe({
        next: (report) => this.weekReport.set(report),
        error: () => this.weekReport.set(null),
      });
  }

  private buildWeekDaySeries(): { label: string; hours: number; isWeekend: boolean }[] {
    const r = this.weekReport();
    const byDate = new Map(
      (r?.daily ?? []).map((d) => [d.date, (d.trackedMs || d.attendanceMs || 0) / 3_600_000])
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dow);
    const dayKeys = ['common.chartMon', 'common.chartTue', 'common.chartWed', 'common.chartThu', 'common.chartFri', 'common.chartSat', 'common.chartSun'];
    return dayKeys.map((key, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ymd = this.toYmd(d);
      return {
        label: this.locale.t(key),
        hours: Number((byDate.get(ymd) ?? 0).toFixed(2)),
        isWeekend: i >= 5,
      };
    });
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  loadProjects(): void {
    this.loading.set(true);
    this.workspaceTasks.set([]); // Reset tasks
    const wsId = this.workspaceService.activeWorkspace() ? this.workspaceService.activeWorkspace()!._id : null;
    this.projectService.getAll(wsId).subscribe({
      next: async (res) => {
        const projects = res.data;
        const withStats = await Promise.all(
          projects.map((p) => this.enrichProject(p))
        );
        this.projects.set(withStats);
        
        // Sort tasks by most recent deadline or creation date
        this.workspaceTasks.update(tasks => tasks.sort((a, b) => {
          if (a.deadline && b.deadline) {
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          }
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }));
        
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  loadWorkspaceMembers(): void {
    const ws = this.workspaceService.activeWorkspace();
    if (!ws) {
      this.workspaceMembers.set([]);
      return;
    }
    this.workspaceService.getMembers(ws._id).subscribe({
      next: (members) => this.workspaceMembers.set(members || []),
      error: () => this.workspaceMembers.set([]),
    });
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
              
          // Add tasks to workspace global pool
          const workspaceSpecificTasks: WorkspaceTask[] = tasks.map(t => ({...t, projectName: project.title}));
          this.workspaceTasks.update(prev => [...prev, ...workspaceSpecificTasks]);
          
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

  openCreateForm(): void {
    this.editingProjectId.set(null);
    this.projectForm.reset();
    this.selectedMembers.set([]);
    this.showCreateForm.set(true);
  }

  editProject(project: ProjectWithStats): void {
    this.editingProjectId.set(project._id);
    this.projectForm.patchValue({
      title: project.title,
      description: project.description || '',
      deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '',
    });
    this.selectedMembers.set(project.members || []);
    this.showCreateForm.set(true);
  }

  submitProject(): void {
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

    const payload = {
      title, 
      description: description || undefined, 
      deadline: deadline || undefined,
      members: this.selectedMembers(),
      workspaceId: this.workspaceService.activeWorkspace() ? this.workspaceService.activeWorkspace()!._id : undefined
    };

    const request$ = this.editingProjectId() 
      ? this.projectService.update(this.editingProjectId()!, payload)
      : this.projectService.create(payload);

    const isEdit = !!this.editingProjectId();
    request$.subscribe({
      next: () => {
        this.creating.set(false);
        this.cancelCreate();
        this.loadProjects();
        this.toast.success(isEdit ? 'Project updated.' : 'Project created.');
      },
      error: () => {
        this.creating.set(false);
      },
    });
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.editingProjectId.set(null);
    this.projectForm.reset();
    this.selectedMembers.set([]);
  }

  deleteProject(id: string, title: string): void {
    this.deleteProjectConfirm.set({ id, title });
  }

  cancelDeleteProject(): void {
    this.deleteProjectConfirm.set(null);
  }

  executeDeleteProject(): void {
    const req = this.deleteProjectConfirm();
    if (!req) return;
    this.deleteProjectConfirm.set(null);
    this.projectService.delete(req.id).subscribe({
      next: () => {
        this.loadProjects();
        this.toast.success('Project deleted.');
      },
      error: () => {},
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

  getTaskStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'not_started': 'Not Started',
      'in_progress': 'In Progress',
      'in_review': 'In Review',
      'completed': 'Completed'
    };
    return map[status] || status;
  }
  
  getTaskPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      'low': 'text-info bg-info/10 border-info/20',
      'medium': 'text-warning bg-warning/10 border-warning/20',
      'high': 'text-danger bg-danger/10 border-danger/20',
      'urgent': 'text-white bg-danger border-danger'
    };
    return map[priority] || 'text-text-muted bg-bg-base border-border';
  }

  private startTickForTask(task: any) {
    this.stopTick();
    const loggedMs = task.timeLogs?.reduce((acc: number, l: any) => acc + l.duration, 0) || 0;

    const tick = () => {
      const elapsed = task.activeTimerStart
        ? Date.now() - new Date(task.activeTimerStart).getTime()
        : 0;
      this.updateDisplayTime(loggedMs + elapsed);
    };
    tick();
    this.timerInterval = setInterval(tick, 1000);
  }

  private startTickForEntry(entry: TimeEntry) {
    this.stopTick();
    const startMs = new Date(entry.startedAt).getTime();
    const tick = () => this.updateDisplayTime(Date.now() - startMs);
    tick();
    this.timerInterval = setInterval(tick, 1000);
  }

  private updateDisplayTime(totalMs: number) {
    const totalSec = Math.floor(totalMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    // Format to 94:18:49
    this.globalDisplayTime.set(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
  }

  private stopTick() {
    if (this.timerInterval !== undefined) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.globalDisplayTime.set('00:00:00');
  }
}
