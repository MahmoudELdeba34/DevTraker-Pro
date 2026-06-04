import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const userJson = localStorage.getItem('user');

  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      if (user && user.role === 'admin') {
        return true;
      }
    } catch {
      // Ignore JSON parsing errors
    }
  }

  return router.createUrlTree(['/dashboard']);
};
