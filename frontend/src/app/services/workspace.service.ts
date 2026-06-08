import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  ApiResponse,
  User,
} from '../models/types';

// Re-export so existing imports of `WorkspaceMember` from this service keep working
export type { WorkspaceMember, WorkspaceRole } from '../models/types';

export interface InviteByEmailResult {
  workspace: Workspace;
  invitedUser: Pick<User, '_id' | 'name' | 'email'>;
  /** True if a brand-new account was created for this email. */
  newAccount: boolean;
  /** True if the credentials email was actually delivered. */
  emailSent: boolean;
  /**
   * Returned when a new account was created — share with the employee (no SMTP needed).
   */
  tempPassword?: string;
  setupLink?: string;
  shareMessage?: string;
  setupExpiresAt?: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private apiUrl = `${environment.apiUrl}/workspaces`;

  // Global state
  workspaces = signal<Workspace[]>([]);
  activeWorkspace = signal<Workspace | null>(null);

  // Convenience: the membership entry for the current user in the active ws
  activeWorkspaceMembership = computed(() => this.activeWorkspace());

  constructor(private http: HttpClient) {}

  /* ─── Helpers to unwrap {success, data} or raw arrays from the server ── */
  private unwrap<T>(res: any): T {
    return (res && typeof res === 'object' && 'data' in res ? res.data : res) as T;
  }

  /* ─── List + active-state management ───────────────────────────────── */
  loadWorkspaces(): void {
    this.http.get<ApiResponse<Workspace[]> | Workspace[]>(this.apiUrl).subscribe({
      next: (res) => {
        const data = this.unwrap<Workspace[]>(res) || [];
        this.workspaces.set(data);
        const active = this.activeWorkspace();
        if (data.length > 0 && (!active || !data.find((w) => w._id === active._id))) {
          this.activeWorkspace.set(data[0]);
        } else if (data.length === 0) {
          this.activeWorkspace.set(null);
        }
      },
      error: (err) => console.error('Failed to load workspaces', err),
    });
  }

  setActiveWorkspace(wsId: string): void {
    const ws = this.workspaces().find((w) => w._id === wsId);
    if (ws) this.activeWorkspace.set(ws);
  }

  /* ─── CRUD ─────────────────────────────────────────────────────────── */
  getWorkspaces(): Observable<Workspace[]> {
    return this.http
      .get<ApiResponse<Workspace[]> | Workspace[]>(this.apiUrl)
      .pipe(map((r) => this.unwrap<Workspace[]>(r)));
  }

  createWorkspace(data: {
    name: string;
    description?: string;
    memberIds?: string[];
  }): Observable<Workspace> {
    return this.http
      .post<ApiResponse<Workspace> | Workspace>(this.apiUrl, data)
      .pipe(map((r) => this.unwrap<Workspace>(r)));
  }

  updateWorkspace(id: string, data: Partial<Workspace>): Observable<Workspace> {
    return this.http
      .put<ApiResponse<Workspace> | Workspace>(`${this.apiUrl}/${id}`, data)
      .pipe(map((r) => this.unwrap<Workspace>(r)));
  }

  deleteWorkspace(id: string): Observable<{ message: string }> {
    return this.http
      .delete<ApiResponse<{ message: string }> | { message: string }>(`${this.apiUrl}/${id}`)
      .pipe(map((r) => this.unwrap<{ message: string }>(r)));
  }

  /* ─── Member management ────────────────────────────────────────────── */
  getMembers(workspaceId: string): Observable<WorkspaceMember[]> {
    return this.http
      .get<ApiResponse<WorkspaceMember[]> | WorkspaceMember[]>(
        `${this.apiUrl}/${workspaceId}/members`
      )
      .pipe(map((r) => this.unwrap<WorkspaceMember[]>(r)));
  }

  /** Users not yet in the workspace — for "add existing member" search. */
  searchAvailableMembers(workspaceId: string, query = ''): Observable<User[]> {
    const params = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.http
      .get<ApiResponse<User[]> | User[]>(
        `${this.apiUrl}/${workspaceId}/available-members${params}`
      )
      .pipe(map((r) => this.unwrap<User[]>(r) || []));
  }

  /** Add an existing user (by id) with an explicit role. */
  addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole = 'member'
  ): Observable<Workspace> {
    return this.http
      .post<ApiResponse<Workspace> | Workspace>(`${this.apiUrl}/${workspaceId}/members`, {
        userId,
        role,
      })
      .pipe(map((r) => this.unwrap<Workspace>(r)));
  }

  /** Invite by email — creates an account if needed (global admin/HR only). */
  inviteByEmail(
    workspaceId: string,
    email: string,
    role: WorkspaceRole = 'member',
    globalRole?: User['role']
  ): Observable<InviteByEmailResult> {
    return this.http
      .post<ApiResponse<InviteByEmailResult>>(
        `${this.apiUrl}/${workspaceId}/invite-by-email`,
        { email, role, globalRole }
      )
      .pipe(map((r) => this.unwrap<InviteByEmailResult>(r)));
  }

  /** Change a member's workspace role. */
  changeMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Observable<Workspace> {
    return this.http
      .put<ApiResponse<Workspace> | Workspace>(
        `${this.apiUrl}/${workspaceId}/members/${userId}`,
        { role }
      )
      .pipe(map((r) => this.unwrap<Workspace>(r)));
  }

  removeMember(workspaceId: string, userId: string): Observable<{ message: string }> {
    return this.http
      .delete<ApiResponse<{ message: string }> | { message: string }>(
        `${this.apiUrl}/${workspaceId}/members/${userId}`
      )
      .pipe(map((r) => this.unwrap<{ message: string }>(r)));
  }
}
