import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/ui/page-header/page-header.component';
import { AuthService } from '../../services/auth.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-support',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, PageHeaderComponent, TranslatePipe],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.css'],
})
export class SupportComponent {
  private authSvc = inject(AuthService);
  locale = inject(LocaleService);

  userRole = () => this.authSvc.currentUser()?.role || 'employee';

  canAccessHrPortal = () => ['admin', 'hr', 'manager'].includes(this.userRole());

  headerTips = computed(() => [
    {
      title: this.locale.t('support.card.requestCenter.title'),
      body: this.locale.t('support.tip.requestCenter'),
    },
    {
      title: this.locale.t('support.card.account.title'),
      body: this.locale.t('support.tip.account'),
    },
    {
      title: this.locale.t('common.admin'),
      body: this.locale.t('support.tip.workspaceAdmins'),
    },
  ]);
}
