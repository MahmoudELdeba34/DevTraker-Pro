import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

const MAX_TOASTS = 5;
const DEFAULT_MS = 4500;

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(message: string, type: Toast['type'] = 'info', title?: string, durationMs = DEFAULT_MS) {
    const id = Math.random().toString(36).substring(2, 11);
    this.toasts.update((t) => {
      const next = [...t, { id, type, message, title }];
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    });
    if (durationMs > 0) {
      setTimeout(() => this.remove(id), durationMs);
    }
  }

  success(message: string, title?: string) {
    this.show(message, 'success', title ?? 'Success');
  }

  error(message: string, title?: string) {
    this.show(message, 'error', title ?? 'Error', 6000);
  }

  info(message: string, title?: string) {
    this.show(message, 'info', title);
  }

  warning(message: string, title?: string) {
    this.show(message, 'warning', title ?? 'Warning');
  }

  messageFromError(err: unknown, fallback = 'Something went wrong'): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object') {
        const msg = (body as { error?: string; message?: string }).error
          ?? (body as { message?: string }).message;
        if (typeof msg === 'string' && msg.trim()) return msg;
      }
      if (err.status === 0) return 'Network error — check your connection.';
      if (err.status === 403) return 'You do not have permission to do that.';
      if (err.status === 404) return 'The requested resource was not found.';
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }

  remove(id: string) {
    this.toasts.update((t) => t.filter((toast) => toast.id !== id));
  }
}
