import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Task, ApiResponse, TaskPriority, TaskStatus } from '../models/types';

export interface TaskFilters {
  status?: TaskStatus | '';
  priority?: TaskPriority | '';
  deadline?: 'today' | 'week' | 'overdue' | '';
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly apiUrl = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  getByProject(
    projectId: string,
    filters?: TaskFilters
  ): Observable<ApiResponse<Task[]>> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.priority) params = params.set('priority', filters.priority);
    if (filters?.deadline) params = params.set('deadline', filters.deadline);

    return this.http.get<ApiResponse<Task[]>>(
      `${this.apiUrl}/project/${projectId}`,
      { params }
    );
  }

  create(
    projectId: string,
    data: { title: string; priority?: TaskPriority; status?: TaskStatus; deadline?: string; assignedTo?: string | null }
  ): Observable<ApiResponse<Task>> {
    return this.http.post<ApiResponse<Task>>(
      `${this.apiUrl}/project/${projectId}`,
      data
    );
  }

  update(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      status: TaskStatus;
      deadline: string | null;
      startDate: string | null;
      assignedTo: string | null;
    }>
  ): Observable<ApiResponse<Task>> {
    return this.http.put<ApiResponse<Task>>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.delete<ApiResponse<{ message: string }>>(
      `${this.apiUrl}/${id}`
    );
  }

  getMyTimesheet(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/my/timesheet`);
  }

  /** Fetch the task timer currently running for the logged-in user, if any. */
  getActiveTimer(): Observable<ApiResponse<Task | null>> {
    return this.http.get<ApiResponse<Task | null>>(`${this.apiUrl}/my/active-timer`);
  }

  startTimer(id: string): Observable<ApiResponse<Task>> {
    return this.http.post<ApiResponse<Task>>(
      `${this.apiUrl}/${id}/timer/start`,
      {}
    );
  }

  stopTimer(id: string): Observable<ApiResponse<Task>> {
    return this.http.post<ApiResponse<Task>>(
      `${this.apiUrl}/${id}/timer/stop`,
      {}
    );
  }

  getTotalTime(id: string): Observable<ApiResponse<{ totalMs: number }>> {
    return this.http.get<ApiResponse<{ totalMs: number }>>(
      `${this.apiUrl}/${id}/timer/total`
    );
  }

  addSubtask(
    taskId: string,
    data: { title: string; priority?: TaskPriority; status?: TaskStatus; assignedTo?: string | null; deadline?: string }
  ): Observable<ApiResponse<Task>> {
    return this.http.post<ApiResponse<Task>>(`${this.apiUrl}/${taskId}/subtasks`, data);
  }

  updateSubtask(
    taskId: string,
    subtaskId: string,
    data: Partial<{ title: string; priority: TaskPriority; status: TaskStatus; assignedTo: string | null; deadline: string }>
  ): Observable<ApiResponse<Task>> {
    return this.http.put<ApiResponse<Task>>(`${this.apiUrl}/${taskId}/subtasks/${subtaskId}`, data);
  }

  deleteSubtask(taskId: string, subtaskId: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.delete<ApiResponse<{ message: string }>>(`${this.apiUrl}/${taskId}/subtasks/${subtaskId}`);
  }
}
