import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const hrGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn() && auth.hasRole('admin', 'hr', 'manager')) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
