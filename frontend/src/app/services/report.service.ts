import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, User } from '../models/types';

export interface TimesheetTask {
  taskId: string;
  title: string;
  projectTitle: string;
  durationMs: number;
  hours: number;
}

export interface DailyTimesheet {
  date: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  tasks: TimesheetTask[];
}

export interface ReportSummaryResponse {
  user: User;
  summary: {
    totalHours: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    daysWorkedCount: number;
  };
  days: DailyTimesheet[];
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  getSummary(userId?: string, startDate?: string, endDate?: string): Observable<ApiResponse<ReportSummaryResponse>> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    return this.http.get<ApiResponse<ReportSummaryResponse>>(`${this.apiUrl}/summary`, { params });
  }
}
