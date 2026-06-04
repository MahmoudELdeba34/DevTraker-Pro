import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  EmployeeWithProfile,
  EmployeeProfile,
  Attendance,
  Leave,
  Permission,
  Overtime
} from '../models/types';

@Injectable({ providedIn: 'root' })
export class HRService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ─── Employee Profiles ──────────────────────────────────────────────────────
  getEmployees(): Observable<ApiResponse<EmployeeWithProfile[]>> {
    return this.http.get<ApiResponse<EmployeeWithProfile[]>>(`${this.baseUrl}/employees`);
  }

  getProfile(userId: string): Observable<ApiResponse<EmployeeWithProfile>> {
    return this.http.get<ApiResponse<EmployeeWithProfile>>(`${this.baseUrl}/employees/${userId}`);
  }

  updateProfile(userId: string, data: Partial<EmployeeProfile & { role: string }>): Observable<ApiResponse<EmployeeProfile>> {
    return this.http.put<ApiResponse<EmployeeProfile>>(`${this.baseUrl}/employees/${userId}`, data);
  }

  // ─── Attendance ─────────────────────────────────────────────────────────────
  checkIn(): Observable<ApiResponse<Attendance>> {
    return this.http.post<ApiResponse<Attendance>>(`${this.baseUrl}/attendance/check-in`, {});
  }

  checkOut(): Observable<ApiResponse<Attendance>> {
    return this.http.post<ApiResponse<Attendance>>(`${this.baseUrl}/attendance/check-out`, {});
  }

  startBreak(): Observable<ApiResponse<Attendance>> {
    return this.http.post<ApiResponse<Attendance>>(`${this.baseUrl}/attendance/break-start`, {});
  }

  endBreak(): Observable<ApiResponse<Attendance>> {
    return this.http.post<ApiResponse<Attendance>>(`${this.baseUrl}/attendance/break-end`, {});
  }

  getTodayAttendance(): Observable<ApiResponse<Attendance | null>> {
    return this.http.get<ApiResponse<Attendance | null>>(`${this.baseUrl}/attendance/today`);
  }

  getAttendanceHistory(): Observable<ApiResponse<Attendance[]>> {
    return this.http.get<ApiResponse<Attendance[]>>(`${this.baseUrl}/attendance/history`);
  }

  getTodayAdminAttendance(): Observable<ApiResponse<Attendance[]>> {
    return this.http.get<ApiResponse<Attendance[]>>(`${this.baseUrl}/attendance/admin/today`);
  }

  adjustAttendance(data: {
    userId: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    status: string;
    reason: string;
  }): Observable<ApiResponse<Attendance>> {
    return this.http.put<ApiResponse<Attendance>>(`${this.baseUrl}/attendance/admin/adjust`, data);
  }

  // ─── Leaves ─────────────────────────────────────────────────────────────────
  requestLeave(data: {
    leaveType: 'annual' | 'sick' | 'unpaid' | 'emergency';
    startDate: string;
    endDate: string;
    reason: string;
  }): Observable<ApiResponse<Leave>> {
    return this.http.post<ApiResponse<Leave>>(`${this.baseUrl}/leaves/request`, data);
  }

  getMyLeaves(): Observable<ApiResponse<Leave[]>> {
    return this.http.get<ApiResponse<Leave[]>>(`${this.baseUrl}/leaves/my-requests`);
  }

  getLeaveBalances(): Observable<ApiResponse<{ annualLeaveBalance: number }>> {
    return this.http.get<ApiResponse<{ annualLeaveBalance: number }>>(`${this.baseUrl}/leaves/balances`);
  }

  getPendingLeaves(): Observable<ApiResponse<Leave[]>> {
    return this.http.get<ApiResponse<Leave[]>>(`${this.baseUrl}/leaves/admin/pending`);
  }

  approveLeave(id: string): Observable<ApiResponse<Leave>> {
    return this.http.put<ApiResponse<Leave>>(`${this.baseUrl}/leaves/admin/${id}/approve`, {});
  }

  rejectLeave(id: string, rejectionReason: string): Observable<ApiResponse<Leave>> {
    return this.http.put<ApiResponse<Leave>>(`${this.baseUrl}/leaves/admin/${id}/reject`, { rejectionReason });
  }

  // ─── Permissions ────────────────────────────────────────────────────────────
  requestPermission(data: {
    type: 'late_arrival' | 'early_leave' | 'hourly' | 'remote' | 'correction';
    date: string;
    fromTime: string;
    toTime: string;
    reason: string;
  }): Observable<ApiResponse<Permission>> {
    return this.http.post<ApiResponse<Permission>>(`${this.baseUrl}/permissions/request`, data);
  }

  getMyPermissions(): Observable<ApiResponse<Permission[]>> {
    return this.http.get<ApiResponse<Permission[]>>(`${this.baseUrl}/permissions/my-requests`);
  }

  getPendingPermissions(): Observable<ApiResponse<Permission[]>> {
    return this.http.get<ApiResponse<Permission[]>>(`${this.baseUrl}/permissions/admin/pending`);
  }

  approvePermission(id: string): Observable<ApiResponse<Permission>> {
    return this.http.put<ApiResponse<Permission>>(`${this.baseUrl}/permissions/admin/${id}/approve`, {});
  }

  rejectPermission(id: string): Observable<ApiResponse<Permission>> {
    return this.http.put<ApiResponse<Permission>>(`${this.baseUrl}/permissions/admin/${id}/reject`, {});
  }

  // ─── Overtime ───────────────────────────────────────────────────────────────
  requestOvertime(data: {
    date: string;
    startTime: string;
    endTime: string;
    reason: string;
    multiplier?: number;
  }): Observable<ApiResponse<Overtime>> {
    return this.http.post<ApiResponse<Overtime>>(`${this.baseUrl}/overtime/request`, data);
  }

  getMyOvertime(): Observable<ApiResponse<Overtime[]>> {
    return this.http.get<ApiResponse<Overtime[]>>(`${this.baseUrl}/overtime/my-requests`);
  }

  getPendingOvertime(): Observable<ApiResponse<Overtime[]>> {
    return this.http.get<ApiResponse<Overtime[]>>(`${this.baseUrl}/overtime/admin/pending`);
  }

  approveOvertime(id: string): Observable<ApiResponse<Overtime>> {
    return this.http.put<ApiResponse<Overtime>>(`${this.baseUrl}/overtime/admin/${id}/approve`, {});
  }

  rejectOvertime(id: string): Observable<ApiResponse<Overtime>> {
    return this.http.put<ApiResponse<Overtime>>(`${this.baseUrl}/overtime/admin/${id}/reject`, {});
  }
}
