import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    // Sesuaikan path ini dengan lokasi model Anda di folder public
    this.config = {
      modelPath: '/model/model.json',
      metadataPath: '/model/metadata.json',
      inputSize: [224, 224], 
      normalizationFactor: 255
    };
  }

  // TODO [Basic] Muat model dan metadata
  // TODO [Advance] Strategi Backend Adaptive
  async loadModel(onProgress) {
    try {
      // 1. [Advanced] Deteksi ketersediaan WebGPU dengan fallback ke WebGL
      const backend = navigator.gpu ? 'webgpu' : 'webgl';
      await tf.setBackend(backend);
      await tf.ready();

      // 2. Fetch metadata (label sayuran)
      const metadataResponse = await fetch(this.config.metadataPath);
      if (!metadataResponse.ok) throw new Error('Metadata tidak ditemukan');
      const metadata = await metadataResponse.json();
      this.labels = metadata.labels;

      // 3. Muat model dengan callback progress (Untuk kriteria Skilled di UI)
      this.model = await tf.loadLayersModel(this.config.modelPath, {
        onProgress: (fraction) => {
          if (onProgress) {
            onProgress({
              status: 'progress',
              file: 'Model Deteksi',
              progress: fraction * 100
            });
          }
        }
      });

      return { 
        success: true, 
        backend: tf.getBackend(),
        labels: this.labels 
      };
    } catch (error) {
      console.error('Gagal memuat model:', error);
      throw new Error(`Gagal memuat model: ${error.message}`);
    }
  }

  // TODO [Basic] Lakukan prediksi
  async predict(imageElement) {
    if (!this.model) {
      throw new Error('Model belum dimuat. Panggil loadModel() terlebih dahulu.');
    }

    let tensor = null;
    let predictions = null;

    try {
      // 1. [Advanced] tf.tidy untuk membersihkan tensor pra-pemrosesan otomatis
      tensor = tf.tidy(() => {
        return tf.browser.fromPixels(imageElement)
          .resizeBilinear(this.config.inputSize)
          .div(tf.scalar(this.config.normalizationFactor))
          .expandDims(0);
      });

      // 2. Eksekusi model
      predictions = this.model.predict(tensor);
      const values = await predictions.data();

      // 3. Ekstrak nilai tertinggi (confidence)
      const maxIndex = values.indexOf(Math.max(...values));
      const confidenceScore = values[maxIndex];
      const detectedClass = this.labels[maxIndex];

      return {
        label: detectedClass,
        className: detectedClass,
        score: confidenceScore,
        confidence: Math.round(confidenceScore * 100)
      };

    } catch (error) {
      console.error('Kesalahan prediksi:', error);
      throw new Error(`Prediksi gagal: ${error.message}`);
    } finally {
      // 4. [Advanced] Dispose manual untuk tensor utama guna mencegah Memory Leak
      if (tensor) tensor.dispose();
      if (predictions) predictions.dispose();
    }
  }

  // TODO [Basic] Periksa apakah model sudah dimuat
  isLoaded() {
    return this.model !== null && this.labels.length > 0;
  }
}