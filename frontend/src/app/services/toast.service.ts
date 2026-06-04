import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(message: string, type: Toast['type'] = 'info', title?: string) {
    const id = Math.random().toString(36).substring(2, 9);
    this.toasts.update(t => [...t, { id, type, message, title }]);
    setTimeout(() => this.remove(id), 4000);
  }

  success(message: string, title?: string) { this.show(message, 'success', title); }
  error(message: string, title?: string) { this.show(message, 'error', title); }
  info(message: string, title?: string) { this.show(message, 'info', title); }
  warning(message: string, title?: string) { this.show(message, 'warning', title); }

  remove(id: string) {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }
}
