import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './modal-shell.component.html',
  styleUrls: ['./modal-shell.component.css'],
})
export class ModalShellComponent {
  open = input(false);
  title = input('');
  subtitle = input('');
  maxWidth = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  closeOnBackdrop = input(true);

  closed = output<void>();

  panelClass(): string {
    switch (this.maxWidth()) {
      case 'sm':
        return 'max-w-sm';
      case 'lg':
        return 'max-w-2xl';
      case 'xl':
        return 'max-w-4xl';
      default:
        return 'max-w-lg';
    }
  }

  onBackdrop(): void {
    if (this.closeOnBackdrop()) this.closed.emit();
  }
}
