import { Injectable, inject } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';
import { FaceRecognitionService } from './face-recognition.service';

/** Eye landmark indices (68-point model). */
const LEFT_EYE = [36, 37, 38, 39, 40, 41] as const;
const RIGHT_EYE = [42, 43, 44, 45, 46, 47] as const;
const NOSE_TIP = 30;

const EAR_CLOSED = 0.22;
const EAR_OPEN = 0.26;
/** Minimum nose movement relative to face width (blocks flat/static photos). */
const MIN_HEAD_SHIFT = 0.025;
/** Minimum EAR variance across frames (live skin vs static print/screen). */
const MIN_EAR_VARIANCE = 0.0008;

export interface LivenessFrame {
  faceDetected: boolean;
  passed: boolean;
  blinkDetected: boolean;
  /** Normalized 0–1 progress toward liveness pass. */
  progress: number;
}

/**
 * Tracks blink + micro-movement on consecutive video frames to block photo-on-screen attacks.
 */
export class LivenessTracker {
  private eyesWereOpen = false;
  private eyesWereClosed = false;
  private blinkCount = 0;
  private frameCount = 0;
  private passed = false;
  private noseSamples: { x: number; y: number }[] = [];
  private earSamples: number[] = [];

  reset(): void {
    this.eyesWereOpen = false;
    this.eyesWereClosed = false;
    this.blinkCount = 0;
    this.frameCount = 0;
    this.passed = false;
    this.noseSamples = [];
    this.earSamples = [];
  }

  isPassed(): boolean {
    return this.passed;
  }

  update(landmarks: faceapi.FaceLandmarks68): LivenessFrame {
    this.frameCount++;
    const positions = landmarks.positions;
    const faceWidth = this.faceWidth(positions);
    const ear = this.averageEar(positions);
    this.earSamples.push(ear);
    if (this.earSamples.length > 24) this.earSamples.shift();

    const nose = positions[NOSE_TIP];
    this.noseSamples.push({ x: nose.x / faceWidth, y: nose.y / faceWidth });
    if (this.noseSamples.length > 24) this.noseSamples.shift();

    if (ear >= EAR_OPEN) {
      this.eyesWereOpen = true;
      if (this.eyesWereClosed) {
        this.blinkCount++;
        this.eyesWereClosed = false;
      }
    } else if (ear <= EAR_CLOSED && this.eyesWereOpen) {
      this.eyesWereClosed = true;
    }

    const hasBlink = this.blinkCount >= 1;
    const hasMotion = this.noseSpread() >= MIN_HEAD_SHIFT;
    const hasLiveVariation = this.earVariance() >= MIN_EAR_VARIANCE;
    const warmedUp = this.frameCount >= 6;

    if (warmedUp && hasBlink && (hasMotion || hasLiveVariation)) {
      this.passed = true;
    }

    let progress = 0;
    if (this.eyesWereOpen) progress += 0.25;
    if (this.eyesWereClosed || hasBlink) progress += 0.35;
    if (hasBlink) progress += 0.25;
    if (hasMotion || hasLiveVariation) progress += 0.15;
    if (this.passed) progress = 1;

    return {
      faceDetected: true,
      passed: this.passed,
      blinkDetected: hasBlink,
      progress: Math.min(1, progress),
    };
  }

  emptyFrame(): LivenessFrame {
    return {
      faceDetected: false,
      passed: this.passed,
      blinkDetected: this.blinkCount >= 1,
      progress: this.passed ? 1 : 0,
    };
  }

  private faceWidth(positions: faceapi.Point[]): number {
    const xs = positions.map((p) => p.x);
    const width = Math.max(...xs) - Math.min(...xs);
    return width > 1 ? width : 1;
  }

  private distance(a: faceapi.Point, b: faceapi.Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Eye aspect ratio — drops when the eye closes. */
  private eyeAspectRatio(positions: faceapi.Point[], indices: readonly number[]): number {
    const p1 = positions[indices[0]];
    const p2 = positions[indices[1]];
    const p3 = positions[indices[2]];
    const p4 = positions[indices[3]];
    const p5 = positions[indices[4]];
    const p6 = positions[indices[5]];
    const vertical = this.distance(p2, p6) + this.distance(p3, p5);
    const horizontal = this.distance(p1, p4) * 2;
    return horizontal > 0 ? vertical / horizontal : 0;
  }

  private averageEar(positions: faceapi.Point[]): number {
    const left = this.eyeAspectRatio(positions, LEFT_EYE);
    const right = this.eyeAspectRatio(positions, RIGHT_EYE);
    return (left + right) / 2;
  }

  private noseSpread(): number {
    if (this.noseSamples.length < 4) return 0;
    const xs = this.noseSamples.map((p) => p.x);
    const ys = this.noseSamples.map((p) => p.y);
    return Math.max(this.stdDev(xs), this.stdDev(ys));
  }

  private earVariance(): number {
    if (this.earSamples.length < 4) return 0;
    return this.stdDev(this.earSamples);
  }

  private stdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}

@Injectable({ providedIn: 'root' })
export class FaceLivenessService {
  private faceRecognition = inject(FaceRecognitionService);

  createTracker(): LivenessTracker {
    return new LivenessTracker();
  }

  async detectLandmarks(
    video: HTMLVideoElement
  ): Promise<Awaited<ReturnType<ReturnType<typeof faceapi.detectSingleFace>['withFaceLandmarks']>> | null> {
    await this.faceRecognition.ensureModels();
    return faceapi.detectSingleFace(video).withFaceLandmarks();
  }
}
