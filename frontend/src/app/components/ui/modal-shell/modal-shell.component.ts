import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './modal-shell.component.html',
  styleUrls: ['./modal-shell.component.css'],
})
export class ModalShellComponent {
  locale = inject(LocaleService);
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
