import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { User } from '../../models/types';
import { Subscription, interval, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      <!-- Navbar / Header -->
      <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              Admin Control Center
            </span>
            <span class="text-xs px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-medium uppercase tracking-wider">
              System Admin
            </span>
          </h1>
          <p class="text-slate-400 text-sm mt-1">Manage system configurations, user privileges, and monitor live developer activity.</p>
        </div>
        <div class="flex items-center gap-3">
          <a routerLink="/dashboard" class="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg transition duration-200">
            Back to Dashboard
          </a>
          <a routerLink="/reports" class="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow-lg shadow-purple-900/30 transition duration-200">
            Reports & Timesheets
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
              Live Developers
            </h2>
            <span class="text-xs text-slate-400 font-mono">Heartbeat (15s)</span>
          </div>

          <!-- Active Users List -->
          <div class="flex-1 overflow-y-auto max-h-[480px] pr-2 flex flex-col gap-4">
            <div *ngIf="activeUsers().length === 0" class="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <p class="text-sm">No developers currently active.</p>
            </div>
            
            <div *ngFor="let user of activeUsers()" class="p-4 bg-slate-950/40 border border-slate-800 hover:border-slate-700/80 rounded-xl transition duration-200 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="font-medium text-slate-200 text-sm">{{ user.name }}</div>
                <span class="text-[10px] px-2 py-0.5 rounded font-medium uppercase" 
                      [ngClass]="{
                        'bg-red-500/10 text-red-400 border border-red-500/20': user.role === 'admin',
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20': user.role === 'manager',
                        'bg-slate-500/10 text-slate-400 border border-slate-700': user.role === 'employee'
                      }">
                  {{ user.role }}
                </span>
              </div>
              <div class="text-xs text-slate-400">
                Viewing: <code class="bg-slate-900 px-1.5 py-0.5 rounded text-pink-400 border border-slate-800/80 font-mono">{{ user.currentPage || '/' }}</code>
              </div>
              <div class="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>Active: {{ getDurationString(user.sessionStart) }}</span>
                <span>Pinged: {{ user.lastActiveAt | date:'h:mm:ss a' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- System User Management -->
        <div class="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 class="text-lg font-semibold text-white">System Users & Privileges</h2>
            <div class="relative w-full md:w-72">
              <input type="text" 
                     placeholder="Search users..." 
                     [(ngModel)]="searchQuery"
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
            </div>
          </div>

          <!-- Users Table -->
          <div class="overflow-x-auto rounded-xl border border-slate-800/80">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-medium">
                  <th class="p-4">Name</th>
                  <th class="p-4">Email</th>
                  <th class="p-4">Role</th>
                  <th class="p-4 text-center">Status</th>
                  <th class="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50 bg-slate-900/10">
                <tr *ngFor="let user of filteredUsers()" class="hover:bg-slate-800/20 transition duration-150">
                  <td class="p-4 font-medium text-slate-200">{{ user.name }}</td>
                  <td class="p-4 text-slate-400 font-mono">{{ user.email }}</td>
                  <td class="p-4">
                    <select (change)="onRoleChange(user._id, $any($event.target).value)"
                            [value]="user.role"
                            class="bg-slate-950 border border-slate-800/80 text-slate-300 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-purple-500/80 cursor-pointer">
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr">HR</option>
                      <option value="accountant">Accountant</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td class="p-4 text-center">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium"
                          [ngClass]="isOnline(user.lastActiveAt) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-800'">
                      <span class="w-1.5 h-1.5 rounded-full" [ngClass]="isOnline(user.lastActiveAt) ? 'bg-emerald-400' : 'bg-slate-600'"></span>
                      {{ isOnline(user.lastActiveAt) ? 'Online' : 'Offline' }}
                    </span>
                  </td>
                  <td class="p-4 text-right">
                    <a [routerLink]="['/reports']" [queryParams]="{ userId: user._id }" class="text-purple-400 hover:text-purple-300 font-medium">
                      View Timesheet
                    </a>
                  </td>
                </tr>
                <tr *ngIf="filteredUsers().length === 0">
                  <td colspan="5" class="text-center py-8 text-slate-500">No users match your query.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  
  users = signal<User[]>([]);
  activeUsers = signal<User[]>([]);
  searchQuery = '';
  
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
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      this.loadUsers();
      return;
    }

    this.userService.changeRole(userId, newRole as any).subscribe({
      next: (res) => {
        if (res.success) {
          // Update local status
          this.users.update(list => list.map(u => u._id === userId ? { ...u, role: newRole as any } : u));
        }
      },
      error: (err) => {
        alert('Failed to update user role.');
        this.loadUsers();
      }
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
