import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = {
      modelPath: '/model/model.json',
      metadataPath: '/model/metadata.json',
      inputSize: [224, 224],
      normalizationFactor: 255
    };
  }

  async loadModel(onProgress) {
    try {
      let selectedBackend = 'webgl';

      if ('gpu' in navigator) {
        try {
          console.log('WebGPU tersedia, mencoba WebGPU...');

          await tf.setBackend('webgpu');
          await tf.ready();

          if (tf.getBackend() === 'webgpu') {
            selectedBackend = 'webgpu';
            console.log('TensorFlow.js menggunakan WebGPU');
          }
        } catch (webgpuError) {
          console.warn(
            'WebGPU gagal digunakan, melakukan fallback ke WebGL...',
            webgpuError
          );

          await tf.setBackend('webgl');
          await tf.ready();

          selectedBackend = 'webgl';
          console.log('TensorFlow.js menggunakan WebGL');
        }
      } else {
        console.log('WebGPU tidak tersedia, menggunakan WebGL...');

        await tf.setBackend('webgl');
        await tf.ready();

        selectedBackend = 'webgl';
      }

      const metadataResponse = await fetch(this.config.metadataPath);

      if (!metadataResponse.ok) {
        throw new Error('Metadata tidak ditemukan');
      }

      const metadata = await metadataResponse.json();
      this.labels = metadata.labels;

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

      console.log(`Model berhasil dimuat menggunakan ${selectedBackend}`);

      return {
        success: true,
        backend: selectedBackend,
        labels: this.labels
      };
    } catch (error) {
      console.error('Gagal memuat model:', error);

      throw new Error(
        `Gagal memuat model: ${error.message}. Periksa kembali isi file model.json di folder public.`
      );
    }
  }

  async predict(imageElement) {
    if (!this.model) {
      throw new Error('Model belum dimuat. Panggil loadModel() terlebih dahulu.');
    }

    let tensor = null;
    let predictions = null;

    try {
      tensor = tf.tidy(() => {
        return tf.browser.fromPixels(imageElement)
          .resizeBilinear(this.config.inputSize)
          .div(tf.scalar(this.config.normalizationFactor))
          .expandDims(0);
      });

      predictions = this.model.predict(tensor);
      const values = await predictions.data();

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
      if (tensor) tensor.dispose();
      if (predictions) predictions.dispose();
    }
  }

  isLoaded() {
    return this.model !== null && this.labels.length > 0;
  }
}