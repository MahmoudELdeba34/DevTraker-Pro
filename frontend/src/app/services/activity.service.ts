import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, ActivityReport, PresenceReport } from '../models/types';

export interface RangeParams {
  from?: string; // YYYY-MM-DD
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private apiUrl = `${environment.apiUrl}/activity`;
  private http = inject(HttpClient);

  /** My own activity report (defaults to current month). */
  getMyReport(range: RangeParams = {}): Observable<ActivityReport> {
    return this.http
      .get<ApiResponse<ActivityReport>>(`${this.apiUrl}/me`, { params: this.toParams(range) })
      .pipe(map((r) => r.data));
  }

  /** Any user's report — admins / managers / hr only. */
  getUserReport(userId: string, range: RangeParams = {}): Observable<ActivityReport> {
    return this.http
      .get<ApiResponse<ActivityReport>>(`${this.apiUrl}/users/${userId}`, {
        params: this.toParams(range),
      })
      .pipe(map((r) => r.data));
  }

  /** Live team presence. */
  getPresence(): Observable<PresenceReport> {
    return this.http
      .get<ApiResponse<PresenceReport>>(`${this.apiUrl}/presence`)
      .pipe(map((r) => r.data));
  }

  /** Force-stop a user's active timer (admin / workspace admin). */
  stopUserTracking(userId: string): Observable<{ message: string; stopped: boolean }> {
    return this.http
      .post<ApiResponse<{ message: string; stopped: boolean }>>(
        `${this.apiUrl}/users/${userId}/stop-tracking`,
        {}
      )
      .pipe(map((r) => r.data));
  }

  private toParams(range: RangeParams): HttpParams {
    let p = new HttpParams();
    if (range.from) p = p.set('from', range.from);
    if (range.to) p = p.set('to', range.to);
    return p;
  }
}
