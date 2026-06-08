import { Injectable, signal } from '@angular/core';
import { Task } from '../models/types';
import { TaskService } from './task.service';

@Injectable({ providedIn: 'root' })
export class ActiveTimerService {
  activeTask = signal<Task | null>(null);

  constructor(private taskService: TaskService) {}

  setActiveTask(task: Task | null) {
    this.activeTask.set(task);
  }

  stopTimer() {
    const task = this.activeTask();
    if (!task) return;
    
    this.taskService.stopTimer(task._id).subscribe({
      next: (res) => {
        this.activeTask.set(null);
      }
    });
  }
}
