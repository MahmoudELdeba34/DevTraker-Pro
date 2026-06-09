import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, ApiResponse } from '../models/types';
import { SKIP_ERROR_TOAST } from '../core/http-context';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(this.apiUrl);
  }

  changeRole(userId: string, role: 'employee' | 'manager' | 'admin'): Observable<ApiResponse<{ _id: string; role: string }>> {
    return this.http.put<ApiResponse<{ _id: string; role: string }>>(`${this.apiUrl}/${userId}/role`, { role });
  }

  sendHeartbeat(currentPage: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.apiUrl}/heartbeat`,
      { currentPage },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) }
    );
  }

  getActiveSessions(): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/active-sessions`);
  }
}
