import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-support',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.css'],
})
export class SupportComponent {
  private authSvc = inject(AuthService);

  userRole = () => this.authSvc.currentUser()?.role || 'employee';

  canAccessHrPortal = () => ['admin', 'hr', 'manager'].includes(this.userRole());
}
