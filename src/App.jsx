import { useRef, useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { CameraService } from './services/CameraService';
import { DetectionService } from './services/DetectionService';
import { RootFactsService } from './services/RootFactsService';

function App() {
  const { state, actions } = useAppState();
  
  // Referensi yang diperbaiki dan dilengkapi
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const targetClassRef = useRef(null);
  const consecutiveFramesRef = useRef(0);
  const scanStartTimeRef = useRef(0);
  const downloadProgress = useRef({});
  
  const [currentTone, setCurrentTone] = useState('normal');

  // 1. Inisialisasi Layanan
  useEffect(() => {
    let isMounted = true;

    const initServices = async () => {
      try {
        const camera = new CameraService();
        const detector = new DetectionService();
        const generator = new RootFactsService();

        actions.setServices({ camera, detector, generator });

        const onProgress = (progressData) => {
          if (!isMounted) return;
          
          if (progressData.status === 'progress' && progressData.file) {
            downloadProgress.current[progressData.file] = progressData.progress;

            let encoder = 0;
            let decoder = 0;
            let isTransformers = false;

            Object.entries(downloadProgress.current).forEach(([fileName, progress]) => {
              if (fileName.includes('encoder')) {
                encoder = Math.round(progress);
                isTransformers = true;
              } else if (fileName.includes('decoder')) {
                decoder = Math.round(progress);
                isTransformers = true;
              }
            });

            if (isTransformers) {
               const encText = encoder > 0 ? `Encoder: ${encoder}%` : 'Encoder: 0%';
               const decText = decoder > 0 ? `Decoder: ${decoder}%` : 'Decoder: 0%';
               actions.setModelStatus(`Mengunduh AI... ${encText} | ${decText}`);
            } else {
               actions.setModelStatus(`Mengunduh AI... ${Math.round(progressData.progress)}%`);
            }
          }
        };

        await generator.initialize(onProgress);
        
        await detector.loadModel((tfProgress) => {
           if (isMounted) actions.setModelStatus(`Memuat Detektor... ${Math.round(tfProgress.progress)}%`);
        });
        
        if (isMounted) {
          actions.setModelStatus('Siap');
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
  }, []);

  // 2. Pembersihan Saat Komponen Ditutup
  useEffect(() => {
    return () => {
      if (detectionCleanupRef.current) {
        cancelAnimationFrame(detectionCleanupRef.current);
      }
      state.services.camera?.stopCamera();
    };
  }, [state.services.camera]);

  // 3. Fungsi Looping Deteksi (Dengan Stabilisator 3 Detik & 30 Frame)
// 3. Fungsi Looping Deteksi (Keseimbangan Kecepatan & Akurasi)
// Helper untuk membuat jeda (Sama seperti createDelay di referensi Anda)
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // 1. FUNGSI LOOP DETEKSI YANG BARU
  const startDetectionLoop = useCallback(async () => {
    if (!isRunningRef.current || !state.services.detector || !state.services.camera.video) return;

    try {
      if (state.services.camera.isReady()) {
        const result = await state.services.detector.predict(state.services.camera.video);

        // Syarat: Skor 80% dan stabil selama 5 frame (sangat responsif)
        if (result && result.className && result.score > 0.80) {
          if (targetClassRef.current === result.className) {
            consecutiveFramesRef.current += 1;
          } else {
            targetClassRef.current = result.className;
            consecutiveFramesRef.current = 1;
          }

          if (consecutiveFramesRef.current >= 5) {
            // 1. Hentikan deteksi SEKARANG JUGA
            isRunningRef.current = false; 
            if (detectionCleanupRef.current) {
              cancelAnimationFrame(detectionCleanupRef.current);
            }
            
            // 2. Matikan hardware kamera dan ubah tombol UI
            state.services.camera.stopCamera(); 
            actions.setRunning(false);          
            actions.setModelStatus('Siap');
            
            // 3. TAHAN UI di status "Mencari..." selama 1.5 detik agar terlihat profesional
            actions.setAppState('analyzing');
            await delay(1500); 

            // 4. Setelah jeda selesai, tampilkan hasil sayurannya
            actions.setDetectionResult(result);
            actions.setAppState('result');

            // 5. Mulai hasilkan fakta AI
            if (state.services.generator.isReady()) {
              actions.setFunFactData(null); 
              // Jeda sedikit sebelum AI bekerja
              await delay(500);
              const factText = await state.services.generator.generateFacts(result.className);
              actions.setFunFactData(factText);
            }

            // Bersihkan memori
            targetClassRef.current = null;
            consecutiveFramesRef.current = 0;
            return; // Loop selesai
          }
        } else {
          if (consecutiveFramesRef.current > 0) consecutiveFramesRef.current -= 1;
        }
      }
    } catch (err) {
      console.error("Deteksi error:", err);
    }

    if (isRunningRef.current) {
      detectionCleanupRef.current = requestAnimationFrame(startDetectionLoop);
    }
  }, [state.services, actions]);


  // 2. FUNGSI TOGGLE KAMERA YANG BARU
  const handleToggleCamera = useCallback(async (deviceId) => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      if (detectionCleanupRef.current) cancelAnimationFrame(detectionCleanupRef.current);
      state.services.camera?.stopCamera();
      actions.setRunning(false);
      actions.setModelStatus('Siap'); 
    } else {
      try {
        actions.resetResults(); 
        targetClassRef.current = null;       
        consecutiveFramesRef.current = 0;
        
        // 1. Ubah UI ke "Mencari..." segera setelah ditekan
        actions.setAppState('analyzing');
        
        // 2. Nyalakan perangkat kamera
        await state.services.camera?.startCamera(deviceId); 
        
        isRunningRef.current = true;
        actions.setRunning(true);
        actions.setModelStatus('Aktif'); 

        // 3. JEDA PEMANASAN 1.5 DETIK (Agar Anda sempat mengarahkan kamera ke sayuran)
        await delay(1500);

        // 4. Baru mulai mendeteksi
        startDetectionLoop();
      } catch (err) {
        actions.setError('Gagal mengakses kamera: ' + err.message);
      }
    }
  }, [state.services, actions, startDetectionLoop]);

  // 5. Fungsi Ubah Nada Fakta
  const handleToneChange = useCallback((newTone) => {
    setCurrentTone(newTone);
    if (state.services.generator) {
      state.services.generator.setTone(newTone); 
    }
  }, [state.services.generator]);

  // 6. Fungsi Salin Fakta
  const handleCopyFact = useCallback(async () => {
    const factText = state.funFactData;
    if (!factText || factText === 'error') return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(factText);
      } else {
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
  }, [state.funFactData]);

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