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
  inject,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Task, TaskPriority, TaskStatus } from '../../models/types';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

export interface FilterState {
  status: TaskStatus | '';
  priority: TaskPriority | '';
  deadline: 'today' | 'week' | 'overdue' | '';
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="filter-bar" [attr.data-locale]="locale.locale()">
      <div class="filter-group">
        <label for="filter-status">{{ 'filterBar.status' | translate }}</label>
        <select
          id="filter-status"
          [ngModel]="filters().status"
          (ngModelChange)="updateFilter('status', $event)"
        >
          <option value="">{{ 'filterBar.allStatuses' | translate }}</option>
          <option value="not_started">{{ 'task.status.notStarted' | translate }}</option>
          <option value="in_progress">{{ 'task.status.inProgress' | translate }}</option>
          <option value="completed">{{ 'task.status.completed' | translate }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-priority">{{ 'filterBar.priority' | translate }}</label>
        <select
          id="filter-priority"
          [ngModel]="filters().priority"
          (ngModelChange)="updateFilter('priority', $event)"
        >
          <option value="">{{ 'filterBar.allPriorities' | translate }}</option>
          <option value="low">{{ 'task.priority.low' | translate }}</option>
          <option value="medium">{{ 'task.priority.medium' | translate }}</option>
          <option value="high">{{ 'task.priority.high' | translate }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-deadline">{{ 'filterBar.deadline' | translate }}</label>
        <select
          id="filter-deadline"
          [ngModel]="filters().deadline"
          (ngModelChange)="updateFilter('deadline', $event)"
        >
          <option value="">{{ 'filterBar.anyDeadline' | translate }}</option>
          <option value="today">{{ 'filterBar.dueToday' | translate }}</option>
          <option value="week">{{ 'filterBar.dueWeek' | translate }}</option>
          <option value="overdue">{{ 'filterBar.overdue' | translate }}</option>
        </select>
      </div>

      @if (hasActiveFilters()) {
        <button class="btn-ghost btn-sm" (click)="clearFilters()" id="clear-filters-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          {{ 'filterBar.clear' | translate }}
        </button>
      }

      <div class="filter-results">
        {{ 'filterBar.results' | translate:{ filtered: filteredTasks().length, total: tasks.length } }}
      </div>
    </div>
  `,
})
export class FilterBarComponent implements OnChanges {
  locale = inject(LocaleService);

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
