import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Whiteboard } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class WhiteboardService {
  private apiUrl = `${environment.apiUrl}/whiteboards`;

  constructor(private http: HttpClient) {}

  getWhiteboards(workspaceId: string): Observable<Whiteboard[]> {
    return this.http.get<Whiteboard[]>(`${this.apiUrl}/workspace/${workspaceId}`);
  }

  getWhiteboard(id: string): Observable<Whiteboard> {
    return this.http.get<Whiteboard>(`${this.apiUrl}/${id}`);
  }

  createWhiteboard(data: { workspaceId: string; title: string }): Observable<Whiteboard> {
    return this.http.post<Whiteboard>(this.apiUrl, data);
  }

  updateWhiteboard(id: string, data: Partial<Whiteboard>): Observable<Whiteboard> {
    return this.http.put<Whiteboard>(`${this.apiUrl}/${id}`, data);
  }

  deleteWhiteboard(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
