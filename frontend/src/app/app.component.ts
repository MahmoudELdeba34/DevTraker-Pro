import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { ThemeService } from './core/theme/theme.service';
import { LocaleService } from './core/i18n/locale.service';
import { Subscription, interval, filter } from 'rxjs';
import { ToastContainerComponent } from './components/ui/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  template: `<app-toast-container /><router-outlet />`,
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private themeService = inject(ThemeService);
  private localeService = inject(LocaleService);

  private heartbeatSub?: Subscription;
  private routerSub?: Subscription;
  private currentUrl = '/';

  ngOnInit() {
    this.themeService.init();
    this.localeService.init();

    // Track active page route changes
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl = event.urlAfterRedirects;
        this.triggerHeartbeat(); // Update immediately on navigation
      });

    // Dispatch heartbeat pulse every 15 seconds
    this.heartbeatSub = interval(15000).subscribe(() => {
      this.triggerHeartbeat();
    });
  }

  ngOnDestroy() {
    this.heartbeatSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  private triggerHeartbeat() {
    if (this.authService.isLoggedIn()) {
      this.userService.sendHeartbeat(this.currentUrl).subscribe({
        error: (err) => console.error('Heartbeat pulse error:', err)
      });
    }
  }
}
