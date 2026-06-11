import { Injectable, inject } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';
import { FaceRecognitionService } from './face-recognition.service';

/** Eye landmark indices (68-point model). */
const LEFT_EYE = [36, 37, 38, 39, 40, 41] as const;
const RIGHT_EYE = [42, 43, 44, 45, 46, 47] as const;
const NOSE_TIP = 30;

const EAR_CLOSED = 0.22;
const EAR_OPEN = 0.26;
const MIN_HEAD_SHIFT = 0.025;
const MIN_EAR_VARIANCE = 0.0008;
/** Normalized yaw delta required for head-turn challenge. */
const TURN_YAW_THRESHOLD = 0.14;
const TURN_HOLD_FRAMES = 3;
const BASELINE_FRAMES = 4;

export type HeadTurnDirection = 'left' | 'right';
export type LivenessStep = 'blink' | 'turn';

export interface LivenessFrame {
  faceDetected: boolean;
  passed: boolean;
  step: LivenessStep;
  turnChallenge: HeadTurnDirection;
  blinkDone: boolean;
  turnDone: boolean;
  progress: number;
}

function randomTurn(): HeadTurnDirection {
  return Math.random() < 0.5 ? 'left' : 'right';
}

/**
 * Two-step liveness: natural blink, then a random head-turn challenge.
 * Blocks static photos and makes screen/video replay attacks much harder.
 */
export class LivenessTracker {
  private step: LivenessStep = 'blink';
  private turnChallenge: HeadTurnDirection = randomTurn();

  private eyesWereOpen = false;
  private eyesWereClosed = false;
  private blinkCount = 0;
  private blinkDone = false;
  private turnDone = false;
  private frameCount = 0;
  private passed = false;

  private noseSamples: { x: number; y: number }[] = [];
  private earSamples: number[] = [];

  private turnBaselineYaw: number | null = null;
  private turnBaselineSum = 0;
  private turnBaselineSamples = 0;
  private turnHeldFrames = 0;

  reset(): void {
    this.step = 'blink';
    this.turnChallenge = randomTurn();
    this.eyesWereOpen = false;
    this.eyesWereClosed = false;
    this.blinkCount = 0;
    this.blinkDone = false;
    this.turnDone = false;
    this.frameCount = 0;
    this.passed = false;
    this.noseSamples = [];
    this.earSamples = [];
    this.turnBaselineYaw = null;
    this.turnBaselineSum = 0;
    this.turnBaselineSamples = 0;
    this.turnHeldFrames = 0;
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

    if (this.step === 'blink') {
      this.updateBlink(ear);
    } else {
      this.updateTurn(positions);
    }

    if (this.blinkDone && this.turnDone) {
      this.passed = true;
    }

    return {
      faceDetected: true,
      passed: this.passed,
      step: this.step,
      turnChallenge: this.turnChallenge,
      blinkDone: this.blinkDone,
      turnDone: this.turnDone,
      progress: this.computeProgress(),
    };
  }

  emptyFrame(): LivenessFrame {
    return {
      faceDetected: false,
      passed: this.passed,
      step: this.step,
      turnChallenge: this.turnChallenge,
      blinkDone: this.blinkDone,
      turnDone: this.turnDone,
      progress: this.passed ? 1 : this.computeProgress(),
    };
  }

  private updateBlink(ear: number): void {
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
      this.blinkDone = true;
      this.step = 'turn';
      this.turnBaselineYaw = null;
      this.turnBaselineSum = 0;
      this.turnBaselineSamples = 0;
      this.turnHeldFrames = 0;
    }
  }

  private updateTurn(positions: faceapi.Point[]): void {
    const yaw = this.computeHeadYaw(positions);

    if (this.turnBaselineYaw === null) {
      this.turnBaselineSum += yaw;
      this.turnBaselineSamples++;
      if (this.turnBaselineSamples >= BASELINE_FRAMES) {
        this.turnBaselineYaw = this.turnBaselineSum / BASELINE_FRAMES;
      }
      return;
    }

    const delta = yaw - this.turnBaselineYaw;
    const turnedLeft = delta > TURN_YAW_THRESHOLD;
    const turnedRight = delta < -TURN_YAW_THRESHOLD;
    const matched =
      (this.turnChallenge === 'left' && turnedLeft) ||
      (this.turnChallenge === 'right' && turnedRight);

    if (matched) {
      this.turnHeldFrames++;
      if (this.turnHeldFrames >= TURN_HOLD_FRAMES) {
        this.turnDone = true;
      }
    } else {
      this.turnHeldFrames = 0;
    }
  }

  private computeProgress(): number {
    if (this.passed) return 1;

    if (this.step === 'blink') {
      let p = 0;
      if (this.eyesWereOpen) p += 0.2;
      if (this.eyesWereClosed || this.blinkCount > 0) p += 0.25;
      if (this.blinkCount >= 1) p += 0.25;
      if (this.noseSpread() >= MIN_HEAD_SHIFT || this.earVariance() >= MIN_EAR_VARIANCE) p += 0.1;
      if (this.blinkDone) p = 0.5;
      return Math.min(0.5, p);
    }

    let p = 0.5;
    if (this.turnBaselineYaw !== null) p += 0.15;
    if (this.turnHeldFrames > 0) p += 0.15 * this.turnHeldFrames;
    if (this.turnDone) p = 1;
    return Math.min(1, p);
  }

  private computeHeadYaw(positions: faceapi.Point[]): number {
    const leftEye = this.eyeCenter(positions, LEFT_EYE);
    const rightEye = this.eyeCenter(positions, RIGHT_EYE);
    const nose = positions[NOSE_TIP];
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeDist = this.distance(leftEye, rightEye) || 1;
    return (nose.x - eyeMidX) / eyeDist;
  }

  private eyeCenter(positions: faceapi.Point[], indices: readonly number[]): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const i of indices) {
      x += positions[i].x;
      y += positions[i].y;
    }
    return { x: x / indices.length, y: y / indices.length };
  }

  private faceWidth(positions: faceapi.Point[]): number {
    const xs = positions.map((p) => p.x);
    const width = Math.max(...xs) - Math.min(...xs);
    return width > 1 ? width : 1;
  }

  private distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

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
