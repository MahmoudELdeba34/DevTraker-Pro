import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
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
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./components/shell/shell.component').then(
        (m) => m.ShellComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
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
        path: 'employee-home',
        loadComponent: () =>
          import('./pages/employee-home/employee-home.component').then(
            (m) => m.EmployeeHomeComponent
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
        path: 'reports',
        loadComponent: () =>
          import('./pages/reports/reports.component').then(
            (m) => m.ReportsComponent
          ),
      },
      {
        path: 'whiteboards',
        loadComponent: () =>
          import('./pages/whiteboard/whiteboard.component').then(
            (m) => m.WhiteboardComponent
          ),
      },
      {
        path: 'whiteboards/:id',
        loadComponent: () =>
          import('./pages/whiteboard/whiteboard.component').then(
            (m) => m.WhiteboardComponent
          ),
      },
    ]
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
