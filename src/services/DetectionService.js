import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { APP_CONFIG } from '../utils/config.js';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];

    this.config = {
      modelPath: '/model/model.json',
      metadataPath: '/model/metadata.json',
      inputSize: [224, 224],
      normalizationFactor: 255,
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
            'WebGPU gagal digunakan, fallback ke WebGL...',
            webgpuError
          );

          await tf.setBackend('webgl');
          await tf.ready();

          selectedBackend = 'webgl';
          console.log('TensorFlow.js menggunakan WebGL');
        }
      } else {
        console.log(
          'WebGPU tidak tersedia, menggunakan WebGL...'
        );

        await tf.setBackend('webgl');
        await tf.ready();

        selectedBackend = 'webgl';
      }

      console.log(
        `Backend TensorFlow.js aktif: ${selectedBackend}`
      );

      const metadataResponse = await fetch(
        this.config.metadataPath
      );

      if (!metadataResponse.ok) {
        throw new Error(
          `Metadata gagal dimuat: ${metadataResponse.status}`
        );
      }

      const metadata = await metadataResponse.json();

      if (!Array.isArray(metadata.labels)) {
        throw new Error(
          'Format metadata.labels tidak valid.'
        );
      }

      this.labels = metadata.labels;

      console.log(
        'Label model:',
        this.labels
      );

      this.model = await tf.loadLayersModel(
        this.config.modelPath,
        {
          onProgress: (fraction) => {
            if (onProgress) {
              onProgress({
                status: 'progress',
                file: 'Model Deteksi',
                progress: fraction * 100,
              });
            }
          },
        }
      );

      console.log(
        'Input shape model:',
        this.model.inputs?.[0]?.shape
      );

      console.log(
        'Output shape model:',
        this.model.outputs?.[0]?.shape
      );

      console.log(
        `Model berhasil dimuat menggunakan ${selectedBackend}`
      );

      return {
        success: true,
        backend: selectedBackend,
        labels: this.labels,
      };
    } catch (error) {
      console.error(
        'Gagal memuat model TensorFlow.js:',
        error
      );

      throw new Error(
        `Gagal memuat model deteksi: ${error.message}`
      );
    }
  }

  async predict(imageElement) {
    if (!this.model) {
      throw new Error(
        'Model belum dimuat.'
      );
    }

    if (
      !imageElement ||
      imageElement.readyState < 2 ||
      imageElement.videoWidth === 0 ||
      imageElement.videoHeight === 0
    ) {
      throw new Error(
        'Video belum siap untuk diproses.'
      );
    }

    let tensor = null;
    let predictions = null;

    try {
      console.log('1. Frame kamera siap');

      console.log(
        'Ukuran video:',
        imageElement.videoWidth,
        'x',
        imageElement.videoHeight
      );

      tensor = tf.tidy(() => {
        return tf.browser
          .fromPixels(imageElement)
          .resizeBilinear(this.config.inputSize)
          .toFloat()
          .div(this.config.normalizationFactor)
          .expandDims(0);
      });

      console.log(
        '2. Tensor dibuat:',
        tensor.shape
      );

      predictions = this.model.predict(tensor);

      console.log(
        '3. Predict selesai:',
        predictions.shape
      );

      const values = await predictions.data();

      console.log(
        '4. Output model:',
        Array.from(values)
      );

      if (!values.length) {
        throw new Error(
          'Output model kosong.'
        );
      }

      let maxIndex = 0;
      let maxValue = values[0];

      for (
        let i = 1;
        i < values.length;
        i += 1
      ) {
        if (values[i] > maxValue) {
          maxValue = values[i];
          maxIndex = i;
        }
      }

      const detectedClass =
        this.labels[maxIndex];

      const confidence =
        Math.round(maxValue * 100);

      console.log(
        '5. Prediction:',
        detectedClass,
        `${confidence}%`
      );

      console.log(
        'Index prediction:',
        maxIndex
      );

      if (!detectedClass) {
        throw new Error(
          `Label tidak ditemukan untuk index ${maxIndex}`
        );
      }

      const isValid =
        confidence >=
        APP_CONFIG.detectionConfidenceThreshold;

      console.log(
        `6. Validasi: ${isValid} | threshold: ${APP_CONFIG.detectionConfidenceThreshold}%`
      );

      return {
        label: detectedClass,
        className: detectedClass,
        score: maxValue,
        confidence,
        isValid,
      };
    } catch (error) {
      console.error(
        'Kesalahan prediksi:',
        error
      );

      throw new Error(
        `Prediksi gagal: ${error.message}`
      );
    } finally {
      if (tensor) {
        tensor.dispose();
      }

      if (predictions) {
        predictions.dispose();
      }
    }
  }

  isLoaded() {
    return (
      this.model !== null &&
      this.labels.length > 0
    );
  }
}