import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskPriority, TaskStatus } from '../../models/types';

export interface FilterState {
  status: TaskStatus | '';
  priority: TaskPriority | '';
  deadline: 'today' | 'week' | 'overdue' | '';
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filter-bar">
      <div class="filter-group">
        <label for="filter-status">Status</label>
        <select
          id="filter-status"
          [ngModel]="filters().status"
          (ngModelChange)="updateFilter('status', $event)"
        >
          <option value="">All statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-priority">Priority</label>
        <select
          id="filter-priority"
          [ngModel]="filters().priority"
          (ngModelChange)="updateFilter('priority', $event)"
        >
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-deadline">Deadline</label>
        <select
          id="filter-deadline"
          [ngModel]="filters().deadline"
          (ngModelChange)="updateFilter('deadline', $event)"
        >
          <option value="">Any deadline</option>
          <option value="today">Due Today</option>
          <option value="week">Due This Week</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      @if (hasActiveFilters()) {
        <button class="btn-ghost btn-sm" (click)="clearFilters()" id="clear-filters-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Clear filters
        </button>
      }

      <div class="filter-results">
        {{ filteredTasks().length }} of {{ tasks.length }} tasks
      </div>
    </div>
  `,
})
export class FilterBarComponent implements OnChanges {
  @Input() tasks: Task[] = [];
  @Output() filtered = new EventEmitter<Task[]>();

  filters = signal<FilterState>({ status: '', priority: '', deadline: '' });

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.status !== '' || f.priority !== '' || f.deadline !== '';
  });

  filteredTasks = computed(() => {
    const f = this.filters();
    const now = new Date();

    return this.tasks.filter((task) => {
      if (f.status && task.status !== f.status) return false;
      if (f.priority && task.priority !== f.priority) return false;

      if (f.deadline) {
        if (!task.deadline) return false;
        const dl = new Date(task.deadline);

        if (f.deadline === 'today') {
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          if (dl > end) return false;
        } else if (f.deadline === 'week') {
          const end = new Date(now);
          end.setDate(end.getDate() + 7);
          if (dl > end) return false;
        } else if (f.deadline === 'overdue') {
          if (dl >= now || task.status === 'completed') return false;
        }
      }
      return true;
    });
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks']) {
      this.emitFiltered();
    }
  }

  updateFilter(key: keyof FilterState, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.emitFiltered();
  }

  clearFilters(): void {
    this.filters.set({ status: '', priority: '', deadline: '' });
    this.emitFiltered();
  }

  private emitFiltered(): void {
    this.filtered.emit(this.filteredTasks());
  }
}
