import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Project } from '../../../models/types';

export interface ProjectListItem extends Project {
  taskCount: number;
  completedCount: number;
  progressPercent: number;
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
})
export class ProjectListComponent {
  projects = input<ProjectListItem[]>([]);
  loading = input(false);

  createProject = output<void>();
  editProject = output<ProjectListItem>();
  deleteProject = output<{ id: string; title: string }>();

  getStatus(project: ProjectListItem): { label: string; class: string } {
    if (project.progressPercent === 100) return { label: 'Completed', class: 'status-completed' };
    if (project.deadline && new Date(project.deadline) < new Date()) {
      return { label: 'Overdue', class: 'status-overdue' };
    }
    if (project.progressPercent > 0) return { label: 'In Progress', class: 'status-progress' };
    return { label: 'Not Started', class: 'status-not-started' };
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
