import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type FlashType = 'ok' | 'err';

@Component({
  selector: 'app-flash-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './flash-banner.component.html',
})
export class FlashBannerComponent {
  type = input<FlashType>('ok');
  message = input('');
  dismissible = input(false);

  dismissed = output<void>();
}
