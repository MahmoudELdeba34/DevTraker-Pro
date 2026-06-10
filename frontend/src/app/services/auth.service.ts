import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User, ApiResponse, AuthResponse } from '../models/types';

const STORAGE = {
  access: 'token',
  refresh: 'refreshToken',
  user: 'user',
};

/** Auth tokens live in sessionStorage (tab-scoped), not localStorage, to reduce XSS token theft persistence. */
const authStore = sessionStorage;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  readonly currentUser = signal<User | null>(this.loadUserFromStorage());
  readonly isLoggedIn = computed(
    () => this.currentUser() !== null && !!this.getAccessToken()
  );

  private refreshInProgress$: BehaviorSubject<string | null> | null = null;

  constructor(private http: HttpClient, private router: Router) {
    this.migrateLegacyLocalStorage();
  }

  /** One-time migration: move tokens out of localStorage into sessionStorage. */
  private migrateLegacyLocalStorage(): void {
    for (const key of Object.values(STORAGE)) {
      const legacy = localStorage.getItem(key);
      if (legacy && !authStore.getItem(key)) {
        authStore.setItem(key, legacy);
      }
      localStorage.removeItem(key);
    }
  }

  getAccessToken(): string | null {
    return authStore.getItem(STORAGE.access);
  }

  getRefreshToken(): string | null {
    return authStore.getItem(STORAGE.refresh);
  }

  hasRole(...roles: string[]): boolean {
    const role = this.currentUser()?.role;
    return !!role && roles.includes(role);
  }

  /** Employees and managers must enroll face before using the app. */
  roleRequiresFaceEnrollment(role: string): boolean {
    return role === 'employee' || role === 'manager';
  }

  needsFaceEnrollment(): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (!this.roleRequiresFaceEnrollment(user.role)) return false;
    return !user.faceEnrolled;
  }

  navigateAfterAuth(): void {
    if (this.needsFaceEnrollment()) {
      void this.router.navigate(['/face-enroll']);
      return;
    }
    void this.router.navigate(['/dashboard']);
  }

  private setSession(res: AuthResponse): void {
    const access = res.accessToken || res.token;
    if (access) authStore.setItem(STORAGE.access, access);
    if (res.refreshToken) authStore.setItem(STORAGE.refresh, res.refreshToken);
    if (res.user) {
      authStore.setItem(STORAGE.user, JSON.stringify(res.user));
      this.currentUser.set(res.user);
    }
  }

  private clearSession(): void {
    authStore.removeItem(STORAGE.access);
    authStore.removeItem(STORAGE.refresh);
    authStore.removeItem(STORAGE.user);
    this.currentUser.set(null);
  }

  login(email: string, password: string): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap((r) => { if (r.success && r.data) this.setSession(r.data); }));
  }

  getRegistrationStatus(): Observable<ApiResponse<{ open: boolean; bootstrap: boolean }>> {
    return this.http.get<ApiResponse<{ open: boolean; bootstrap: boolean }>>(
      `${this.apiUrl}/registration-status`
    );
  }

  register(
    name: string,
    email: string,
    password: string
  ): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/register`, { name, email, password })
      .pipe(tap((r) => { if (r.success && r.data) this.setSession(r.data); }));
  }

  refreshAccessToken(): Observable<string | null> {
    if (this.refreshInProgress$) return this.refreshInProgress$.asObservable();

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return of(null);

    this.refreshInProgress$ = new BehaviorSubject<string | null>(null);

    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/refresh`, { refreshToken })
      .pipe(
        switchMap((res) => {
          if (res.success && res.data) {
            this.setSession(res.data);
            const newAccess = res.data.accessToken || res.data.token;
            this.refreshInProgress$?.next(newAccess ?? null);
            this.refreshInProgress$?.complete();
            this.refreshInProgress$ = null;
            return of(newAccess ?? null);
          }
          this.refreshInProgress$?.next(null);
          this.refreshInProgress$?.complete();
          this.refreshInProgress$ = null;
          return of(null);
        }),
        catchError(() => {
          this.refreshInProgress$?.next(null);
          this.refreshInProgress$?.complete();
          this.refreshInProgress$ = null;
          return of(null);
        })
      );
  }

  logout(navigate: boolean = true): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http.post(`${this.apiUrl}/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.clearSession();
    if (navigate) this.router.navigate(['/login']);
  }

  logoutAll(): Observable<unknown> {
    return this.http
      .post<ApiResponse<{ message: string }>>(`${this.apiUrl}/logout-all`, {})
      .pipe(
        tap(() => {
          this.clearSession();
          this.router.navigate(['/login']);
        }),
        catchError((e) => {
          this.clearSession();
          this.router.navigate(['/login']);
          return throwError(() => e);
        })
      );
  }

  private loadUserFromStorage(): User | null {
    try {
      const raw = authStore.getItem(STORAGE.user);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  requestPasswordReset(email: string): Observable<ApiResponse<{ message: string; resetLink?: string }>> {
    return this.http.post<ApiResponse<{ message: string; resetLink?: string }>>(
      `${this.apiUrl}/forgot-password`,
      { email }
    );
  }

  validatePasswordReset(token: string, email: string): Observable<ApiResponse<{ email: string }>> {
    return this.http.get<ApiResponse<{ email: string }>>(
      `${this.apiUrl}/reset-password/validate`,
      { params: { token, email } }
    );
  }

  completePasswordReset(
    token: string,
    email: string,
    password: string
  ): Observable<ApiResponse<{ message: string }>> {
    return this.http.post<ApiResponse<{ message: string }>>(
      `${this.apiUrl}/reset-password`,
      { token, email, password }
    );
  }

  validateSetupAccount(token: string, email: string): Observable<ApiResponse<{ email: string; name: string }>> {
    return this.http.get<ApiResponse<{ email: string; name: string }>>(
      `${this.apiUrl}/setup-account/validate`,
      { params: { token, email } }
    );
  }

  completeSetupAccount(
    token: string,
    email: string,
    password: string
  ): Observable<ApiResponse<AuthResponse & { message?: string }>> {
    return this.http
      .post<ApiResponse<AuthResponse & { message?: string }>>(`${this.apiUrl}/setup-account`, {
        token,
        email,
        password,
      })
      .pipe(tap((r) => { if (r.success && r.data) this.setSession(r.data); }));
  }

  getMe(): Observable<ApiResponse<{ user: User }>> {
    return this.http.get<ApiResponse<{ user: User }>>(`${this.apiUrl}/me`);
  }

  updateProfile(name: string): Observable<ApiResponse<{ user: User }>> {
    return this.http.put<ApiResponse<{ user: User }>>(`${this.apiUrl}/me`, { name }).pipe(
      tap((r) => this.persistUserResponse(r))
    );
  }

  uploadAvatar(file: File): Observable<ApiResponse<{ user: User }>> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http
      .post<ApiResponse<{ user: User }>>(`${this.apiUrl}/me/avatar`, formData)
      .pipe(tap((r) => this.persistUserResponse(r)));
  }

  setAvatarUrl(avatarUrl: string): Observable<ApiResponse<{ user: User }>> {
    return this.http
      .put<ApiResponse<{ user: User }>>(`${this.apiUrl}/me/avatar`, { avatarUrl })
      .pipe(tap((r) => this.persistUserResponse(r)));
  }

  removeAvatar(): Observable<ApiResponse<{ user: User }>> {
    return this.http
      .delete<ApiResponse<{ user: User }>>(`${this.apiUrl}/me/avatar`)
      .pipe(tap((r) => this.persistUserResponse(r)));
  }

  getFaceStatus(): Observable<
    ApiResponse<{ enrolled: boolean; facePhotoUrl: string | null; enrolledAt: string | null }>
  > {
    return this.http.get<
      ApiResponse<{ enrolled: boolean; facePhotoUrl: string | null; enrolledAt: string | null }>
    >(`${this.apiUrl}/me/face`);
  }

  enrollFace(photo: Blob, descriptor: number[]): Observable<
    ApiResponse<{ enrolled: boolean; facePhotoUrl: string; enrolledAt: string }>
  > {
    const form = new FormData();
    form.append('photo', photo, 'face-enroll.jpg');
    form.append('faceDescriptor', JSON.stringify(descriptor));
    return this.http
      .post<ApiResponse<{ enrolled: boolean; facePhotoUrl: string; enrolledAt: string }>>(
        `${this.apiUrl}/me/face`,
        form
      )
      .pipe(
        tap((r) => {
          if (r.success) {
            const user = this.currentUser();
            if (user) {
              this.updateLocalUser({
                ...user,
                faceEnrolled: true,
                facePhotoUrl: r.data.facePhotoUrl,
              });
            }
          }
        })
      );
  }

  removeFaceProfile(): Observable<ApiResponse<{ enrolled: boolean }>> {
    return this.http
      .delete<ApiResponse<{ enrolled: boolean }>>(`${this.apiUrl}/me/face`)
      .pipe(
        tap((r) => {
          if (r.success) {
            const user = this.currentUser();
            if (user) {
              this.updateLocalUser({ ...user, faceEnrolled: false, facePhotoUrl: undefined });
            }
          }
        })
      );
  }

  private persistUserResponse(r: ApiResponse<{ user: User }>): void {
    if (r.success && r.data?.user) {
      authStore.setItem(STORAGE.user, JSON.stringify(r.data.user));
      this.currentUser.set(r.data.user);
    }
  }

  changePassword(currentPassword: string, newPassword: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.put<ApiResponse<{ message: string }>>(`${this.apiUrl}/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  updateLocalUser(user: User): void {
    authStore.setItem(STORAGE.user, JSON.stringify(user));
    this.currentUser.set(user);
  }
}
