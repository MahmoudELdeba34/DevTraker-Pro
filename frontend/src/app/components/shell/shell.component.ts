import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService, AppNotification } from '../../services/notification.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-bg-base text-white font-body overflow-hidden">
      <!-- DESKTOP SIDEBAR -->
      <aside class="hidden md:flex flex-col w-64 bg-bg-surface border-r border-border h-full flex-shrink-0 relative z-20 transition-all duration-300">
        <!-- Logo -->
        <div class="h-16 flex items-center px-6 border-b border-border">
          <div class="w-8 h-8 rounded bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-glow mr-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-white">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <span class="font-display font-bold text-lg tracking-tight">DevTracker</span>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          @for (item of navItems; track item.path) {
            <a [routerLink]="item.path" 
               routerLinkActive="bg-accent-subtle text-accent font-semibold"
               [routerLinkActiveOptions]="{exact: item.exact}"
               class="flex items-center gap-3 px-3 py-2.5 rounded-radius-md text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-sm font-medium">
              <span [innerHTML]="item.icon"></span>
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- User Profile (Bottom) -->
        <div class="p-4 border-t border-border mt-auto">
          <div class="flex items-center gap-3 cursor-pointer p-2 rounded-radius-md hover:bg-bg-hover transition-colors" (click)="toggleUserMenu()">
            <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-accent to-purple-600 flex items-center justify-center text-sm font-bold shadow-sm">
              {{ userInitial() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold truncate">{{ userName() }}</div>
              <div class="text-xs text-text-muted truncate capitalize">{{ userRole() }}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </div>
        
        <!-- User Menu Popup -->
        @if (showUserMenu()) {
          <div class="absolute bottom-20 left-4 right-4 bg-bg-elevated border border-border rounded-radius-md shadow-modal p-2 z-30 animate-scale-in">
            <button (click)="logout()" class="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger/10 rounded transition-colors flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        }
      </aside>

      <!-- MAIN CONTENT WRAPPER -->
      <div class="flex-1 flex flex-col min-w-0 h-full relative">
        <!-- TOPBAR -->
        <header class="h-16 flex items-center justify-between px-4 md:px-8 border-b border-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-10">
          
          <!-- Mobile Menu Button & Logo -->
          <div class="flex items-center gap-3 md:hidden">
            <button class="p-2 -ml-2 text-text-secondary hover:text-white" (click)="toggleMobileMenu()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div class="w-8 h-8 rounded bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-white">
                <path d="M9 11l3 3L22 4"/>
              </svg>
            </div>
          </div>

          <!-- Page Context / Title (Desktop only or optional) -->
          <div class="hidden md:flex items-center text-sm font-medium text-text-secondary">
            DevTracker <span class="mx-2">/</span> <span class="text-white">Workspace</span>
          </div>

          <!-- Right Actions -->
          <div class="flex items-center gap-4 ml-auto">
            <!-- Notifications -->
            <div class="relative">
              <button class="relative p-2 text-text-secondary hover:text-white transition-colors" (click)="toggleNotifications()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
                @if (unreadCount() > 0) {
                  <span class="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full border border-bg-base animate-pulse"></span>
                }
              </button>

              <!-- Notifications Dropdown -->
              @if (showNotifications()) {
                <div class="absolute right-0 mt-2 w-80 bg-bg-elevated border border-border rounded-radius-lg shadow-modal p-4 z-50 animate-scale-in">
                  <div class="flex items-center justify-between mb-4">
                    <h3 class="font-display font-semibold text-sm">Notifications</h3>
                    @if (unreadCount() > 0) {
                      <button (click)="markAllAsRead()" class="text-xs text-accent hover:text-accent-hover font-medium">Mark all read</button>
                    }
                  </div>
                  <div class="max-h-64 overflow-y-auto space-y-2">
                    @for (note of notifications(); track note._id) {
                      <div class="p-3 rounded-radius-md border border-border bg-bg-surface/50 hover:bg-bg-surface transition-colors relative" [class.border-l-2]="!note.read" [class.border-l-accent]="!note.read">
                        <div class="flex justify-between items-start mb-1">
                          <span class="text-xs font-semibold text-white">{{ note.title }}</span>
                          @if (!note.read) {
                            <button (click)="markAsRead(note._id)" class="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1"></button>
                          }
                        </div>
                        <p class="text-xs text-text-secondary line-clamp-2">{{ note.message }}</p>
                        <span class="text-[10px] text-text-muted mt-2 block font-mono">{{ note.createdAt | date:'shortTime' }}</span>
                      </div>
                    }
                    @if (notifications().length === 0) {
                      <div class="text-center py-6 text-text-muted text-sm">No new notifications</div>
                    }
                  </div>
                </div>
              }
            </div>
            
            <!-- Mobile User Avatar -->
            <div class="w-8 h-8 md:hidden rounded-full bg-gradient-to-tr from-accent to-purple-600 flex items-center justify-center text-xs font-bold" (click)="toggleUserMenu()">
              {{ userInitial() }}
            </div>
          </div>
        </header>

        <!-- ROUTER OUTLET (Scrollable area) -->
        <main class="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div class="max-w-7xl mx-auto h-full">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>

      <!-- MOBILE BOTTOM NAVIGATION -->
      <div class="md:hidden flex items-center justify-around bg-bg-surface border-t border-border h-16 fixed bottom-0 left-0 right-0 z-50 pb-safe">
        @for (item of mobileNavItems; track item.path) {
          <a [routerLink]="item.path" 
             routerLinkActive="text-accent"
             [routerLinkActiveOptions]="{exact: item.exact}"
             class="flex flex-col items-center justify-center w-full h-full text-text-muted hover:text-white transition-colors">
            <span [innerHTML]="item.icon" class="mb-1 transform scale-90"></span>
            <span class="text-[10px] font-medium">{{ item.label }}</span>
          </a>
        }
      </div>

      <!-- MOBILE SIDEBAR OVERLAY -->
      @if (showMobileMenu()) {
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in" (click)="toggleMobileMenu()"></div>
        <aside class="fixed inset-y-0 left-0 w-64 bg-bg-surface border-r border-border z-50 flex flex-col md:hidden transform transition-transform duration-300 animate-slide-right">
          <div class="h-16 flex items-center justify-between px-6 border-b border-border">
            <span class="font-display font-bold text-lg">DevTracker</span>
            <button class="p-2 -mr-2 text-text-secondary" (click)="toggleMobileMenu()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <nav class="flex-1 overflow-y-auto py-4 px-4 space-y-1">
            @for (item of navItems; track item.path) {
              <a [routerLink]="item.path" 
                 routerLinkActive="bg-accent-subtle text-accent font-semibold"
                 [routerLinkActiveOptions]="{exact: item.exact}"
                 (click)="toggleMobileMenu()"
                 class="flex items-center gap-3 px-3 py-3 rounded-radius-md text-text-secondary hover:text-white transition-colors text-sm font-medium">
                <span [innerHTML]="item.icon"></span>
                {{ item.label }}
              </a>
            }
          </nav>
        </aside>
      }
    </div>
  `
})
export class ShellComponent implements OnInit {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  router = inject(Router);

  showUserMenu = signal(false);
  showNotifications = signal(false);
  showMobileMenu = signal(false);
  
  notifications = signal<AppNotification[]>([]);
  unreadCount = signal(0);

  userName = () => this.authService.currentUser()?.name ?? '';
  userRole = () => this.authService.currentUser()?.role ?? 'employee';
  userInitial = () => (this.authService.currentUser()?.name ?? 'U')[0].toUpperCase();

  navItems = [
    { path: '/dashboard', label: 'Dashboard', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
    { path: '/employee-home', label: 'Terminal', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>' },
    { path: '/request-center', label: 'Requests', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
  ];

  mobileNavItems = [
    { path: '/dashboard', label: 'Home', exact: false, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
    { path: '/employee-home', label: 'Time', exact: false, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
    { path: '/request-center', label: 'Reqs', exact: false, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>' },
  ];

  ngOnInit() {
    this.setupNavItems();
    this.loadNotifications();
  }

  setupNavItems() {
    const role = this.authService.currentUser()?.role;
    if (['admin', 'hr', 'manager'].includes(role || '')) {
      this.navItems.push({ path: '/admin-hr-portal', label: 'HR Portal', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' });
      this.mobileNavItems.push({ path: '/admin-hr-portal', label: 'HR', exact: false, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' });
    }
    if (['admin', 'hr', 'accountant'].includes(role || '')) {
      this.navItems.push({ path: '/payroll-workspace', label: 'Payroll', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' });
    }
    if (role === 'admin') {
      this.navItems.push({ path: '/admin', label: 'Admin', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' });
    }
  }

  toggleUserMenu() {
    this.showUserMenu.update(v => !v);
    this.showNotifications.set(false);
  }

  toggleNotifications() {
    this.showNotifications.update(v => !v);
    this.showUserMenu.set(false);
    if (this.showNotifications()) {
      this.loadNotifications();
    }
  }

  toggleMobileMenu() {
    this.showMobileMenu.update(v => !v);
  }

  loadNotifications() {
    this.notificationService.getUnreadCount().subscribe({
      next: (res) => { if (res.success) this.unreadCount.set(res.data.count); }
    });
    this.notificationService.getNotifications().subscribe({
      next: (res) => { if (res.success) this.notifications.set(res.data); }
    });
  }

  markAsRead(id: string) {
    this.notificationService.markAsRead(id).subscribe({
      next: () => this.loadNotifications()
    });
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => this.loadNotifications()
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
