import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type ConfirmVariant = 'danger' | 'accent' | 'warning';
export type ConfirmIcon = 'alert' | 'clock' | 'check' | 'warning';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  open = input(false);
  title = input('');
  message = input('');
  confirmLabel = input('Confirm');
  cancelLabel = input('Cancel');
  variant = input<ConfirmVariant>('accent');
  icon = input<ConfirmIcon>('alert');
  showInput = input(false);
  showTextarea = input(false);
  inputPlaceholder = input('');
  inputDefault = input('');
  closeOnBackdrop = input(true);

  confirmed = output<string | void>();
  cancelled = output<void>();

  inputText = signal('');

  requiresInput = computed(() => this.showInput() || this.showTextarea());

  iconContainerClass = computed(() => {
    switch (this.variant()) {
      case 'danger':
        return 'bg-danger/10 text-danger';
      case 'warning':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-accent/10 text-accent';
    }
  });

  confirmButtonClass = computed(() => {
    if (this.variant() === 'danger') {
      return '!bg-gradient-to-r !from-danger !to-rose-600 !shadow-[0_8px_20px_-8px_rgba(239,68,68,0.55)]';
    }
    if (this.variant() === 'warning') {
      return '!bg-warning !shadow-[0_8px_20px_-8px_rgba(245,158,11,0.45)]';
    }
    return '';
  });

  constructor() {
    effect(
      () => {
        if (this.open() && this.requiresInput()) {
          this.inputText.set(this.inputDefault());
        }
        if (!this.open()) {
          this.inputText.set('');
        }
      },
      { allowSignalWrites: true }
    );
  }

  onBackdrop(): void {
    if (this.closeOnBackdrop()) this.onCancel();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onConfirm(): void {
    if (this.requiresInput()) {
      const value = this.inputText().trim();
      if (!value) return;
      this.confirmed.emit(value);
      return;
    }
    this.confirmed.emit();
  }
}
