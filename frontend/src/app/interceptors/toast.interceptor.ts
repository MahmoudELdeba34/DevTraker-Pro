import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { SKIP_ERROR_TOAST } from '../core/http-context';

const SILENT_URL_PARTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/users/heartbeat',
];

function shouldSkipToast(req: HttpRequest<unknown>, err: HttpErrorResponse): boolean {
  if (req.context.get(SKIP_ERROR_TOAST)) return true;
  if (err.status === 401) return true;
  return SILENT_URL_PARTS.some((part) => req.url.includes(part));
}

export const toastInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !shouldSkipToast(req, err)) {
        toast.error(toast.messageFromError(err, 'Something went wrong. Please try again.'));
      }
      return throwError(() => err);
    })
  );
};
