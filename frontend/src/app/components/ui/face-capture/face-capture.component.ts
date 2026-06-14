import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { FaceRecognitionService } from '../../../services/face-recognition.service';
import {
  FaceLivenessService,
  HeadTurnDirection,
  LivenessStep,
  LivenessTracker,
} from '../../../services/face-liveness.service';

export type FaceCaptureMode = 'check-in' | 'check-out' | 'enroll';

export interface FaceCaptureResult {
  photo: Blob;
  descriptor: number[];
}

@Component({
  selector: 'app-face-capture',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (embedded) {
      <div class="surface-card glass-card rounded-2xl p-6 animate-scale-in w-full" role="region">
        <ng-container *ngTemplateOutlet="captureBody" />
      </div>
    } @else {
      <div class="modal-backdrop animate-fade-in" (click)="onBackdrop($event)">
        <div class="modal face-capture-modal animate-scale-in" role="dialog" aria-modal="true">
          <ng-container *ngTemplateOutlet="captureBody" />
        </div>
      </div>
    }

    <ng-template #captureBody>
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <p class="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold mb-1">
              {{ modeLabelKey() | translate }}
            </p>
            <h3 class="text-lg font-bold text-white">{{ 'faceCapture.title' | translate }}</h3>
            <p class="text-sm text-text-secondary mt-1">{{ 'faceCapture.hint' | translate }}</p>
          </div>
          @if (!embedded) {
            <button type="button" class="icon-btn" (click)="cancel.emit()" [attr.aria-label]="'common.close' | translate">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          }
        </div>

        <div class="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] border border-border">
          @if (cameraError()) {
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p class="text-sm text-danger font-medium">{{ cameraError() }}</p>
              <button type="button" class="btn-soft text-sm" (click)="startCamera()">
                {{ 'faceCapture.retry' | translate }}
              </button>
            </div>
          } @else {
            <video #videoEl class="w-full h-full object-cover mirror" autoplay playsinline muted></video>
            <canvas #canvasEl class="hidden"></canvas>
            <div class="face-guide"
              [class.face-detected]="livenessPassed()"
              [class.face-pending]="faceDetected() && !livenessPassed()"></div>
            <div class="absolute bottom-3 left-0 right-0 text-center px-3">
              <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md"
                [class.bg-success-muted]="livenessPassed()"
                [class.text-success]="livenessPassed()"
                [class.border-success]="livenessPassed()"
                [class.bg-warning-muted]="faceDetected() && !livenessPassed()"
                [class.text-warning]="faceDetected() && !livenessPassed()"
                [class.border-warning]="faceDetected() && !livenessPassed()"
                [class.bg-bg-glass]="!faceDetected()"
                [class.text-text-secondary]="!faceDetected()"
                [class.border-border]="!faceDetected()">
                <span class="live-dot" [style.background]="statusDotColor()"></span>
                {{ statusMessageKey() | translate }}
              </span>
              @if (faceDetected() && !livenessPassed()) {
                @if (livenessStep() === 'turn' && mode !== 'enroll') {
                  <p class="mt-2 text-2xl font-bold text-warning animate-pulse">
                    {{ turnChallenge() === 'left' ? '←' : '→' }}
                  </p>
                }
                <div class="mt-2 h-1 max-w-[200px] mx-auto rounded-full bg-white/10 overflow-hidden">
                  <div class="h-full bg-warning transition-all duration-300" [style.width.%]="livenessProgress() * 100"></div>
                </div>
              }
            </div>
          }
        </div>

        <div class="flex gap-3 mt-5">
          <button type="button" class="btn-soft flex-1" (click)="cancel.emit()">
            @if (mandatory) {
              {{ 'faceEnroll.logout' | translate }}
            } @else {
              {{ 'common.cancel' | translate }}
            }
          </button>
          <button
            type="button"
            class="btn-accent flex-1"
            [disabled]="!streamReady() || !!cameraError() || capturing() || !livenessPassed()"
            (click)="capture()">
            @if (capturing()) {
              <span class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            } @else {
              {{ 'faceCapture.capture' | translate }}
            }
          </button>
        </div>
    </ng-template>
  `,
  styles: [`
    .face-capture-modal { max-width: 420px; width: 100%; }
    .mirror { transform: scaleX(-1); }
    .face-guide {
      position: absolute;
      inset: 12%;
      border: 2px dashed rgba(255,255,255,0.35);
      border-radius: 50% / 42%;
      pointer-events: none;
      transition: border-color 0.25s, box-shadow 0.25s;
    }
    .face-guide.face-pending {
      border-color: rgba(245,158,11,0.85);
      box-shadow: 0 0 0 4px rgba(245,158,11,0.12);
    }
    .face-guide.face-detected {
      border-color: rgba(34,197,94,0.85);
      box-shadow: 0 0 0 4px rgba(34,197,94,0.15);
    }
  `],
})
export class FaceCaptureComponent implements OnInit, OnDestroy {
  @Input({ required: true }) mode!: FaceCaptureMode;
  @Input() embedded = false;
  /** When true, user cannot skip — only logout is offered instead of cancel. */
  @Input() mandatory = false;
  @Output() captured = new EventEmitter<FaceCaptureResult>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly locale = inject(LocaleService);
  private faceRecognition = inject(FaceRecognitionService);
  private faceLiveness = inject(FaceLivenessService);

  faceDetected = signal(false);
  livenessPassed = signal(false);
  livenessProgress = signal(0);
  livenessStep = signal<LivenessStep>('blink');
  turnChallenge = signal<HeadTurnDirection>('left');
  streamReady = signal(false);
  cameraError = signal<string | null>(null);
  capturing = signal(false);

  private stream: MediaStream | null = null;
  private detectTimer: ReturnType<typeof setInterval> | null = null;
  private livenessTracker: LivenessTracker | null = null;
  private faceLostFrames = 0;
  private analyzing = false;

  ngOnInit(): void {
    void this.faceRecognition.ensureModels().catch(() => {});
    this.livenessTracker = this.faceLiveness.createTracker(this.livenessProfile());
    void this.startCamera();
  }

  private livenessProfile(): 'enroll' | 'punch' {
    return this.mode === 'enroll' ? 'enroll' : 'punch';
  }

  statusMessageKey(): string {
    if (this.livenessPassed()) return 'faceCapture.faceOk';
    if (!this.faceDetected()) return 'faceCapture.alignFace';
    if (this.mode === 'enroll') return 'faceCapture.enrollBlink';
    if (this.livenessStep() === 'turn') {
      return this.turnChallenge() === 'left'
        ? 'faceCapture.livenessTurnLeft'
        : 'faceCapture.livenessTurnRight';
    }
    return 'faceCapture.livenessBlink';
  }

  statusDotColor(): string {
    if (this.livenessPassed()) return '#22c55e';
    if (this.faceDetected()) return '#f59e0b';
    return '#8b8b9e';
  }

  modeLabelKey(): string {
    if (this.mode === 'enroll') return 'faceCapture.enroll';
    if (this.mode === 'check-out') return 'faceCapture.checkOut';
    return 'faceCapture.checkIn';
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  onBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.cancel.emit();
    }
  }

  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    this.streamReady.set(false);
    this.resetLiveness();
    this.stopCamera();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const video = this.videoRef?.nativeElement;
      if (!video) return;
      video.srcObject = this.stream;
      await video.play();
      this.streamReady.set(true);
      this.startDetectionLoop();
    } catch {
      this.cameraError.set(this.locale.t('faceCapture.cameraDenied'));
    }
  }

  private startDetectionLoop(): void {
    this.detectTimer = setInterval(() => void this.detectFaceAndLiveness(), 320);
  }

  private resetLiveness(): void {
    this.livenessTracker?.reset();
    this.livenessPassed.set(false);
    this.livenessProgress.set(0);
    this.livenessStep.set('blink');
    this.turnChallenge.set(this.livenessTracker?.emptyFrame().turnChallenge ?? 'left');
    this.faceLostFrames = 0;
  }

  private applyLivenessFrame(frame: ReturnType<LivenessTracker['update']>): void {
    this.livenessProgress.set(frame.progress);
    this.livenessPassed.set(frame.passed);
    this.livenessStep.set(frame.step);
    this.turnChallenge.set(frame.turnChallenge);
  }

  private async detectFaceAndLiveness(): Promise<void> {
    const video = this.videoRef?.nativeElement;
    if (!video || video.readyState < 2 || this.analyzing || !this.livenessTracker) return;

    this.analyzing = true;
    try {
      const detection = await this.faceLiveness.detectLandmarks(video);
      if (!detection?.landmarks) {
        this.faceLostFrames++;
        this.faceDetected.set(false);
        if (this.faceLostFrames >= this.livenessTracker.faceLostResetThreshold()) {
          this.resetLiveness();
        } else {
          this.applyLivenessFrame(this.livenessTracker.emptyFrame());
        }
        return;
      }

      this.faceLostFrames = 0;
      this.faceDetected.set(true);
      this.applyLivenessFrame(this.livenessTracker.update(detection.landmarks));
    } catch {
      this.faceDetected.set(false);
    } finally {
      this.analyzing = false;
    }
  }

  capture(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas || this.capturing() || !this.livenessPassed()) return;

    this.capturing.set(true);
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.capturing.set(false);
      return;
    }
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          this.capturing.set(false);
          return;
        }
        void this.faceRecognition
          .extractDescriptorFromBlob(blob)
          .then((descriptor) => {
            this.capturing.set(false);
            if (!descriptor) {
              this.cameraError.set(this.locale.t('faceCapture.noFaceInCapture'));
              return;
            }
            this.stopCamera();
            this.captured.emit({ photo: blob, descriptor });
          })
          .catch(() => {
            this.capturing.set(false);
            this.cameraError.set(this.locale.t('faceCapture.processingFailed'));
          });
      },
      'image/jpeg',
      0.88
    );
  }

  private stopCamera(): void {
    if (this.detectTimer) {
      clearInterval(this.detectTimer);
      this.detectTimer = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
