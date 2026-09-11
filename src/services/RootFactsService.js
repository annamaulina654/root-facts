import { pipeline, env } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';

// Mengamankan pengaturan Transformers.js agar selalu memprioritaskan cache browser
env.allowLocalModels = false;
env.useBrowserCache = true;

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    // Gunakan Xenova/flan-t5-small sebagai standar text2text ringan di browser
    this.modelName = 'Xenova/flan-t5-small'; 
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG?.defaultTone || 'normal';

    // --- TAMBAHKAN BLOK INI ---
    // Konfigurasi parameter generasi AI
    this.config = {
      maxTokens: 60,
      temperature: 0.7,
      topP: 0.9,
      generationDelay: 500
    };
  }

  // TODO [Basic] Muat model dan inisialisasi pipeline text2text-generation
  async initialize(onProgress) {
    try {
      // 1. [Advanced] Pemilihan Device Eksekusi: WebGPU jika tersedia, fallback ke WASM
      const device = navigator.gpu ? 'webgpu' : 'wasm';

      // 2. Inisialisasi pipeline dengan progress_callback untuk UI
      this.generator = await pipeline(
        'text2text-generation',
        this.modelName,
        {
          dtype: 'q4', // Kuantisasi 4-bit untuk menghemat memori
          device: device,
          progress_callback: (progressData) => {
            if (onProgress) onProgress(progressData);
          }
        }
      );

      this.isModelLoaded = true;
      this.currentBackend = device;

      return {
        success: true,
        model: this.modelName,
        backend: this.currentBackend
      };

    } catch (error) {
      console.error('Kesalahan memuat model Generative AI:', error);
      throw new Error(`Gagal memuat model fakta menarik: ${error.message}`);
    }
  }

  // TODO [Advance] Konfigurasi tone fakta yang dihasilkan
  setTone(tone) {
    if (tone) {
      this.currentTone = tone;
    }
  }

  // TODO [Basic] Lakukan prediksi pada elemen gambar yang diberikan dan kembalikan hasilnya
  // TODO [Skilled] Konfigurasikan parameter generasi berdasarkan kebutuhan
  // TODO [Advance] Implementasikan parameter tone untuk mengatur nada fakta yang dihasilkan
async generateFacts(vegetableName) {
    if (!this.isModelLoaded || this.isGenerating) {
      throw new Error('Model belum siap atau sedang sibuk.');
    }

    try {
      this.isGenerating = true;
      await new Promise(resolve => setTimeout(resolve, this.config.generationDelay || 500));

      // --- ADVANCED: FITUR PERSONA DINAMIS ---
      // Menyesuaikan instruksi prompt berdasarkan currentTone yang dipilih pengguna
      let styleInstruction = "interesting and simple";
      if (this.currentTone === 'lucu' || this.currentTone === 'funny') {
        styleInstruction = "funny and humorous";
      } else if (this.currentTone === 'sejarah' || this.currentTone === 'historical') {
        styleInstruction = "historical and informative";
      }

      const prompt = `Write a ${styleInstruction} fact about ${vegetableName} in 1-2 sentences.`;

      const result = await this.generator(prompt, {
        max_new_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        do_sample: true,
        top_p: this.config.topP
      });

      return result[0].generated_text.trim();
    } catch (error) {
      console.error('Kesalahan generasi fakta:', error);
      return 'error';
    } finally {
      this.isGenerating = false;
    }
  }

  // TODO [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isReady() {
    return this.isModelLoaded && !this.isGenerating;
  }
}