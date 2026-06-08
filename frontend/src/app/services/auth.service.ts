import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User, ApiResponse, AuthResponse } from '../models/types';

const STORAGE = {
  access: 'token',          // kept as 'token' for backwards compatibility
  refresh: 'refreshToken',
  user: 'user',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  readonly currentUser = signal<User | null>(this.loadUserFromStorage());
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  /**
   * Used by the JWT interceptor to coordinate concurrent 401s.
   * - null      → no refresh in flight
   * - non-null  → emits the new access token on success, or `null` on failure
   */
  private refreshInProgress$: BehaviorSubject<string | null> | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  /* ─── Public token getters/setters ──────────────────────────────────── */

  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE.access);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE.refresh);
  }

  private setSession(res: AuthResponse): void {
    // Accept either { accessToken } (new) or { token } (back-compat)
    const access = res.accessToken || res.token;
    if (access) localStorage.setItem(STORAGE.access, access);
    if (res.refreshToken) localStorage.setItem(STORAGE.refresh, res.refreshToken);
    if (res.user) {
      localStorage.setItem(STORAGE.user, JSON.stringify(res.user));
      this.currentUser.set(res.user);
    }
  }

  private clearSession(): void {
    localStorage.removeItem(STORAGE.access);
    localStorage.removeItem(STORAGE.refresh);
    localStorage.removeItem(STORAGE.user);
    this.currentUser.set(null);
  }

  /* ─── Auth endpoints ────────────────────────────────────────────────── */

  login(email: string, password: string): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap((r) => { if (r.success && r.data) this.setSession(r.data); })
      );
  }

  register(
    name: string,
    email: string,
    password: string,
    role: string
  ): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.apiUrl}/register`, { name, email, password, role })
      .pipe(
        tap((r) => { if (r.success && r.data) this.setSession(r.data); })
      );
  }

  /**
   * Called by the HTTP interceptor when a request fails with 401.
   * Coalesces concurrent calls so we only hit /refresh once.
   * Resolves with the new access token, or null on failure.
   */
  refreshAccessToken(): Observable<string | null> {
    // A refresh is already running — subscribe to the same stream
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
            this.refreshInProgress$?.next(newAccess);
            this.refreshInProgress$?.complete();
            this.refreshInProgress$ = null;
            return of(newAccess);
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

  /** Log out of the current device — revokes the refresh token server-side. */
  logout(navigate: boolean = true): void {
    const refreshToken = this.getRefreshToken();
    // Fire-and-forget: don't block the UX if the network is dead
    if (refreshToken) {
      this.http.post(`${this.apiUrl}/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.clearSession();
    if (navigate) this.router.navigate(['/login']);
  }

  /** Log out of every device — useful after password reset. */
  logoutAll(): Observable<unknown> {
    return this.http
      .post<ApiResponse<{ message: string }>>(`${this.apiUrl}/logout-all`, {})
      .pipe(
        tap(() => {
          this.clearSession();
          this.router.navigate(['/login']);
        }),
        catchError((e) => { this.clearSession(); this.router.navigate(['/login']); return throwError(() => e); })
      );
  }

  private loadUserFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE.user);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
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
      tap((r) => {
        if (r.success && r.data?.user) {
          localStorage.setItem(STORAGE.user, JSON.stringify(r.data.user));
          this.currentUser.set(r.data.user);
        }
      })
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.put<ApiResponse<{ message: string }>>(`${this.apiUrl}/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  updateLocalUser(user: User): void {
    localStorage.setItem(STORAGE.user, JSON.stringify(user));
    this.currentUser.set(user);
  }
}
