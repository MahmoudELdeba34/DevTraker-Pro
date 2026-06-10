import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Blocks app routes until employees/managers complete mandatory face enrollment. */
export const faceEnrollGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  if (auth.needsFaceEnrollment()) {
    return router.createUrlTree(['/face-enroll']);
  }

  return true;
};

/** Face enrollment page — only when enrollment is still required. */
export const faceEnrollPageGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  if (!auth.needsFaceEnrollment()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
