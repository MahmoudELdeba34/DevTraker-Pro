import { HttpContextToken } from '@angular/common/http';

/** Skip the global error toast (background polls, heartbeat, etc.). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
