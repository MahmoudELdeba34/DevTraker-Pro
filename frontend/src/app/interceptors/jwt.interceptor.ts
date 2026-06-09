import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpEvent,
} from '@angular/common/http';
import { catchError, switchMap, throwError, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * URLs that should NEVER trigger the refresh-and-retry dance.
 * Refresh requests themselves must not loop, and login/register failures
 * should propagate normally.
 */
const REFRESH_SKIP_URLS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function attachAccessToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);

  const accessToken = auth.getAccessToken();
  const initialReq = attachAccessToken(req, accessToken);

  return next(initialReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }

      // Don't try to refresh on auth endpoints themselves
      const isAuthEndpoint = REFRESH_SKIP_URLS.some((path) => req.url.includes(path));
      if (isAuthEndpoint) {
        return throwError(() => err);
      }

      // No refresh token available — bounce to login
      if (!auth.getRefreshToken()) {
        auth.logout();
        return throwError(() => err);
      }

      // Try to refresh, then retry the original request once
      return auth.refreshAccessToken().pipe(
        switchMap((newToken: string | null) => {
          if (!newToken) {
            auth.logout();
            return throwError(() => err);
          }
          const retried = attachAccessToken(req, newToken);
          return next(retried);
        }),
        catchError((retryErr) => {
          auth.logout();
          return throwError(() => retryErr);
        })
      );
    })
  );
};
