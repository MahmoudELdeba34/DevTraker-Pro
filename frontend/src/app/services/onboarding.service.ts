import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, User, WorkspaceRole } from '../models/types';
import { Workspace } from '../models/types';

export interface OnboardingCredentialsResult {
  invitedUser: Pick<User, '_id' | 'name' | 'email'>;
  tempPassword: string;
  setupLink: string;
  shareMessage: string;
  setupExpiresAt?: string;
  emailSent: boolean;
  deliveryMethod: 'email' | 'manual';
  newAccount?: boolean;
  workspace?: Workspace;
}

export interface OnboardEmployeeRequest {
  email: string;
  role?: WorkspaceRole;
  globalRole?: User['role'];
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly workspacesUrl = `${environment.apiUrl}/workspaces`;

  constructor(private http: HttpClient) {}

  private unwrap<T>(res: ApiResponse<T> | T): T {
    return (res && typeof res === 'object' && 'data' in (res as object)
      ? (res as ApiResponse<T>).data
      : res) as T;
  }

  /** Create account (if needed), add to workspace, deliver password/setup link. */
  onboardEmployee(
    workspaceId: string,
    body: OnboardEmployeeRequest
  ): Observable<OnboardingCredentialsResult> {
    return this.http
      .post<ApiResponse<OnboardingCredentialsResult>>(
        `${this.workspacesUrl}/${workspaceId}/onboard-employee`,
        body
      )
      .pipe(map((res) => this.unwrap(res)));
  }

  /** Regenerate password + setup link for an existing member. */
  sendCredentials(
    workspaceId: string,
    userId: string
  ): Observable<OnboardingCredentialsResult> {
    return this.http
      .post<ApiResponse<OnboardingCredentialsResult>>(
        `${this.workspacesUrl}/${workspaceId}/members/${userId}/send-credentials`,
        {}
      )
      .pipe(map((res) => this.unwrap(res)));
  }
}
