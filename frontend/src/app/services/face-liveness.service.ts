import { Injectable, inject } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';
import { FaceRecognitionService } from './face-recognition.service';

/** Eye landmark indices (68-point model). */
const LEFT_EYE = [36, 37, 38, 39, 40, 41] as const;
const RIGHT_EYE = [42, 43, 44, 45, 46, 47] as const;
const NOSE_TIP = 30;

const EAR_CLOSED = 0.21;
const EAR_OPEN = 0.25;
/** Normalized yaw delta required for head-turn challenge. */
const TURN_YAW_THRESHOLD = 0.11;
const TURN_HOLD_FRAMES = 2;
const BASELINE_FRAMES = 5;
const BLINK_WARMUP_FRAMES = 8;
const FACE_LOST_RESET_ENROLL = 12;
const FACE_LOST_RESET_PUNCH = 6;

export type HeadTurnDirection = 'left' | 'right';
export type LivenessStep = 'blink' | 'turn';
/** enroll = blink only; punch = blink then head turn */
export type LivenessProfile = 'enroll' | 'punch';

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
  private readonly profile: LivenessProfile;

  private step: LivenessStep = 'blink';
  private turnChallenge: HeadTurnDirection = randomTurn();

  private eyesWereOpen = false;
  private eyesWereClosed = false;
  private blinkCount = 0;
  private blinkDone = false;
  private turnDone = false;
  private frameCount = 0;
  private passed = false;

  private turnBaselineYaw: number | null = null;
  private turnBaselineSum = 0;
  private turnBaselineSamples = 0;
  private turnHeldFrames = 0;

  constructor(profile: LivenessProfile = 'punch') {
    this.profile = profile;
  }

  faceLostResetThreshold(): number {
    return this.profile === 'enroll' ? FACE_LOST_RESET_ENROLL : FACE_LOST_RESET_PUNCH;
  }

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
    const ear = this.averageEar(positions);

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
    const warmedUp = this.frameCount >= BLINK_WARMUP_FRAMES;

    if (!warmedUp || !hasBlink) return;

    this.blinkDone = true;
    if (this.profile === 'enroll') {
      this.turnDone = true;
      this.passed = true;
      return;
    }

    this.step = 'turn';
    this.turnBaselineYaw = null;
    this.turnBaselineSum = 0;
    this.turnBaselineSamples = 0;
    this.turnHeldFrames = 0;
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
    // Match user-facing left/right (physical head turn, not mirrored screen coords).
    const turnedLeft = delta < -TURN_YAW_THRESHOLD;
    const turnedRight = delta > TURN_YAW_THRESHOLD;
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
      if (this.blinkCount >= 1) p += 0.35;
      if (this.blinkDone) {
        return this.profile === 'enroll' ? 1 : 0.5;
      }
      return Math.min(this.profile === 'enroll' ? 0.95 : 0.5, p);
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

}

@Injectable({ providedIn: 'root' })
export class FaceLivenessService {
  private faceRecognition = inject(FaceRecognitionService);

  createTracker(profile: LivenessProfile = 'punch'): LivenessTracker {
    return new LivenessTracker(profile);
  }

  async detectLandmarks(
    video: HTMLVideoElement
  ): Promise<Awaited<ReturnType<ReturnType<typeof faceapi.detectSingleFace>['withFaceLandmarks']>> | null> {
    await this.faceRecognition.ensureModels();
    return faceapi.detectSingleFace(video).withFaceLandmarks();
  }
}
