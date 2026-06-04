import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const hrGuard: CanActivateFn = () => {
  const router = inject(Router);
  const userJson = localStorage.getItem('user');

  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      if (user && ['admin', 'hr', 'manager'].includes(user.role)) {
        return true;
      }
    } catch {
      // Ignore JSON parsing errors
    }
  }

  return router.createUrlTree(['/dashboard']);
};
