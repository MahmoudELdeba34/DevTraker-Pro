import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { Task } from '../models/types';
import { TaskService } from './task.service';
import { TimeEntryService } from './time-entry.service';

@Injectable({ providedIn: 'root' })
export class ActiveTimerService {
  activeTask = signal<Task | null>(null);

  private taskService = inject(TaskService);
  private timeEntryService = inject(TimeEntryService);

  /** Restore running task timer from the server (survives page refresh). */
  loadActive(): Observable<Task | null> {
    return this.taskService.getActiveTimer().pipe(
      map((res) => res.data ?? null),
      tap((task) => this.activeTask.set(task))
    );
  }

  setActiveTask(task: Task | null) {
    this.activeTask.set(task);
  }

  stopTimer() {
    const task = this.activeTask();
    if (!task) return;

    this.taskService.stopTimer(task._id).subscribe({
      next: () => {
        this.activeTask.set(null);
        this.timeEntryService.active.set(null);
      },
    });
  }
}
