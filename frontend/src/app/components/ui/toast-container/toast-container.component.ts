import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast-item"
          [ngClass]="{
            'toast-item--success': toast.type === 'success',
            'toast-item--error': toast.type === 'error',
            'toast-item--info': toast.type === 'info',
            'toast-item--warning': toast.type === 'warning'
          }"
        >
          <div class="toast-icon">
            @switch (toast.type) {
              @case ('success') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              }
              @case ('error') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              }
              @case ('warning') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              }
              @default {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              }
            }
          </div>

          <div class="toast-body">
            @if (toast.title) {
              <h4 class="toast-title">{{ toast.title }}</h4>
            }
            <p class="toast-message">{{ toast.message }}</p>
          </div>

          <button
            type="button"
            class="toast-close"
            (click)="toastService.remove(toast.id)"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        width: min(22rem, calc(100vw - 2rem));
        pointer-events: none;
      }
      .toast-item {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.875rem 1rem;
        border-radius: 0.875rem;
        border: 1px solid var(--color-border, #2a3142);
        background: var(--color-bg-elevated, #151922);
        box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.55);
        animation: toastIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .toast-item--success { border-color: rgba(34, 197, 94, 0.35); }
      .toast-item--error { border-color: rgba(239, 68, 68, 0.4); }
      .toast-item--info { border-color: rgba(59, 130, 246, 0.35); }
      .toast-item--warning { border-color: rgba(245, 158, 11, 0.35); }
      .toast-icon { flex-shrink: 0; margin-top: 0.125rem; }
      .toast-item--success .toast-icon { color: #22c55e; }
      .toast-item--error .toast-icon { color: #ef4444; }
      .toast-item--info .toast-icon { color: #3b82f6; }
      .toast-item--warning .toast-icon { color: #f59e0b; }
      .toast-body { flex: 1; min-width: 0; }
      .toast-title {
        margin: 0 0 0.125rem;
        font-size: 0.8125rem;
        font-weight: 700;
        color: #fff;
      }
      .toast-message {
        margin: 0;
        font-size: 0.75rem;
        line-height: 1.45;
        color: var(--text-secondary, #94a3b8);
      }
      .toast-close {
        flex-shrink: 0;
        color: var(--text-muted, #64748b);
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        transition: color 0.15s ease;
      }
      .toast-close:hover { color: #fff; }
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(12px) scale(0.96); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
    `,
  ],
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}
