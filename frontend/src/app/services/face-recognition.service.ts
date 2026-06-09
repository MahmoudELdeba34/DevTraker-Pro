import { Injectable } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

@Injectable({ providedIn: 'root' })
export class FaceRecognitionService {
  private modelsReady: Promise<void> | null = null;

  ensureModels(): Promise<void> {
    if (!this.modelsReady) {
      this.modelsReady = this.loadModels();
    }
    return this.modelsReady;
  }

  private async loadModels(): Promise<void> {
    await tf.setBackend('webgl');
    await tf.ready();
    const base = '/face-api';
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(base),
      faceapi.nets.faceLandmark68Net.loadFromUri(base),
      faceapi.nets.faceRecognitionNet.loadFromUri(base),
    ]);
  }

  async extractDescriptorFromBlob(blob: Blob): Promise<number[] | null> {
    await this.ensureModels();
    const url = URL.createObjectURL(blob);
    try {
      const img = await faceapi.fetchImage(url);
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection?.descriptor) return null;
      return Array.from(detection.descriptor);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
