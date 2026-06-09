import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from './locale.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private locale = inject(LocaleService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.locale.t(key, params);
  }
}
