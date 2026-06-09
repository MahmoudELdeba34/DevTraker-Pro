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

export type FaceCaptureMode = 'check-in' | 'check-out';

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
              {{ mode === 'check-in' ? ('faceCapture.checkIn' | translate) : ('faceCapture.checkOut' | translate) }}
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
            <div class="face-guide" [class.face-detected]="faceDetected()"></div>
            <div class="absolute bottom-3 left-0 right-0 text-center">
              <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md"
                [class.bg-success-muted]="faceDetected()"
                [class.text-success]="faceDetected()"
                [class.border-success]="faceDetected()"
                [class.bg-bg-glass]="!faceDetected()"
                [class.text-text-secondary]="!faceDetected()"
                [class.border-border]="!faceDetected()">
                <span class="live-dot" [style.background]="faceDetected() ? '#22c55e' : '#8b8b9e'"></span>
                {{ faceDetected() ? ('faceCapture.faceOk' | translate) : ('faceCapture.alignFace' | translate) }}
              </span>
            </div>
          }
        </div>

        <div class="flex gap-3 mt-5">
          <button type="button" class="btn-soft flex-1" (click)="cancel.emit()">
            {{ 'common.cancel' | translate }}
          </button>
          <button
            type="button"
            class="btn-accent flex-1"
            [disabled]="!streamReady() || !!cameraError() || capturing()"
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
    .face-guide.face-detected {
      border-color: rgba(34,197,94,0.85);
      box-shadow: 0 0 0 4px rgba(34,197,94,0.15);
    }
  `],
})
export class FaceCaptureComponent implements OnInit, OnDestroy {
  @Input({ required: true }) mode!: FaceCaptureMode;
  @Input() embedded = false;
  @Output() captured = new EventEmitter<Blob>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly locale = inject(LocaleService);

  faceDetected = signal(false);
  streamReady = signal(false);
  cameraError = signal<string | null>(null);
  capturing = signal(false);

  private stream: MediaStream | null = null;
  private detectTimer: ReturnType<typeof setInterval> | null = null;
  private faceDetector: { detect: (src: ImageBitmapSource) => Promise<{ boundingBox: DOMRectReadOnly }[]> } | null = null;

  ngOnInit(): void {
    void this.initDetector();
    void this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  onBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.cancel.emit();
    }
  }

  private async initDetector(): Promise<void> {
    const w = globalThis as typeof globalThis & {
      FaceDetector?: new (opts?: { fastMode?: boolean }) => {
        detect: (src: ImageBitmapSource) => Promise<{ boundingBox: DOMRectReadOnly }[]>;
      };
    };
    if (w.FaceDetector) {
      this.faceDetector = new w.FaceDetector({ fastMode: true });
    }
  }

  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    this.streamReady.set(false);
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
    this.detectTimer = setInterval(() => void this.detectFace(), 400);
  }

  private async detectFace(): Promise<void> {
    const video = this.videoRef?.nativeElement;
    if (!video || video.readyState < 2) return;

    if (this.faceDetector) {
      try {
        const faces = await this.faceDetector.detect(video);
        this.faceDetected.set(faces.length > 0);
        return;
      } catch {
        /* fallback below */
      }
    }

    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const w = 80;
    const h = 60;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] + data[i + 1] + data[i + 2];
    }
    const avg = sum / (data.length / 4) / 3;
    this.faceDetected.set(avg > 25 && avg < 220);
  }

  capture(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas || this.capturing()) return;

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
        this.capturing.set(false);
        if (blob) {
          this.stopCamera();
          this.captured.emit(blob);
        }
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
