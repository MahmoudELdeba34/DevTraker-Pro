import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Project, ApiResponse } from '../models/types';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly apiUrl = `${environment.apiUrl}/projects`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResponse<Project[]>> {
    return this.http.get<ApiResponse<Project[]>>(this.apiUrl);
  }

  create(data: {
    title: string;
    description?: string;
    deadline?: string;
  }): Observable<ApiResponse<Project>> {
    return this.http.post<ApiResponse<Project>>(this.apiUrl, data);
  }

  update(
    id: string,
    data: Partial<{ title: string; description: string; deadline: string }>
  ): Observable<ApiResponse<Project>> {
    return this.http.put<ApiResponse<Project>>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.delete<ApiResponse<{ message: string }>>(
      `${this.apiUrl}/${id}`
    );
  }
}
