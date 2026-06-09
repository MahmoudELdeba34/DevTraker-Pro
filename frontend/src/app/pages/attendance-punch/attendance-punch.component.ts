import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HRService } from '../../services/hr.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  FaceCaptureComponent,
  FaceCaptureMode,
} from '../../components/ui/face-capture/face-capture.component';
import { Attendance } from '../../models/types';

@Component({
  selector: 'app-attendance-punch',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, FaceCaptureComponent],
  template: `
    <div class="page-ambient min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-10 animate-fade-up">
      <div class="w-full max-w-lg">
        <div class="flex items-center justify-between gap-4 mb-6">
          <a routerLink="/employee-home" class="btn-soft text-sm inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {{ 'attendancePunch.back' | translate }}
          </a>
          <span class="text-[10px] uppercase font-bold tracking-[0.2em] text-text-muted">
            {{ 'attendancePunch.eyebrow' | translate }}
          </span>
        </div>

        @if (loading()) {
          <div class="surface-card glass-card rounded-2xl p-12 flex flex-col items-center gap-4">
            <span class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></span>
            <p class="text-sm text-text-secondary">{{ 'common.loading' | translate }}</p>
          </div>
        } @else if (blockedMessage()) {
          <div class="surface-card glass-card rounded-2xl p-8 text-center">
            <div class="w-14 h-14 rounded-2xl bg-success-muted text-success flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 class="text-lg font-bold text-white mb-2">{{ blockedMessage() }}</h2>
            <p class="text-sm text-text-secondary mb-6">{{ 'attendancePunch.shiftCompleteHint' | translate }}</p>
            <a routerLink="/employee-home" class="btn-accent">{{ 'attendancePunch.backToWorkday' | translate }}</a>
          </div>
        } @else if (mode()) {
          <app-face-capture
            [mode]="mode()!"
            [embedded]="true"
            (captured)="onCaptured($event)"
            (cancel)="goBack()"
          />
        }
      </div>
    </div>
  `,
})
export class AttendancePunchComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private hrService = inject(HRService);
  private toast = inject(ToastService);
  locale = inject(LocaleService);

  loading = signal(true);
  mode = signal<FaceCaptureMode | null>(null);
  blockedMessage = signal<string | null>(null);
  processing = signal(false);

  ngOnInit(): void {
    const paramMode = this.route.snapshot.queryParamMap.get('mode') as FaceCaptureMode | null;

    if (paramMode === 'check-in' || paramMode === 'check-out') {
      this.mode.set(paramMode);
      this.loading.set(false);
      return;
    }

    this.hrService.getTodayAttendance().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res.success) {
          this.mode.set('check-in');
          return;
        }
        this.resolveMode(res.data);
      },
      error: () => {
        this.loading.set(false);
        this.mode.set('check-in');
      },
    });
  }

  private resolveMode(attendance: Attendance | null): void {
    if (!attendance?.checkIn) {
      this.mode.set('check-in');
      return;
    }
    if (!attendance.checkOut) {
      this.mode.set('check-out');
      return;
    }
    this.blockedMessage.set(this.locale.t('attendancePunch.shiftComplete'));
  }

  onCaptured(photo: Blob): void {
    const currentMode = this.mode();
    if (!currentMode || this.processing()) return;

    this.processing.set(true);
    const req$ =
      currentMode === 'check-in' ? this.hrService.checkIn(photo) : this.hrService.checkOut(photo);

    req$.subscribe({
      next: (res) => {
        this.processing.set(false);
        if (res.success) {
          const key =
            currentMode === 'check-in'
              ? 'employeeHome.toast.checkedIn'
              : 'employeeHome.toast.punchedOut';
          this.toast.success(this.locale.t(key));
          void this.router.navigate(['/employee-home']);
        }
      },
      error: (err) => {
        this.processing.set(false);
        const msg = err?.error?.error;
        this.toast.error(typeof msg === 'string' ? msg : this.locale.t('common.genericError'));
      },
    });
  }

  goBack(): void {
    void this.router.navigate(['/employee-home']);
  }
}
