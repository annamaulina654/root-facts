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
  }

  // TODO [Basic] Muat model dan inisialisasi pipeline text2text-generation
  // TODO [Advance] Implementasikan strategi Backend Adaptive
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
    if (!this.isReady()) {
      throw new Error('Model belum siap atau sedang sibuk menghasilkan konten.');
    }

    if (!vegetableName || typeof vegetableName !== 'string') {
      throw new Error('Nama sayuran yang valid diperlukan.');
    }

    try {
      this.isGenerating = true;

      // 3. [Advanced] Fitur Persona Dinamis: Merangkai gaya bahasa ke dalam prompt
      // Misal currentTone bernilai "lucu" -> "Write a funny fact..."
      const styleModifier = this.currentTone === 'normal' ? 'interesting' : this.currentTone;
      const prompt = `Write a ${styleModifier} fact about ${vegetableName}. Keep it short and engaging in 1 to 2 sentences.`;

      // 4. [Skilled] Mengatur parameter performa AI untuk hasil yang natural namun dibatasi
      const result = await this.generator(prompt, {
        max_new_tokens: 60,   // Batas panjang teks hasil (Skilled)
        temperature: 0.7,     // Keseimbangan antara logis dan kreatif (Skilled)
        do_sample: true,      // Mengizinkan variasi hasil (Skilled)
        top_p: 0.9            // Memotong probabilitas kata yang terlalu aneh (Skilled)
      });

      const generatedText = result[0].generated_text;

      return generatedText.trim();

    } catch (error) {
      console.error('Kesalahan saat menghasilkan fakta:', error);
      // Mengembalikan string 'error' agar UI InfoPanel (Kriteria 2) dapat menanganinya dengan elegan
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