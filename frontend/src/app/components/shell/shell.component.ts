import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';

import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService, AppNotification } from '../../services/notification.service';
import { WorkspaceService } from '../../services/workspace.service';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { Project, Workspace, Task, TimeEntry } from '../../models/types';
import { ActiveTimerService } from '../../services/active-timer.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { UiPreferencesComponent } from '../ui/ui-preferences/ui-preferences.component';
import { WorkspaceMembersComponent } from '../workspace-members/workspace-members.component';
import { UserAvatarComponent } from '../ui/user-avatar/user-avatar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    WorkspaceMembersComponent,
    UiPreferencesComponent,
    UserAvatarComponent,
  ],
  template: `
    <div class="app-shell flex h-screen bg-bg-base text-text-primary font-body overflow-hidden"
         [attr.dir]="locale.isRtl() ? 'rtl' : 'ltr'"
         [attr.data-locale]="locale.locale()">
      <!-- DESKTOP SIDEBAR (RTL: first flex item sits on the right) -->
      <aside class="app-sidebar hidden md:flex flex-col w-[260px] glass h-full flex-shrink-0 relative z-20 border-e border-border">
        <!-- Logo -->
        <div class="h-20 flex items-center px-6">
          <span class="font-display font-bold text-2xl tracking-tight text-white">
            Work<span class="text-accent">Track</span>
          </span>
        </div>

        <!-- Workspace Dropdown -->
        <div class="px-4 mb-6 relative">
          <div (click)="toggleWorkspaceMenu()" class="flex items-center justify-between p-2.5 rounded-xl bg-bg-elevated border border-border cursor-pointer hover:border-accent/50 transition-colors select-none">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded bg-accent text-white flex items-center justify-center font-bold text-xs uppercase">
                {{ activeWorkspaceInitials() }}
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-text-primary leading-tight truncate max-w-[120px]">{{ workspaceService.activeWorkspace()?.name || locale.t('shell.loading') }}</span>
                <span class="text-[10px] text-text-muted">{{ locale.t('shell.teamWorkspace') }}</span>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted transition-transform" [class.rotate-180]="showWorkspaceMenu()">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>

          <!-- Dropdown Menu -->
          @if (showWorkspaceMenu()) {
            <div class="absolute top-full left-4 right-4 mt-2 bg-bg-elevated border border-border rounded-xl shadow-modal z-50 py-2 animate-scale-in">
              <div class="px-3 pb-2 mb-2 border-b border-border">
                <span class="text-xs font-bold text-text-muted uppercase tracking-wider">{{ locale.t('shell.yourWorkspaces') }}</span>
              </div>
              <div class="max-h-48 overflow-y-auto hide-scrollbar">
                @for (ws of workspaceService.workspaces(); track ws._id) {
                  <button (click)="selectWorkspace(ws._id)" 
                          class="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-hover transition-colors text-start"
                          [class.bg-bg-hover]="ws._id === workspaceService.activeWorkspace()?._id">
                    <div class="w-6 h-6 rounded bg-accent/20 text-accent flex items-center justify-center font-bold text-[10px] uppercase">
                      {{ ws.name.substring(0,2) }}
                    </div>
                    <span class="text-sm text-white font-medium truncate flex-1">{{ ws.name }}</span>
                    @if (ws._id === workspaceService.activeWorkspace()?._id) {
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-accent">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    }
                  </button>
                }
              </div>
              <div class="px-2 pt-2 mt-2 border-t border-border space-y-1">
                @if (workspaceService.activeWorkspace()) {
                  <a routerLink="/members" (click)="showWorkspaceMenu.set(false)" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-bg-hover transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    {{ locale.t('shell.manageMembers') }}
                  </a>
                }
                <button (click)="openCreateWorkspace()" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-bg-hover transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {{ locale.t('shell.addWorkspace') }}
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Navigation -->
        <nav class="flex-1 overflow-y-auto px-4 space-y-1 pb-4 hide-scrollbar">
          @for (item of visibleNavItems(); track item.path) {
            @if (item.labelKey === 'nav.projects') {
              <div class="flex flex-col gap-1">
                <button (click)="projectsExpanded.set(!projectsExpanded())" 
                        class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-sm font-medium group"
                        [class.bg-bg-hover]="projectsExpanded() || isProjectsRouteActive()"
                        [class.text-white]="projectsExpanded() || isProjectsRouteActive()">
                  <div class="flex items-center gap-3">
                    <span [innerHTML]="item.icon" class="text-text-muted opacity-80 transition-colors"
                          [class.text-accent]="projectsExpanded() || isProjectsRouteActive()"></span>
                    {{ locale.t(item.labelKey) }}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted transition-transform" [class.rotate-180]="projectsExpanded()">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                @if (projectsExpanded() || isProjectsRouteActive()) {
                  <div class="flex flex-col ps-9 space-y-1 mt-1 animate-slide-down origin-top">
                    @for (project of projects(); track project._id) {
                      <a [routerLink]="['/projects', project._id]" 
                         routerLinkActive="bg-accent/10 text-accent font-medium border-s-2 border-s-accent"
                         class="flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-sm group">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-text-muted opacity-80 group-[.active]:text-accent">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <span class="truncate">{{ project.title }}</span>
                      </a>
                    }
                    @if (projects().length === 0 && !loadingProjects()) {
                      <div class="px-3 py-2 text-[11px] text-text-muted italic">{{ locale.t('shell.noProjects') }}</div>
                    }
                    <button class="flex items-center gap-3 px-3 py-2 rounded-lg text-text-muted hover:text-accent transition-colors text-xs font-semibold group mt-1" [routerLink]="['/dashboard']" [queryParams]="{create: 'true'}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      {{ locale.t('shell.newProject') }}
                    </button>
                  </div>
                }
              </div>
            } @else {
              <a [routerLink]="item.path" 
                 routerLinkActive="bg-accent/10 text-accent font-semibold"
                 [routerLinkActiveOptions]="{exact: item.exact}"
                 class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-sm font-medium group">
                <span [innerHTML]="item.icon" class="text-text-muted group-[.active]:text-accent opacity-80"></span>
                {{ locale.t(item.labelKey) }}
              </a>
            }
          }
        </nav>

        <!-- Bottom Actions (Settings, Support) -->
        <div class="p-4 space-y-1 mt-auto">
          <a routerLink="/account" routerLinkActive="bg-bg-hover text-white" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
            </svg>
            {{ locale.t('nav.settings') }}
          </a>
          <a routerLink="/support" routerLinkActive="bg-bg-hover text-white" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:text-white hover:bg-bg-hover transition-colors text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            {{ locale.t('nav.support') }}
          </a>
        </div>
      </aside>

      <!-- MAIN CONTENT WRAPPER -->
      <div class="app-main flex-1 flex flex-col min-w-0 h-full relative bg-bg-surface overflow-hidden rounded-ss-2xl border-t border-border">
        <!-- TOPBAR -->
        <header class="app-header h-16 md:h-20 flex items-center justify-between px-3 sm:px-4 md:px-8 z-10 gap-2">
          
          <!-- Global Search -->
          <div class="w-full max-w-md hidden md:block">
            <div class="relative">
              <div class="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-text-muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input type="text" [placeholder]="locale.t('shell.globalSearch')" class="w-full bg-bg-elevated border border-border rounded-lg ps-9 pe-4 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors">
            </div>
          </div>

          <!-- Mobile Menu Button & Logo -->
          <div class="flex items-center gap-2 md:hidden shrink-0 min-w-0">
            <button type="button" class="p-2 -ms-1 text-text-secondary hover:text-white shrink-0" (click)="toggleMobileMenu()" aria-label="Menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span class="font-display font-bold text-base sm:text-lg text-white truncate max-w-[5.5rem] min-[400px]:max-w-none">Work<span class="text-accent">Track</span></span>
          </div>

          <!-- Right Actions -->
          <div class="header-actions flex items-center gap-1 sm:gap-2 md:gap-3 ms-auto min-w-0 shrink">
            <div class="hidden md:block shrink-0">
              <app-ui-preferences />
            </div>

            <!-- Record Button (Global Timer) -->
            @if (anyTimerRunning()) {
              <div class="relative shrink-0 flex items-center gap-1">
                <button type="button"
                        class="header-timer-pill flex items-center gap-1.5 md:gap-3 px-2 md:px-3 py-1.5 bg-bg-elevated border border-accent/40 rounded-full hover:bg-bg-hover transition-colors shadow-glow-soft"
                        [title]="runningLabel()"
                        (click)="toggleTaskSelector()">
                  <span class="w-1.5 h-1.5 rounded-full bg-danger animate-pulse shrink-0"></span>
                  <span class="text-[11px] md:text-xs font-bold font-mono tracking-wider text-accent tabular-nums shrink-0">{{ globalDisplayTime() }}</span>
                  <span class="text-[10px] font-semibold text-text-secondary truncate max-w-[5rem] sm:max-w-[8rem] md:max-w-[140px] hidden md:inline">{{ runningLabel() }}</span>
                  <span class="hidden md:flex w-6 h-6 rounded bg-danger text-white items-center justify-center hover:bg-danger/80 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.2)] shrink-0"
                        (click)="stopAny(); $event.stopPropagation()">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/></svg>
                  </span>
                </button>
                <button type="button"
                        class="md:hidden w-7 h-7 rounded-lg bg-danger text-white flex items-center justify-center hover:bg-danger/80 transition-colors shrink-0"
                        [attr.aria-label]="locale.t('shell.stop')"
                        (click)="stopAny()">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/></svg>
                </button>

                <!-- Time Tracking Popover (Active) -->
                @if (showTaskSelector()) {
                  <div class="absolute top-full end-0 mt-3 md:mt-4 w-[min(340px,calc(100vw-1.5rem))] max-md:fixed max-md:end-3 max-md:start-3 max-md:top-[4.25rem] max-md:w-auto bg-bg-elevated border border-border rounded-xl shadow-modal p-4 z-50 animate-scale-in max-h-[min(70vh,32rem)] overflow-y-auto hide-scrollbar">
                    <div class="flex items-center justify-between mb-4">
                      <h3 class="text-sm font-bold text-white tracking-tight">{{ locale.t('shell.timeTracking') }}</h3>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-danger/20 text-danger border border-danger/30 uppercase tracking-widest animate-pulse-glow">{{ locale.t('shell.live') }}</span>
                    </div>

                    <!-- Daily Goal -->
                    <div class="bg-bg-base border border-border rounded-lg p-4 mb-4">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">{{ locale.t('shell.dailyGoal') }}</span>
                        <span class="text-xs font-bold font-mono text-white">{{ dailyDisplay() }}</span>
                      </div>
                      <div class="h-1.5 bg-bg-elevated rounded-full overflow-hidden w-full">
                        <div class="h-full bg-accent transition-all duration-500" [style.width]="dailyPercent()"></div>
                      </div>
                    </div>

                    <!-- Running entry card -->
                    <div class="bg-bg-base border border-danger/30 rounded-lg p-4 mb-4 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                      <div class="flex items-center gap-2 mb-1">
                        @if (activeTimerService.activeTask()) {
                          <span class="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-accent-subtle text-accent border border-accent/30">{{ locale.t('shell.chip.task') }}</span>
                        } @else {
                          <span class="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-info/15 text-info border border-info/30">{{ locale.t('shell.quickSession') }}</span>
                        }
                      </div>
                      <div class="flex flex-col gap-1 mb-4">
                        <span class="text-sm font-bold text-white truncate">{{ runningLabel() }}</span>
                        <span class="text-2xl font-mono font-bold text-danger tracking-wider">{{ globalDisplayTime() }}</span>
                      </div>
                      <button class="w-full py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2" (click)="stopAny()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/></svg>
                        {{ locale.t('shell.stop') }}
                      </button>
                    </div>

                    <!-- Recent Tasks -->
                    <div class="mb-2 flex items-center justify-between">
                      <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">{{ locale.t('shell.recent') }}</span>
                      <span class="text-[10px] text-text-muted">{{ locale.t('shell.tapToSwitch') }}</span>
                    </div>
                    <div class="max-h-44 overflow-y-auto flex flex-col gap-1 pb-2 hide-scrollbar">
                      @if (loadingRecent()) {
                        <div class="h-8 rounded-md bg-bg-base/60 animate-pulse"></div>
                        <div class="h-8 rounded-md bg-bg-base/60 animate-pulse"></div>
                      } @else if (recentTasks().length === 0) {
                        <p class="text-xs text-text-muted text-center py-4">{{ locale.t('shell.noRecentTasks') }}</p>
                      } @else {
                        @for (t of recentTasks(); track t._id) {
                          <button
                            type="button"
                            (click)="startTimerForRecent(t)"
                            [disabled]="startingTaskId() === t._id || (activeTimerService.activeTask()?._id === t._id)"
                            class="group flex items-center gap-2 px-2 py-1.5 rounded-md bg-bg-base/50 border border-border/40 hover:border-accent/40 hover:bg-accent/5 transition-all text-start disabled:opacity-60"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-accent shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <div class="flex-1 min-w-0">
                              <div class="text-xs font-medium text-white truncate group-hover:text-accent transition-colors">{{ t.title }}</div>
                              @if (taskProjectTitle(t); as pt) {
                                <div class="text-[10px] text-text-muted truncate">{{ pt }}</div>
                              }
                            </div>
                            @if (startingTaskId() === t._id) {
                              <svg class="animate-spin h-3 w-3 text-accent shrink-0" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            }
                          </button>
                        }
                      }
                    </div>

                    <div class="mt-3 pt-3 border-t border-border text-center">
                      <a routerLink="/my-timesheet" class="text-xs font-semibold text-text-secondary hover:text-white transition-colors" (click)="toggleTaskSelector()">{{ locale.t('shell.viewTimesheet') }}</a>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="relative shrink-0">
                <button type="button"
                        class="flex items-center justify-center gap-2 w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-1.5 bg-bg-elevated border border-border rounded-full md:rounded-full hover:bg-accent/20 hover:border-accent/50 hover:text-accent transition-colors text-text-muted group"
                        (click)="toggleTaskSelector()" [title]="locale.t('shell.startTimer')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="shrink-0"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <span class="text-xs font-semibold hidden md:inline-block">{{ locale.t('shell.startTimer') }}</span>
                </button>

                <!-- Task Selector Dropdown (When not tracking) -->
                @if (showTaskSelector()) {
                  <div class="absolute top-full end-0 mt-3 md:mt-4 w-[min(340px,calc(100vw-1.5rem))] max-md:fixed max-md:end-3 max-md:start-3 max-md:top-[4.25rem] max-md:w-auto bg-bg-elevated border border-border rounded-xl shadow-modal p-4 z-50 animate-scale-in max-h-[min(75vh,36rem)] overflow-y-auto hide-scrollbar">
                    <!-- Header (changes based on drill-in state) -->
                    <div class="flex items-center justify-between mb-4">
                      @if (popoverProject(); as pp) {
                        <div class="flex items-center gap-2 min-w-0">
                          <button (click)="backToProjects()" class="p-1 -ms-1 rounded text-text-muted hover:text-white hover:bg-bg-hover transition-colors shrink-0" [title]="locale.t('shell.title.back')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                          </button>
                          <div class="min-w-0">
                            <div class="text-[10px] uppercase tracking-widest text-accent font-bold">{{ locale.t('shell.tasks') }}</div>
                            <h3 class="text-sm font-bold text-white tracking-tight truncate">{{ pp.title }}</h3>
                          </div>
                        </div>
                      } @else {
                        <h3 class="text-sm font-bold text-white tracking-tight">{{ locale.t('shell.timeTracking') }}</h3>
                      }
                    </div>

                    <!-- Daily Goal -->
                    <div class="bg-bg-base border border-border rounded-lg p-4 mb-4">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">{{ locale.t('shell.dailyGoal') }}</span>
                        <span class="text-xs font-bold font-mono text-white">{{ dailyDisplay() }}</span>
                      </div>
                      <div class="h-1.5 bg-bg-elevated rounded-full overflow-hidden w-full">
                        <div class="h-full bg-accent transition-all duration-500" [style.width]="dailyPercent()"></div>
                      </div>
                    </div>

                    @if (!popoverProject()) {
                      <!-- ROOT VIEW: Quick Session + Recent + Projects -->

                      <!-- ClickUp-style Quick Session: free-form description timer -->
                      <div class="mb-4">
                        <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">{{ locale.t('shell.whatWorkingOn') }}</span>
                        <div class="flex gap-2">
                          <input
                            type="text"
                            [value]="quickDescription()"
                            (input)="quickDescription.set($any($event.target).value)"
                            (keydown.enter)="startQuickSession()"
                            [placeholder]="locale.t('shell.whatWorkingOnPlaceholder')"
                            maxlength="200"
                            class="flex-1 min-w-0 bg-bg-base border border-border text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-text-muted/60"
                          />
                          <button
                            (click)="startQuickSession()"
                            [disabled]="startingQuickSession()"
                            class="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold tracking-wide transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-glow-soft"
                            [title]="locale.t('shell.title.startTracking')"
                          >
                            @if (startingQuickSession()) {
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="animate-spin-slow"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>
                            } @else {
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            }
                            {{ locale.t('shell.start') }}
                          </button>
                        </div>
                        <p class="text-[10px] text-text-muted mt-1.5">
                          {{ locale.t('shell.skipTaskPicker') }}
                        </p>
                      </div>

                      <div class="border-t border-border/70 -mx-4 mb-3"></div>

                      <!-- Recent Tasks (quick re-start) -->
                      @if (loadingRecent() || recentTasks().length > 0) {
                        <div class="mb-2">
                          <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">{{ locale.t('shell.recentTasks') }}</span>
                        </div>
                        <div class="max-h-32 overflow-y-auto flex flex-col gap-1 pb-3 hide-scrollbar">
                          @if (loadingRecent()) {
                            <div class="h-9 rounded-md bg-bg-base/60 animate-pulse"></div>
                            <div class="h-9 rounded-md bg-bg-base/60 animate-pulse"></div>
                          } @else {
                            @for (t of recentTasks(); track t._id) {
                              <button
                                (click)="startTimerForRecent(t)"
                                [disabled]="startingTaskId() === t._id"
                                class="group flex items-center gap-2 px-2 py-2 rounded-md bg-bg-base/60 border border-border/40 hover:border-accent/40 hover:bg-accent/5 transition-all text-start disabled:opacity-60"
                              >
                                <span class="w-6 h-6 rounded bg-accent/15 text-accent flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-white transition-colors">
                                  @if (startingTaskId() === t._id) {
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="animate-spin-slow"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>
                                  } @else {
                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                  }
                                </span>
                                <div class="flex-1 min-w-0">
                                  <div class="text-xs font-medium text-white truncate">{{ t.title }}</div>
                                  @if (taskProjectTitle(t); as pt) {
                                    <div class="text-[10px] text-text-muted truncate">{{ pt }}</div>
                                  }
                                </div>
                              </button>
                            }
                          }
                        </div>
                      }

                      <div class="mb-2">
                        <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">{{ locale.t('shell.pickProject') }}</span>
                      </div>
                      <div class="max-h-44 overflow-y-auto flex flex-col gap-1 pb-2 hide-scrollbar">
                        @for (project of projects(); track project._id) {
                          <button class="text-start text-xs px-3 py-2 hover:bg-bg-hover rounded-lg text-text-secondary hover:text-white transition-colors flex items-center gap-2 group" (click)="openPopoverProject(project)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted group-hover:text-accent"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                            <span class="truncate flex-1">{{ project.title }}</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        }
                        @if (!projects().length) {
                          <div class="text-xs text-text-muted p-3 text-center">
                            {{ locale.t('shell.noProjectsInWorkspace') }}
                            <a routerLink="/dashboard" [queryParams]="{create: 'true'}" class="block mt-1 text-accent hover:underline" (click)="toggleTaskSelector()">{{ locale.t('shell.createOne') }}</a>
                          </div>
                        }
                      </div>
                    } @else {
                      <!-- TASKS VIEW for the selected project -->
                      <div class="max-h-56 overflow-y-auto flex flex-col gap-1 pb-2 hide-scrollbar">
                        @if (popoverLoadingTasks()) {
                          <div class="h-10 rounded-md bg-bg-base/60 animate-pulse"></div>
                          <div class="h-10 rounded-md bg-bg-base/60 animate-pulse"></div>
                          <div class="h-10 rounded-md bg-bg-base/60 animate-pulse"></div>
                        } @else if (popoverTasks().length === 0) {
                          <div class="text-xs text-text-muted p-4 text-center">
                            {{ locale.t('shell.noTasksInProject') }}
                            <a [routerLink]="['/projects', popoverProject()!._id]" class="block mt-1 text-accent hover:underline" (click)="toggleTaskSelector()">{{ locale.t('shell.openProject') }}</a>
                          </div>
                        } @else {
                          @for (t of popoverTasks(); track t._id) {
                            <button
                              (click)="startTimerForTask(t)"
                              [disabled]="startingTaskId() === t._id"
                              class="group flex items-center gap-2 px-2 py-2 rounded-md bg-bg-base/40 hover:bg-accent/10 border border-transparent hover:border-accent/30 transition-all text-start disabled:opacity-60"
                            >
                              <span class="w-7 h-7 rounded-md bg-accent/15 text-accent flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-white transition-colors">
                                @if (startingTaskId() === t._id) {
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="animate-spin-slow"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>
                                } @else {
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                }
                              </span>
                              <div class="flex-1 min-w-0">
                                <div class="text-xs font-semibold text-white truncate">{{ t.title }}</div>
                                <div class="flex items-center gap-1 mt-0.5">
                                  <span class="text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded"
                                        [class.bg-success]="t.status === 'completed'"
                                        [class.bg-accent]="t.status === 'in_progress'"
                                        [class.bg-warning]="t.status === 'in_review'"
                                        [class.bg-text-muted]="t.status === 'not_started'"
                                        [class.text-white]="true">
                                    {{ locale.statusLabel(t.status) }}
                                  </span>
                                  <span class="text-[9px] text-text-muted ms-1 uppercase tracking-wider">{{ locale.priorityLabel(t.priority) }}</span>
                                </div>
                              </div>
                            </button>
                          }
                        }
                      </div>
                    }

                    <div class="mt-3 pt-3 border-t border-border text-center">
                      <a routerLink="/my-timesheet" class="text-xs font-semibold text-text-secondary hover:text-white transition-colors" (click)="toggleTaskSelector()">{{ locale.t('shell.viewTimesheet') }}</a>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Notifications (desktop) -->
            <div class="relative hidden md:block shrink-0">
              <button type="button" class="text-text-muted hover:text-white transition-colors relative" (click)="toggleNotifications()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
                @if (unreadCount() > 0) {
                  <span class="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full"></span>
                }
              </button>
              
              <!-- Notifications Dropdown -->
              @if (showNotifications()) {
                <div class="absolute end-0 mt-4 w-80 bg-bg-elevated border border-border rounded-xl shadow-modal p-4 z-50 animate-scale-in">
                  <div class="flex items-center justify-between mb-4">
                    <h3 class="font-display font-semibold text-sm">{{ locale.t('shell.notifications') }}</h3>
                    @if (unreadCount() > 0) {
                      <button (click)="markAllAsRead()" class="text-xs text-accent hover:text-accent-hover font-medium">{{ locale.t('shell.markAllRead') }}</button>
                    }
                  </div>
                  <div class="max-h-64 overflow-y-auto space-y-2 hide-scrollbar">
                    @for (note of notifications(); track note._id) {
                      <div class="p-3 rounded-lg border border-border bg-bg-base hover:bg-bg-hover transition-colors relative" [class.border-s-2]="!note.read" [class.border-s-accent]="!note.read">
                        <div class="flex justify-between items-start mb-1">
                          <span class="text-xs font-semibold text-white">{{ note.title }}</span>
                          @if (!note.read) {
                            <button (click)="markAsRead(note._id)" class="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1"></button>
                          }
                        </div>
                        <p class="text-[11px] text-text-secondary line-clamp-2">{{ note.message }}</p>
                      </div>
                    }
                    @if (notifications().length === 0) {
                      <div class="text-center py-6 text-text-muted text-sm">{{ locale.t('shell.noNotifications') }}</div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Help Icon (desktop) -->
            <a routerLink="/support" class="hidden md:inline-flex text-text-muted hover:text-white transition-colors shrink-0" [title]="locale.t('shell.title.support')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </a>

            <a routerLink="/account" class="hidden md:inline-flex text-text-muted hover:text-white transition-colors shrink-0" [title]="locale.t('shell.title.settings')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
              </svg>
            </a>

            <!-- User Avatar & Dropdown -->
            <div class="relative shrink-0">
              <button type="button" class="cursor-pointer hover:opacity-90 transition-opacity" (click)="toggleUserMenu()">
                <app-user-avatar
                  [name]="userName()"
                  [avatarUrl]="userAvatarUrl()"
                  size="xs"
                />
              </button>
              
              @if (showUserMenu()) {
                <div class="absolute end-0 mt-4 w-48 bg-bg-elevated border border-border rounded-xl shadow-modal p-2 z-50 animate-scale-in">
                  <div class="px-3 py-2 border-b border-border mb-2">
                    <p class="text-sm font-semibold text-white truncate">{{ userName() }}</p>
                    <p class="text-xs text-text-muted truncate capitalize">{{ userRole() }}</p>
                  </div>
                  <a routerLink="/account" class="w-full text-start px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-2" (click)="toggleUserMenu()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    {{ locale.t('shell.profile') }}
                  </a>
                  <a routerLink="/support" class="w-full text-start px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-bg-hover rounded-lg transition-colors flex items-center gap-2" (click)="toggleUserMenu()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    {{ locale.t('nav.support') }}
                  </a>
                  <button (click)="logout()" class="w-full text-start px-3 py-2 mt-1 text-sm text-danger hover:bg-danger/10 rounded-lg transition-colors flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    {{ locale.t('shell.logout') }}
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <!-- ROUTER OUTLET -->
        <main class="flex-1 overflow-y-auto p-4 md:p-8 pb-[5.5rem] md:pb-8 relative hide-scrollbar">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- MOBILE BOTTOM NAVIGATION -->
      <nav class="mobile-bottom-nav md:hidden" aria-label="Mobile navigation">
        @for (item of primaryMobileNavItems(); track item.path) {
          <a [routerLink]="item.path"
             routerLinkActive="mobile-nav-btn--active"
             [routerLinkActiveOptions]="{exact: item.exact}"
             class="mobile-nav-btn">
            <span [innerHTML]="item.icon" class="mobile-nav-icon" aria-hidden="true"></span>
            <span class="mobile-nav-label">{{ locale.t(item.labelKey) }}</span>
          </a>
        }
        <button type="button"
                class="mobile-nav-btn"
                [class.mobile-nav-btn--active]="showMobileMenu()"
                (click)="toggleMobileMenu()"
                [attr.aria-label]="locale.t('nav.more')"
                [attr.aria-expanded]="showMobileMenu()">
          <svg class="mobile-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
          <span class="mobile-nav-label">{{ locale.t('nav.more') }}</span>
        </button>
      </nav>

      <!-- MOBILE SIDEBAR OVERLAY -->
      @if (showMobileMenu()) {
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in" (click)="toggleMobileMenu()"></div>
        <aside class="fixed inset-y-0 start-0 w-64 glass z-50 flex flex-col md:hidden transform transition-transform duration-300 mobile-drawer-in">
          <div class="h-20 flex items-center justify-between px-6 border-b border-border">
            <span class="font-display font-bold text-xl">Work<span class="text-accent">Track</span></span>
            <button class="p-2 -me-2 text-text-secondary" (click)="toggleMobileMenu()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <nav class="flex-1 overflow-y-auto py-4 px-4 space-y-1 hide-scrollbar">
            @for (item of visibleNavItems(); track item.path) {
              <a [routerLink]="item.path" 
                 routerLinkActive="bg-accent/10 text-accent font-semibold"
                 [routerLinkActiveOptions]="{exact: item.exact}"
                 (click)="toggleMobileMenu()"
                 class="flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:text-white transition-colors text-sm font-medium group">
                <span [innerHTML]="item.icon" class="text-text-muted group-[.active]:text-accent"></span>
                {{ locale.t(item.labelKey) }}
              </a>
            }
          </nav>
          <div class="px-4 py-4 border-t border-border flex items-center justify-between gap-3">
            <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">{{ locale.t('prefs.language') }}</span>
            <app-ui-preferences [compact]="true" />
          </div>
        </aside>
      }

      <!-- MANAGE WORKSPACE MEMBERS -->
      @if (membersDialogWs(); as ws) {
        <app-workspace-members
          [workspace]="ws"
          (closed)="closeManageMembers()"
        ></app-workspace-members>
      }

      <!-- CREATE WORKSPACE MODAL -->
      @if (showCreateWorkspace()) {
        <div class="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div class="modal w-full max-w-md animate-modal">
            <div class="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 class="text-lg font-bold text-white tracking-tight">{{ locale.t('shell.newWorkspace') }}</h2>
              <button class="text-text-muted hover:text-white transition-colors" (click)="closeCreateWorkspace()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form [formGroup]="workspaceForm" (ngSubmit)="submitWorkspace()" class="p-6 flex flex-col gap-5">
              <div class="flex flex-col gap-2">
                <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ locale.t('shell.workspaceName') }} <span class="text-danger">{{ locale.t('common.required') }}</span></label>
                <input type="text" formControlName="name" [placeholder]="locale.t('shell.workspaceNamePlaceholder')" class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{{ locale.t('shell.workspaceDescription') }}</label>
                <textarea formControlName="description" rows="2" [placeholder]="locale.t('shell.workspaceOptional')" class="w-full bg-bg-base border border-border text-white text-sm rounded-lg px-4 py-2.5 outline-none transition-all focus:border-accent focus:shadow-glow placeholder:text-text-muted/50 resize-none"></textarea>
              </div>
              <div class="flex items-center justify-end gap-3 mt-2">
                <button type="button" class="px-4 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:text-white hover:bg-bg-hover transition-colors" (click)="closeCreateWorkspace()">{{ locale.t('shell.cancel') }}</button>
                <button type="submit" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-accent-hover transition-colors shadow-glow-soft" [disabled]="creatingWs() || workspaceForm.invalid">
                  {{ creatingWs() ? locale.t('shell.creatingWorkspace') : locale.t('shell.createWorkspace') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class ShellComponent implements OnInit {
  locale = inject(LocaleService);
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  workspaceService = inject(WorkspaceService);
  projectService = inject(ProjectService);
  taskService = inject(TaskService);
  timeEntryService = inject(TimeEntryService);
  activeTimerService = inject(ActiveTimerService);
  private toast = inject(ToastService);
  fb = inject(FormBuilder);
  router = inject(Router);

  showUserMenu = signal(false);
  showNotifications = signal(false);
  showMobileMenu = signal(false);
  showWorkspaceMenu = signal(false);
  showTaskSelector = signal(false);

  projectsExpanded = signal(false);
  projects = signal<Project[]>([]);
  loadingProjects = signal(false);

  globalDisplayTime = signal('0:00:00');
  private timerInterval?: ReturnType<typeof setInterval>;

  // ─── Task-picker popover state ───────────────────────────────────────────
  // When `popoverProject` is set, we show that project's tasks instead of the
  // project list — letting the user start a timer without leaving the topbar.
  popoverProject = signal<Project | null>(null);
  popoverTasks = signal<Task[]>([]);
  popoverLoadingTasks = signal(false);
  recentTasks = signal<Task[]>([]);
  loadingRecent = signal(false);
  startingTaskId = signal<string | null>(null);
  dailyTrackedMs = signal(0);
  private readonly dailyGoalMs = 7 * 60 * 60 * 1000;

  // ── Quick Session (ClickUp-style) ─────────────────────────────────────
  // A free-form description timer that doesn't need a task selection.
  quickDescription = signal('');
  startingQuickSession = signal(false);

  /** Unified view: an entry is running if EITHER a task timer or a quick
   *  session is active. Topbar UI keys off this. */
  anyTimerRunning = computed(
    () => !!this.activeTimerService.activeTask() || !!this.timeEntryService.active()
  );

  /** What to label the topbar pill / popover header with. */
  runningLabel = computed(() => {
    const task = this.activeTimerService.activeTask();
    if (task) return task.title;
    const entry = this.timeEntryService.active();
    if (entry) return entry.description?.trim() || this.locale.t('shell.quickSession');
    return '';
  });

  dailyDisplay = computed(() => this.formatMs(this.dailyTrackedMs()));
  dailyPercent = computed(() => {
    const pct = Math.min(100, (this.dailyTrackedMs() / this.dailyGoalMs) * 100);
    return `${pct}%`;
  });

  constructor() {
    effect(() => {
      const ws = this.workspaceService.activeWorkspace();
      if (ws) {
        this.loadProjects();
      } else {
        this.projects.set([]);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const task = this.activeTimerService.activeTask();
      const entry = this.timeEntryService.active();
      if (task) {
        this.startGlobalTickForTask(task);
      } else if (entry) {
        this.startGlobalTickForEntry(entry);
      } else {
        this.stopGlobalTick();
      }
    }, { allowSignalWrites: true });

    this.projectService.projectChanged.subscribe(() => {
      if (this.workspaceService.activeWorkspace()) {
        this.loadProjects();
      }
    });
  }
  
  showCreateWorkspace = signal(false);
  creatingWs = signal(false);
  createError = signal('');

  // Members dialog state — opens with the workspace it should manage
  membersDialogWs = signal<Workspace | null>(null);
  
  notifications = signal<AppNotification[]>([]);
  unreadCount = signal(0);

  workspaceForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: ['']
  });

  userName = () => this.authService.currentUser()?.name ?? 'Alex Rivera';
  userRole = () => this.authService.currentUser()?.role ?? 'Senior Product Designer';
  userAvatarUrl = () => this.authService.currentUser()?.avatarUrl;

  activeWorkspaceInitials = computed(() => {
    const ws = this.workspaceService.activeWorkspace();
    if (!ws || !ws.name) return 'WS';
    return ws.name.substring(0, 2);
  });

  navItems: Array<{ path: string; labelKey: string; exact: boolean; icon: string; roles?: string[] }> = [
    { path: '/dashboard', labelKey: 'nav.dashboard', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
    { path: '/projects', labelKey: 'nav.projects', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' },
    { path: '/members', labelKey: 'nav.members', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' },
    { path: '/employee-home', labelKey: 'nav.workday', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
    { path: '/attendance/punch', labelKey: 'nav.clockTerminal', exact: true, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' },
    { path: '/my-timesheet', labelKey: 'nav.timesheet', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' },
    { path: '/request-center', labelKey: 'nav.requests', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>' },
    { path: '/admin-hr-portal', labelKey: 'nav.hrPortal', exact: false, roles: ['admin', 'manager', 'hr'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' },
    { path: '/team-activity', labelKey: 'nav.teamActivity', exact: false, roles: ['admin', 'manager', 'hr'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' },
    { path: '/payroll-workspace', labelKey: 'nav.payroll', exact: false, roles: ['admin', 'hr', 'accountant'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' },
    { path: '/reports', labelKey: 'nav.reports', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>' },
    { path: '/account', labelKey: 'nav.account', exact: false, icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
  ];

  /** Nav items the current user is allowed to see. Items without a `roles`
   *  array are visible to everyone; with `roles`, the current role must match. */
  visibleNavItems = computed(() => {
    const role = this.authService.currentUser()?.role || '';
    return (this.navItems as Array<any>).filter(
      (i) => !i.roles || (i.roles as string[]).includes(role)
    );
  });

  primaryMobileNavItems = computed(() => {
    const role = this.authService.currentUser()?.role || '';
    const isHrStaff = ['admin', 'hr', 'manager'].includes(role);
    const icon = {
      workday: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      punch: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
      timesheet: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      hr: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
      requests: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      dashboard: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    };
    if (isHrStaff) {
      return [
        { path: '/admin-hr-portal', labelKey: 'nav.hrPortal', exact: false, icon: icon.hr },
        { path: '/employee-home', labelKey: 'nav.workday', exact: false, icon: icon.workday },
        { path: '/my-timesheet', labelKey: 'nav.timesheet', exact: false, icon: icon.timesheet },
        { path: '/dashboard', labelKey: 'nav.dashboard', exact: false, icon: icon.dashboard },
      ];
    }
    return [
      { path: '/employee-home', labelKey: 'nav.workday', exact: false, icon: icon.workday },
      { path: '/attendance/punch', labelKey: 'nav.clockTerminal', exact: true, icon: icon.punch },
      { path: '/request-center', labelKey: 'nav.requests', exact: false, icon: icon.requests },
      { path: '/my-timesheet', labelKey: 'nav.timesheet', exact: false, icon: icon.timesheet },
    ];
  });

  ngOnInit() {
    this.loadNotifications();
    this.workspaceService.loadWorkspaces();
    this.rehydrateActiveTracking();
  }

  /** Restore quick sessions and task timers after refresh or new tab. */
  private rehydrateActiveTracking(): void {
    this.timeEntryService.loadActive().subscribe();
    this.activeTimerService.loadActive().subscribe();
  }

  isProjectsRouteActive(): boolean {
    return this.router.isActive('/projects', {paths: 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored'});
  }

  loadProjects() {
    const wsId = this.workspaceService.activeWorkspace()?._id;
    this.loadingProjects.set(true);
    this.projectService.getAll(wsId).subscribe({
      next: (res) => {
        this.projects.set(res.data || []);
        this.loadingProjects.set(false);
      },
      error: () => this.loadingProjects.set(false)
    });
  }

  // -- Workspace Actions --
  toggleWorkspaceMenu() {
    this.showWorkspaceMenu.update(v => !v);
    this.showUserMenu.set(false);
    this.showNotifications.set(false);
  }

  selectWorkspace(id: string) {
    this.workspaceService.setActiveWorkspace(id);
    this.showWorkspaceMenu.set(false);
    this.router.navigate(['/dashboard']);
  }

  openCreateWorkspace() {
    this.showWorkspaceMenu.set(false);
    this.workspaceForm.reset();
    this.createError.set('');
    this.showCreateWorkspace.set(true);
  }

  openManageMembers() {
    const ws = this.workspaceService.activeWorkspace();
    if (!ws) return;
    this.showWorkspaceMenu.set(false);
    this.membersDialogWs.set(ws);
  }

  closeManageMembers() {
    this.membersDialogWs.set(null);
    // Refresh in case membership changed (e.g. user removed themselves)
    this.workspaceService.loadWorkspaces();
  }

  closeCreateWorkspace() {
    this.showCreateWorkspace.set(false);
    this.workspaceForm.reset();
  }

  submitWorkspace() {
    if (this.workspaceForm.invalid) {
      this.workspaceForm.markAllAsTouched();
      return;
    }
    
    this.creatingWs.set(true);
    this.createError.set('');
    
    this.workspaceService.createWorkspace(this.workspaceForm.value).subscribe({
      next: (res) => {
        const ws = (res as any).data || res;
        this.creatingWs.set(false);
        this.closeCreateWorkspace();
        // Reload workspaces and set active
        this.workspaceService.loadWorkspaces();
        // Note: active is naturally set in loadWorkspaces if none, but we can explicitly set it:
        this.workspaceService.activeWorkspace.set(ws);
        this.toast.success(this.locale.t('shell.toast.workspaceCreated', { name: ws.name }));
      },
      error: () => {
        this.creatingWs.set(false);
      }
    });
  }

  // -- Topbar Actions --
  toggleUserMenu() {
    this.showUserMenu.update(v => !v);
    this.showNotifications.set(false);
    this.showWorkspaceMenu.set(false);
  }

  toggleNotifications() {
    this.showNotifications.update(v => !v);
    this.showUserMenu.set(false);
    this.showWorkspaceMenu.set(false);
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
  }

  // -- Global Timer Logic --
  toggleTaskSelector() {
    const willOpen = !this.showTaskSelector();
    this.showTaskSelector.set(willOpen);
    this.showUserMenu.set(false);
    this.showNotifications.set(false);
    this.showWorkspaceMenu.set(false);
    if (willOpen) {
      // Always start at the project list, refresh recent/daily on open
      this.popoverProject.set(null);
      this.popoverTasks.set([]);
      this.loadRecentAndDaily();
    }
  }

  /** Drill into a project: load and show its tasks in the popover. */
  openPopoverProject(project: Project) {
    this.popoverProject.set(project);
    this.popoverTasks.set([]);
    this.popoverLoadingTasks.set(true);
    this.taskService.getByProject(project._id).subscribe({
      next: (res) => {
        this.popoverTasks.set(res.data || []);
        this.popoverLoadingTasks.set(false);
      },
      error: () => {
        this.popoverLoadingTasks.set(false);
      },
    });
  }

  backToProjects() {
    this.popoverProject.set(null);
    this.popoverTasks.set([]);
  }

  /** Start the timer on a task — auto-stops any other active tracking first. */
  startTimerForTask(task: Task) {
    if (this.startingTaskId()) return;
    const active = this.activeTimerService.activeTask();
    if (active?._id === task._id && active.activeTimerStart) return;

    this.startingTaskId.set(task._id);
    this.taskService.startTimer(task._id).subscribe({
      next: (res) => {
        if (res?.data) {
          this.activeTimerService.setActiveTask(res.data);
          this.timeEntryService.loadActive().subscribe();
          this.toast.success(this.locale.t('shell.toast.timerStarted', { title: task.title }));
        }
        this.startingTaskId.set(null);
        this.showTaskSelector.set(false);
        this.popoverProject.set(null);
        this.loadRecentAndDaily();
      },
      error: () => {
        this.startingTaskId.set(null);
      },
    });
  }

  /** Quick re-start from the Recent list. */
  startTimerForRecent(task: Task) {
    this.startTimerForTask(task);
  }

  stopGlobalTimer() {
    this.activeTimerService.stopTimer();
    // After stopping, the user might want to start something new immediately
    setTimeout(() => this.loadRecentAndDaily(), 400);
  }

  /** Populate the "Recent Tasks" list and today's tracked total (tasks + quick sessions). */
  private loadRecentAndDaily() {
    this.loadingRecent.set(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();

    // ── Task-based logs
    this.taskService.getMyTimesheet().subscribe({
      next: (res) => {
        const tasks = (res.data || []) as Task[];

        let totalToday = 0;
        for (const t of tasks) {
          for (const log of t.timeLogs || []) {
            const logStart = new Date(log.start).getTime();
            if (logStart >= startMs) totalToday += log.duration || 0;
          }
        }
        const activeTask = this.activeTimerService.activeTask();
        if (activeTask?.activeTimerStart) {
          const startAt = new Date(activeTask.activeTimerStart).getTime();
          totalToday += Math.max(0, Date.now() - Math.max(startAt, startMs));
        }

        // ── Quick sessions (TimeEntry) — fold into daily total
        this.timeEntryService.loadRecent(20).subscribe({
          next: (entries) => {
            for (const e of entries) {
              const sAt = new Date(e.startedAt).getTime();
              if (e.endedAt) {
                if (sAt >= startMs) totalToday += e.duration || 0;
              }
            }
            const activeEntry = this.timeEntryService.active();
            if (activeEntry && !activeTask) {
              const sAt = new Date(activeEntry.startedAt).getTime();
              totalToday += Math.max(0, Date.now() - Math.max(sAt, startMs));
            }
            this.dailyTrackedMs.set(totalToday);
          },
          error: () => this.dailyTrackedMs.set(totalToday),
        });

        // ── Recent tasks (excluding active one) for the picker
        const sorted = [...tasks].sort((a, b) => this.lastLogTime(b) - this.lastLogTime(a));
        this.recentTasks.set(sorted.filter((t) => t._id !== activeTask?._id).slice(0, 5));
        this.loadingRecent.set(false);
      },
      error: () => this.loadingRecent.set(false),
    });
  }

  private lastLogTime(t: Task): number {
    if (t.activeTimerStart) return Date.now();
    const logs = t.timeLogs || [];
    if (!logs.length) return 0;
    return Math.max(...logs.map((l) => new Date(l.end || l.start).getTime()));
  }

  taskProjectTitle(task: any): string {
    const p = task?.projectId;
    if (!p) return '';
    return typeof p === 'string' ? '' : p.title || '';
  }

  private formatMs(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private startGlobalTickForTask(task: any) {
    this.stopGlobalTick();
    const loggedMs = task.timeLogs?.reduce((acc: number, l: any) => acc + l.duration, 0) || 0;
    this.timerInterval = setInterval(() => {
      const elapsed = task.activeTimerStart
        ? Date.now() - new Date(task.activeTimerStart).getTime()
        : 0;
      this.globalDisplayTime.set(this.formatHmsShort(loggedMs + elapsed));
    }, 1000);
  }

  private startGlobalTickForEntry(entry: TimeEntry) {
    this.stopGlobalTick();
    const startMs = new Date(entry.startedAt).getTime();
    this.timerInterval = setInterval(() => {
      this.globalDisplayTime.set(this.formatHmsShort(Date.now() - startMs));
    }, 1000);
  }

  private stopGlobalTick() {
    if (this.timerInterval !== undefined) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.globalDisplayTime.set('0:00:00');
  }

  private formatHmsShort(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* ─── Quick Session controls ─────────────────────────────────────────── */

  startQuickSession() {
    if (this.startingQuickSession()) return;
    this.startingQuickSession.set(true);
    const wsId = this.workspaceService.activeWorkspace()?._id || null;
    this.timeEntryService
      .start({
        description: this.quickDescription().trim(),
        workspaceId: wsId,
      })
      .subscribe({
        next: () => {
          this.activeTimerService.setActiveTask(null);
          this.startingQuickSession.set(false);
          this.quickDescription.set('');
          this.showTaskSelector.set(false);
          this.loadRecentAndDaily();
          this.toast.success(this.locale.t('shell.toast.quickSessionStarted'));
        },
        error: () => this.startingQuickSession.set(false),
      });
  }

  /** Unified stop — stops whichever timer is running. */
  stopAny() {
    const task = this.activeTimerService.activeTask();
    if (task) {
      this.activeTimerService.stopTimer();
      this.toast.info(this.locale.t('shell.toast.timerStopped'));
    } else if (this.timeEntryService.active()) {
      this.timeEntryService.stop().subscribe({
        next: () => {
          this.activeTimerService.setActiveTask(null);
          this.toast.info(this.locale.t('shell.toast.sessionStopped'));
        },
      });
    }
    setTimeout(() => this.loadRecentAndDaily(), 400);
  }
}
