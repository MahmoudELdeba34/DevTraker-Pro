import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { User } from '../../models/types';
import { Subscription, interval, startWith, switchMap } from 'rxjs';
import { ConfirmDialogComponent } from '../../components/ui/confirm-dialog/confirm-dialog.component';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface RoleChangeConfirm {
  userId: string;
  userName: string;
  newRole: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialogComponent, TranslatePipe],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans" [attr.data-locale]="locale.locale()">
      <!-- Navbar / Header -->
      <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              {{ 'adminDashboard.title' | translate }}
            </span>
            <span class="text-xs px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-medium uppercase tracking-wider">
              {{ 'adminDashboard.badge' | translate }}
            </span>
          </h1>
          <p class="text-slate-400 text-sm mt-1">{{ 'adminDashboard.subtitle' | translate }}</p>
        </div>
        <div class="flex items-center gap-3">
          <a routerLink="/dashboard" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            {{ 'common.backToDashboard' | translate }}
          </a>
          <a routerLink="/reports" class="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow-lg shadow-purple-900/30 transition duration-200">
            {{ 'common.reportsTimesheets' | translate }}
          </a>
        </div>
      </div>
    
      <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
    
        <!-- Live Developer Activity -->
        <div class="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white flex items-center gap-2">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {{ 'adminDashboard.liveDevelopers' | translate }}
            </h2>
            <span class="text-xs text-slate-400 font-mono">{{ 'adminDashboard.heartbeat' | translate }}</span>
          </div>
    
          <!-- Active Users List -->
          <div class="flex-1 overflow-y-auto max-h-[480px] pr-2 flex flex-col gap-4">
            @if (activeUsers().length === 0) {
              <div class="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <p class="text-sm">{{ 'adminDashboard.noActiveDevs' | translate }}</p>
              </div>
            }
    
            @for (user of activeUsers(); track user) {
              <div class="p-4 bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 rounded-xl transition duration-200 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <div class="font-medium text-slate-200 text-sm">{{ user.name }}</div>
                  <span class="text-[10px] px-2 py-0.5 rounded font-medium uppercase"
                      [ngClass]="{
                        'bg-red-500/10 text-red-400 border border-red-500/20': user.role === 'admin',
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20': user.role === 'manager',
                        'bg-slate-500/10 text-slate-400 border border-slate-700': user.role === 'employee'
                      }">
                    {{ locale.roleLabel(user.role) }}
                  </span>
                </div>
                <div class="text-xs text-slate-400">
                  {{ 'adminDashboard.viewingPage' | translate }} <code class="bg-slate-900 px-1.5 py-0.5 rounded text-pink-400 border border-slate-800/80 font-mono">{{ user.currentPage || '/' }}</code>
                </div>
                <div class="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                  <span>{{ locale.t('adminDashboard.activeDuration', { duration: getDurationString(user.sessionStart) }) }}</span>
                  <span>{{ locale.t('adminDashboard.pingedAt', { time: (user.lastActiveAt | date:'h:mm:ss a') || '' }) }}</span>
                </div>
              </div>
            }
          </div>
        </div>
    
        <!-- System User Management -->
        <div class="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 class="text-lg font-semibold text-white">{{ 'adminDashboard.systemUsers' | translate }}</h2>
            <div class="relative w-full md:w-72">
              <input type="text"
                [placeholder]="locale.t('common.searchUsers')"
                [(ngModel)]="searchQuery"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
            </div>
          </div>
    
          <!-- Users Table -->
          <div class="overflow-x-auto rounded-xl border border-slate-800/80">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                  <th class="p-4">{{ 'adminDashboard.table.name' | translate }}</th>
                  <th class="p-4">{{ 'adminDashboard.table.email' | translate }}</th>
                  <th class="p-4">{{ 'adminDashboard.table.role' | translate }}</th>
                  <th class="p-4 text-center">{{ 'adminDashboard.table.status' | translate }}</th>
                  <th class="p-4 text-right">{{ 'adminDashboard.table.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                @for (user of filteredUsers(); track user) {
                  <tr class="hover:bg-slate-800/20 transition duration-150">
                    <td class="p-4 font-medium text-slate-200">{{ user.name }}</td>
                    <td class="p-4 text-slate-400 font-mono">{{ user.email }}</td>
                    <td class="p-4">
                      <select (change)="onRoleChange(user._id, $any($event.target).value)"
                        [value]="user.role"
                        class="bg-slate-950 border border-slate-800/80 text-slate-300 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-purple-500/80 cursor-pointer">
                        <option value="employee">{{ locale.roleLabel('employee') }}</option>
                        <option value="manager">{{ locale.roleLabel('manager') }}</option>
                        <option value="hr">{{ locale.roleLabel('hr') }}</option>
                        <option value="accountant">{{ locale.roleLabel('accountant') }}</option>
                        <option value="admin">{{ locale.roleLabel('admin') }}</option>
                      </select>
                    </td>
                    <td class="p-4 text-center">
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium"
                        [ngClass]="isOnline(user.lastActiveAt) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-800'">
                        <span class="w-1.5 h-1.5 rounded-full" [ngClass]="isOnline(user.lastActiveAt) ? 'bg-emerald-400' : 'bg-slate-600'"></span>
                        {{ isOnline(user.lastActiveAt) ? ('adminDashboard.status.online' | translate) : ('adminDashboard.status.offline' | translate) }}
                      </span>
                    </td>
                    <td class="p-4 text-right">
                      <a [routerLink]="['/reports']" [queryParams]="{ userId: user._id }" class="text-purple-400 hover:text-purple-300 font-medium">
                        {{ 'adminDashboard.viewTimesheet' | translate }}
                      </a>
                    </td>
                  </tr>
                }
                @if (filteredUsers().length === 0) {
                  <tr>
                    <td colspan="5" class="text-center py-8 text-slate-500">{{ 'adminDashboard.noUsersMatch' | translate }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
    
      </div>
    </div>

    @if (roleChangeConfirm(); as req) {
      <app-confirm-dialog
        [open]="true"
        [title]="locale.t('adminDashboard.confirm.changeRole')"
        [message]="roleChangeMessage()"
        [confirmLabel]="locale.t('members.confirm.updateRole')"
        [cancelLabel]="locale.t('common.cancel')"
        variant="accent"
        (confirmed)="executeRoleChange()"
        (cancelled)="cancelRoleChange()"
      />
    }
    `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  locale = inject(LocaleService);
  
  users = signal<User[]>([]);
  activeUsers = signal<User[]>([]);
  searchQuery = '';
  roleChangeConfirm = signal<RoleChangeConfirm | null>(null);
  roleChangeError = signal('');
  
  private pollerSub?: Subscription;

  ngOnInit() {
    this.loadUsers();
    
    // Poll active sessions every 10 seconds
    this.pollerSub = interval(10000)
      .pipe(
        startWith(0),
        switchMap(() => this.userService.getActiveSessions())
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.activeUsers.set(res.data);
          }
        },
        error: (err) => console.error('Poll active sessions error:', err)
      });
  }

  ngOnDestroy() {
    this.pollerSub?.unsubscribe();
  }

  loadUsers() {
    this.userService.getAll().subscribe({
      next: (res) => {
        if (res.success) {
          this.users.set(res.data);
        }
      },
      error: (err) => console.error('Load users error:', err)
    });
  }

  filteredUsers() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) return this.users();
    return this.users().filter(u => 
      u.name.toLowerCase().includes(query) || 
      u.email.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    );
  }

  onRoleChange(userId: string, newRole: string) {
    const user = this.users().find((u) => u._id === userId);
    if (!user || user.role === newRole) return;
    this.roleChangeConfirm.set({ userId, userName: user.name, newRole });
  }

  cancelRoleChange() {
    this.roleChangeConfirm.set(null);
    this.loadUsers();
  }

  executeRoleChange() {
    const req = this.roleChangeConfirm();
    if (!req) return;
    this.roleChangeConfirm.set(null);

    this.userService.changeRole(req.userId, req.newRole as any).subscribe({
      next: (res) => {
        if (res.success) {
          this.users.update((list) =>
            list.map((u) =>
              u._id === req.userId ? { ...u, role: req.newRole as User['role'] } : u
            )
          );
        }
      },
      error: () => {
        this.roleChangeError.set(this.locale.t('adminDashboard.toast.roleChangeFailed'));
        this.loadUsers();
      },
    });
  }

  roleChangeMessage(): string {
    const req = this.roleChangeConfirm();
    if (!req) return '';
    return this.locale.t('adminDashboard.confirm.changeRoleMessage', {
      userName: req.userName,
      newRole: this.locale.roleLabel(req.newRole),
    });
  }

  isOnline(lastActiveAt: string | undefined): boolean {
    if (!lastActiveAt) return false;
    const activeTime = new Date(lastActiveAt).getTime();
    return Date.now() - activeTime < 45 * 1000;
  }

  getDurationString(sessionStart: string | undefined): string {
    if (!sessionStart) return '0m';
    const durationMs = Date.now() - new Date(sessionStart).getTime();
    const durationMins = Math.floor(durationMs / 60000);
    
    if (durationMins < 60) return `${durationMins}m`;
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    return `${hours}h ${mins}m`;
  }
}
