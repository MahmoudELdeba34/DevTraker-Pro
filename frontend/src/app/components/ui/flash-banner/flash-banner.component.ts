import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export type FlashType = 'ok' | 'err';

@Component({
  selector: 'app-flash-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './flash-banner.component.html',
})
export class FlashBannerComponent {
  locale = inject(LocaleService);
  type = input<FlashType>('ok');
  message = input('');
  dismissible = input(false);

  dismissed = output<void>();
}
