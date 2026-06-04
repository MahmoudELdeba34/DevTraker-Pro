import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="bg-bg-elevated animate-shimmer rounded"
      [class]="customClass"
      [style.width]="width"
      [style.height]="height"
      [style.border-radius]="radius">
    </div>
  `
})
export class SkeletonComponent {
  @Input() width = '100%';
  @Input() height = '20px';
  @Input() radius = '6px';
  @Input() customClass = '';
}
