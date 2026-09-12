import { pipeline, env } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;

    this.modelName = 'Xenova/flan-t5-small';

    this.currentBackend = null;

    this.currentTone = TONE_CONFIG?.defaultTone || 'normal';

    this.config = {
      maxTokens: 60,
      temperature: 0.7,
      topP: 0.9,
      generationDelay: 500
    };
  }

  async createGenerator(device, onProgress) {
    console.log(
      `Mencoba memuat Generative AI dengan device: ${device}`
    );

    const generator = await pipeline(
      'text2text-generation',
      this.modelName,
      {
        dtype: 'q4',
        device,
        progress_callback: (progressData) => {
          if (onProgress) {
            onProgress(progressData);
          }
        }
      }
    );

    console.log(
      `Generative AI berhasil dimuat menggunakan ${device}`
    );

    return generator;
  }

  async initialize(onProgress) {
    try {
      let preferredDevice = 'wasm';

      if (navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();

          if (adapter) {
            preferredDevice = 'webgpu';

            console.log(
              'WebGPU tersedia dan adapter berhasil ditemukan.'
            );
          } else {
            console.warn(
              'WebGPU tersedia, tetapi adapter tidak ditemukan.'
            );
          }
        } catch (webgpuCheckError) {
          console.warn(
            'Gagal memeriksa WebGPU. Menggunakan WASM.',
            webgpuCheckError
          );
        }
      } else {
        console.log(
          'WebGPU tidak tersedia. Menggunakan WASM.'
        );
      }

      if (preferredDevice === 'webgpu') {
        try {
          this.generator = await this.createGenerator(
            'webgpu',
            onProgress
          );

          this.currentBackend = 'webgpu';

          console.log(
            'Transformers.js menggunakan WebGPU.'
          );
        } catch (webgpuError) {
          console.warn(
            'Inisialisasi Transformers.js dengan WebGPU gagal.',
            webgpuError
          );

          console.warn(
            'Melakukan fallback otomatis ke WASM...'
          );

          this.generator = await this.createGenerator(
            'wasm',
            onProgress
          );

          this.currentBackend = 'wasm';

          console.log(
            'Transformers.js berhasil fallback ke WASM.'
          );
        }
      } else {
        this.generator = await this.createGenerator(
          'wasm',
          onProgress
        );

        this.currentBackend = 'wasm';

        console.log(
          'Transformers.js menggunakan WASM.'
        );
      }

      this.isModelLoaded = true;

      return {
        success: true,
        model: this.modelName,
        backend: this.currentBackend
      };
    } catch (error) {
      console.error(
        'Kesalahan memuat model Generative AI:',
        error
      );

      this.isModelLoaded = false;
      this.currentBackend = null;

      throw new Error(
        `Gagal memuat model fakta menarik: ${error.message}`
      );
    }
  }

  setTone(tone) {
    if (tone) {
      this.currentTone = tone;
    }
  }

  async generateFacts(vegetableName) {
    if (!this.isModelLoaded || this.isGenerating) {
      throw new Error(
        'Model belum siap atau sedang sibuk.'
      );
    }

    try {
      this.isGenerating = true;

      await new Promise((resolve) => {
        setTimeout(
          resolve,
          this.config.generationDelay || 500
        );
      });

      let styleInstruction = 'interesting and simple';

      switch (this.currentTone) {
      case 'funny':
        styleInstruction =
            'funny, playful, and humorous';
        break;

      case 'historical':
        styleInstruction =
            'historical, informative, and educational';
        break;

      case 'casual':
        styleInstruction =
            'casual, friendly, and easy to understand';
        break;

      case 'normal':
      default:
        styleInstruction =
            'interesting and simple';
        break;
      }

      let prompt;

      switch (this.currentTone) {
      case 'funny':
        prompt = `
Write ONE genuinely funny and playful fact about ${vegetableName}.
Include a light joke or humorous comparison related to the vegetable.
The fact must still be accurate and relevant.
Do not talk about history.
Do not repeat words or phrases.
Return only 1-2 short sentences.
`;
        break;

      case 'historical':
        prompt = `
Write ONE accurate historical fact about ${vegetableName}.
Focus on its origin, history, traditional use, or historical importance.
Use an informative and educational tone.
Return only 1-2 short sentences.
`;
        break;

      case 'casual':
        prompt = `
Write ONE accurate and interesting fact about ${vegetableName}.
Use friendly, relaxed, everyday language as if talking to a friend.
Keep the fact relevant to the vegetable.
Do not invent strange or unrelated information.
Return only 1-2 short sentences.
`;
        break;

      case 'normal':
      default:
        prompt = `
Write ONE accurate and interesting fact about ${vegetableName}.
Use simple, clear, and informative language.
Do not invent unrelated information.
Return only 1-2 short sentences.
`;
        break;
      }

      console.log(
        `Generating fact with backend: ${this.currentBackend}`
      );

      try {
        const result = await this.generator(prompt, {
          max_new_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          do_sample: true,
          top_p: this.config.topP
        });

        return result[0].generated_text.trim();

      } catch (generationError) {
        if (this.currentBackend === 'webgpu') {
          console.warn(
            'Inference WebGPU gagal.',
            generationError
          );

          console.warn(
            'Beralih ke WASM dan mencoba kembali...'
          );

          this.generator = null;

          this.generator = await this.createGenerator(
            'wasm'
          );

          this.currentBackend = 'wasm';

          const retryResult = await this.generator(
            prompt,
            {
              max_new_tokens: this.config.maxTokens,
              temperature: this.config.temperature,
              do_sample: true,
              top_p: this.config.topP
            }
          );

          console.log(
            'Generate ulang dengan WASM berhasil.'
          );

          return retryResult[0].generated_text.trim();
        }

        throw generationError;
      }

    } catch (error) {
      console.error(
        'Kesalahan generasi fakta:',
        error
      );

      return 'error';

    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return (
      this.isModelLoaded &&
      !this.isGenerating
    );
  }
}