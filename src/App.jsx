import { useRef, useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';

function App() {
  const { state, actions } = useAppState();
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const [currentTone, setCurrentTone] = useState('normal');

  // TODO [Basic] Inisialisasi layanan deteksi, kamera, dan generator fakta saat aplikasi dimuat
useEffect(() => {
    let isMounted = true;

    const initServices = async () => {
      try {
        if (!state.services.detector || !state.services.generator) return;

        // Callback untuk menangkap progress dari Transformers.js (Untuk Kriteria 1 UI)
        const onProgress = (progressData) => {
          if (!isMounted) return;
          
          // Mengatur string format "Encoder: 21% | Decoder: 18%" 
          // (Asumsi service Anda mengirim data progress dalam bentuk tertentu)
          if (progressData.status === 'progress' && progressData.file) {
             // Modifikasi string modelStatus via actions sesuai data progress
             // actions.setModelStatus(`Mengunduh model AI... ${progressData.file}: ${Math.round(progressData.progress)}%`);
          }
        };

        // Inisialisasi Model AI
        await state.services.generator.initialize(onProgress);
        await state.services.detector.initialize();
        
        if (isMounted) {
          actions.setModelStatus('Siap'); // Status berubah jadi Siap di Header
        }
      } catch (err) {
        if (isMounted) {
          actions.setError('Gagal memuat model: ' + err.message);
          actions.setModelStatus('Error');
        }
      }
    };

    initServices();

    return () => {
      isMounted = false;
    };
  }, [state.services, actions]);


  // TODO [Basic] Bersihkan sumber daya saat komponen ditinggalkan
  useEffect(() => {
    return () => {
      if (detectionCleanupRef.current) {
        cancelAnimationFrame(detectionCleanupRef.current);
      }
      state.services.camera?.stopCamera();
    };
  }, [state.services.camera]);

  // TODO [Basic] Fungsi untuk memulai loop deteksi
  const startDetectionLoop = useCallback(async () => {
    if (!isRunningRef.current || !state.services.detector) return;

    try {
      // Pastikan fungsi predictFrame di dalam detector sudah menggunakan tf.tidy()
      const result = await state.services.detector.predictFrame();
      
      if (result && result.label) {
        // Lakukan generate fun fact berdasarkan label (Kriteria 2 Basic)
        // Dan lempar currentTone untuk persona dinamis (Kriteria 2 Advanced)
        actions.setDetectionResult(result);
        
        // Contoh pemanggilan generator:
        // const fact = await state.services.generator.generateFact(result.label, currentTone);
        // actions.setFunFactData(fact);
      }
    } catch (err) {
      console.error("Deteksi error:", err);
    }

    // Loop frame selanjutnya
    detectionCleanupRef.current = requestAnimationFrame(startDetectionLoop);
  }, [state.services, actions, currentTone]);

  // TODO [Basic] Fungsi untuk memulai dan menghentikan kamera
  const handleToggleCamera = useCallback(async () => {
    if (isRunningRef.current) {
      // Hentikan Kamera
      isRunningRef.current = false;
      if (detectionCleanupRef.current) {
        cancelAnimationFrame(detectionCleanupRef.current);
      }
      state.services.camera?.stopCamera();
      actions.setRunning(false);
      actions.setModelStatus('Siap'); 
    } else {
      // Mulai Kamera
      try {
        await state.services.camera?.startCamera();
        isRunningRef.current = true;
        actions.setRunning(true);
        actions.setModelStatus('Aktif'); // Titik jadi hijau di Header
        startDetectionLoop();
      } catch (err) {
        actions.setError('Gagal mengakses kamera');
      }
    }
  }, [state.services, actions, startDetectionLoop]);

  // TODO [Advance] Fungsi untuk mengubah nada fakta yang dihasilkan
  const handleToneChange = useCallback((newTone) => {
    setCurrentTone(newTone);
    // Jika ada fungsi di generator untuk set tone, panggil di sini
    // state.services.generator.setTone(newTone); 
  }, []);

  // TODO [Skilled] Fungsi untuk menyalin fakta ke clipboard
  const handleCopyFact = useCallback(async (factText) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(factText);
        // Tampilkan toast/alert sukses jika perlu
      } else {
        // Fallback jika tidak support API clipboard
        const textArea = document.createElement("textarea");
        textArea.value = factText;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Gagal menyalin teks', err);
    }
  }, []);

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact} 
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
