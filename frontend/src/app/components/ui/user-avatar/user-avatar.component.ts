import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { getInitials, resolveAvatarUrl } from '../../../core/utils/avatar.util';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="user-avatar-wrap" [class]="sizeClass()">
      @if (showImage()) {
        <img
          class="user-avatar-img"
          [src]="resolvedUrl()!"
          [alt]="name()"
          (error)="onImgError()"
        />
      } @else {
        <span class="user-avatar-initials">{{ initials() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .user-avatar-wrap {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--accent-muted);
        border: 1px solid var(--border-active);
        color: var(--accent);
        font-weight: 700;
      }

      .user-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .user-avatar-initials {
        line-height: 1;
      }

      .size-xs {
        width: 2rem;
        height: 2rem;
        font-size: 0.75rem;
      }

      .size-sm {
        width: 2.25rem;
        height: 2.25rem;
        font-size: 0.8125rem;
      }

      .size-md {
        width: 2.5rem;
        height: 2.5rem;
        font-size: 0.875rem;
      }

      .size-lg {
        width: 4rem;
        height: 4rem;
        font-size: 1.25rem;
      }

      .size-xl {
        width: 6rem;
        height: 6rem;
        font-size: 1.875rem;
        border-width: 4px;
      }
    `,
  ],
})
export class UserAvatarComponent {
  name = input.required<string>();
  avatarUrl = input<string | undefined>();
  size = input<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');

  private imgFailed = signal(false);

  resolvedUrl = computed(() => resolveAvatarUrl(this.avatarUrl()));
  showImage = computed(() => !!this.resolvedUrl() && !this.imgFailed());
  initials = computed(() => getInitials(this.name()));
  sizeClass = computed(() => `size-${this.size()}`);

  constructor() {
    effect(() => {
      this.avatarUrl();
      this.imgFailed.set(false);
    });
  }

  onImgError(): void {
    this.imgFailed.set(true);
  }
}
