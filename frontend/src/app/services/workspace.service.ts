import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Workspace, User } from '../models/types';

export interface WorkspaceMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  isOwner: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  private apiUrl = `${environment.apiUrl}/workspaces`;

  constructor(private http: HttpClient) {}

  getWorkspaces(): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(this.apiUrl);
  }

  createWorkspace(data: { name: string; description?: string; members?: string[] }): Observable<Workspace> {
    return this.http.post<Workspace>(this.apiUrl, data);
  }

  updateWorkspace(id: string, data: Partial<Workspace>): Observable<Workspace> {
    return this.http.put<Workspace>(`${this.apiUrl}/${id}`, data);
  }

  deleteWorkspace(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  // ─── Member Management ──────────────────────────────────────

  getMembers(workspaceId: string): Observable<WorkspaceMember[]> {
    return this.http.get<WorkspaceMember[]>(`${this.apiUrl}/${workspaceId}/members`);
  }

  addMember(workspaceId: string, userId: string): Observable<Workspace> {
    return this.http.post<Workspace>(`${this.apiUrl}/${workspaceId}/members`, { userId });
  }

  removeMember(workspaceId: string, userId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${workspaceId}/members/${userId}`);
  }
}

