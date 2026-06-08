import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TimeEntry, ApiResponse } from '../models/types';

export interface StartEntryPayload {
  description?: string;
  taskId?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TimeEntryService {
  private apiUrl = `${environment.apiUrl}/time-entries`;
  private http = inject(HttpClient);

  /** Currently running entry for the logged-in user (null when idle). */
  readonly active = signal<TimeEntry | null>(null);
  /** A short rolling buffer of recent entries, refreshed when the popover opens. */
  readonly recent = signal<TimeEntry[]>([]);

  /** Fetch and cache the active entry. Call on app boot + after auth changes. */
  loadActive(): Observable<TimeEntry | null> {
    return this.http.get<ApiResponse<TimeEntry | null>>(`${this.apiUrl}/active`).pipe(
      map((r) => r.data ?? null),
      tap((entry) => this.active.set(entry))
    );
  }

  /** Load my recent entries (default 20). */
  loadRecent(limit = 20): Observable<TimeEntry[]> {
    return this.http
      .get<ApiResponse<TimeEntry[]>>(`${this.apiUrl}?limit=${limit}`)
      .pipe(
        map((r) => r.data || []),
        tap((list) => this.recent.set(list))
      );
  }

  /** Start a quick session (or task-linked entry). Server auto-stops anything running. */
  start(payload: StartEntryPayload): Observable<TimeEntry> {
    return this.http
      .post<ApiResponse<TimeEntry>>(`${this.apiUrl}/start`, payload)
      .pipe(
        map((r) => r.data),
        tap((entry) => this.active.set(entry))
      );
  }

  /** Stop the running entry. Returns the just-stopped entry (or null). */
  stop(): Observable<TimeEntry | null> {
    return this.http.post<ApiResponse<TimeEntry | null>>(`${this.apiUrl}/stop`, {}).pipe(
      map((r) => r.data ?? null),
      tap(() => this.active.set(null))
    );
  }

  /** Edit a past or running entry. */
  update(id: string, patch: Partial<StartEntryPayload>): Observable<TimeEntry> {
    return this.http
      .put<ApiResponse<TimeEntry>>(`${this.apiUrl}/${id}`, patch)
      .pipe(
        map((r) => r.data),
        tap((entry) => {
          if (this.active()?._id === id) this.active.set(entry);
        })
      );
  }

  /** Delete an entry. */
  delete(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<{ message: string }>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }
}
