import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { faceEnrollGuard, faceEnrollPageGuard } from './guards/face-enroll.guard';
import { adminGuard } from './guards/admin.guard';
import { hrGuard } from './guards/hr.guard';
import { accountantGuard } from './guards/accountant.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'setup-account',
    loadComponent: () =>
      import('./pages/setup-account/setup-account.component').then(
        (m) => m.SetupAccountComponent
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'face-enroll',
    canActivate: [faceEnrollPageGuard],
    loadComponent: () =>
      import('./pages/face-enroll/face-enroll.component').then(
        (m) => m.FaceEnrollComponent
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./components/shell/shell.component').then(
        (m) => m.ShellComponent
      ),
    canActivate: [authGuard, faceEnrollGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./pages/account/account.component').then(
            (m) => m.AccountComponent
          ),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./pages/support/support.component').then(
            (m) => m.SupportComponent
          ),
      },
      {
        path: 'my-timesheet',
        loadComponent: () =>
          import('./pages/my-timesheet/my-timesheet.component').then(
            (m) => m.MyTimesheetComponent
          ),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./pages/project-detail/project-detail.component').then(
            (m) => m.ProjectDetailComponent
          ),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./pages/members/members.component').then(
            (m) => m.MembersComponent
          ),
      },
      {
        path: 'employee-home',
        loadComponent: () =>
          import('./pages/employee-home/employee-home.component').then(
            (m) => m.EmployeeHomeComponent
          ),
      },
      {
        path: 'attendance/punch',
        loadComponent: () =>
          import('./pages/attendance-punch/attendance-punch.component').then(
            (m) => m.AttendancePunchComponent
          ),
      },
      {
        path: 'request-center',
        loadComponent: () =>
          import('./pages/request-center/request-center.component').then(
            (m) => m.RequestCenterComponent
          ),
      },
      {
        path: 'admin-hr-portal',
        loadComponent: () =>
          import('./pages/admin-hr-portal/admin-hr-portal.component').then(
            (m) => m.AdminHrPortalComponent
          ),
        canActivate: [hrGuard],
      },
      {
        path: 'payroll-workspace',
        loadComponent: () =>
          import('./pages/payroll-workspace/payroll-workspace.component').then(
            (m) => m.PayrollWorkspaceComponent
          ),
        canActivate: [accountantGuard],
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./pages/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'team-activity',
        loadComponent: () =>
          import('./pages/team-activity/team-activity.component').then(
            (m) => m.TeamActivityComponent
          ),
        canActivate: [hrGuard],
      },
      {
        path: 'team/users/:id',
        loadComponent: () =>
          import('./pages/user-activity/user-activity.component').then(
            (m) => m.UserActivityComponent
          ),
        canActivate: [hrGuard],
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/reports/reports.component').then(
            (m) => m.ReportsComponent
          ),
      },
    ]
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
