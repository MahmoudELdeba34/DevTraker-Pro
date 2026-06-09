import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Project } from '../../../models/types';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export interface ProjectListItem extends Project {
  taskCount: number;
  completedCount: number;
  progressPercent: number;
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
})
export class ProjectListComponent {
  locale = inject(LocaleService);

  projects = input<ProjectListItem[]>([]);
  loading = input(false);

  createProject = output<void>();
  editProject = output<ProjectListItem>();
  deleteProject = output<{ id: string; title: string }>();

  getStatus(project: ProjectListItem): { label: string; class: string } {
    if (project.progressPercent === 100) {
      return { label: this.locale.t('project.status.completed'), class: 'status-completed' };
    }
    if (project.deadline && new Date(project.deadline) < new Date()) {
      return { label: this.locale.t('project.status.overdue'), class: 'status-overdue' };
    }
    if (project.progressPercent > 0) {
      return { label: this.locale.t('project.status.inProgress'), class: 'status-progress' };
    }
    return { label: this.locale.t('project.status.notStarted'), class: 'status-not-started' };
  }

  tasksDoneLabel(project: ProjectListItem): string {
    return this.locale.t('projectList.tasksDone', {
      completed: project.completedCount,
      total: project.taskCount,
    });
  }

  dueLabel(dateStr: string): string {
    return this.locale.t('projectList.due', { date: this.formatDate(dateStr) });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  onDelete(project: ProjectListItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.deleteProject.emit({ id: project._id, title: project.title });
  }

  onEdit(project: ProjectListItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.editProject.emit(project);
  }
}
