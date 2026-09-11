export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.currentFPS = 30; // Default nilai awal FPS
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  async loadCameras() {
    try {
      // Basic: Meminta izin sementara untuk mengumpulkan daftar perangkat
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === 'videoinput');

      // Membersihkan izin stream sementara agar lampu kamera mati
      tempStream.getTracks().forEach((track) => track.stop());

      if (cameras.length === 0) {
        throw new Error('Tidak ada perangkat input video yang tersedia');
      }

      return cameras.map((camera, index) => ({
        deviceId: camera.deviceId,
        label: camera.label || `Kamera ${index + 1}`
      }));
    } catch (error) {
      console.error('Gagal memuat kamera:', error);
      throw new Error(`Akses kamera gagal: ${error.message}`);
    }
  }

  async startCamera(selectedCameraId) {
    try {
      this.stopCamera(); // Pastikan tidak ada stream yang bertumpuk

      // Skilled: Menerapkan FPS limit secara native pada MediaStream constraints
      const constraints = {
        video: {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          frameRate: { ideal: this.currentFPS, max: this.currentFPS }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.video) {
        this.video.srcObject = this.stream;
        this.video.setAttribute('playsinline', true); // Penting untuk kompabilitas iOS
        await this.video.play();
      }

      return true;
    } catch (error) {
      console.error('Gagal memulai kamera:', error);
      throw new Error('Gagal mengakses kamera. Pastikan izin telah diberikan.');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;

      if (this.video) {
        this.video.srcObject = null;
      }
    }
  }

  setFPS(fps) {
    const parsedFPS = parseInt(fps, 10);
    if (parsedFPS >= 15 && parsedFPS <= 60) {
      this.currentFPS = parsedFPS;
      
      // Jika kamera sedang aktif, mulai ulang stream untuk menerapkan batasan FPS keras (Hard Limit)
      if (this.isActive() && this.stream) {
        const currentTrack = this.stream.getVideoTracks()[0];
        const currentDeviceId = currentTrack.getSettings().deviceId;
        this.startCamera(currentDeviceId);
      }
    }
  }

  isActive() {
    return this.stream !== null && this.stream.active;
  }

  isReady() {
    return (
      this.isActive() &&
      this.video !== null &&
      this.video.readyState >= 2 &&
      !this.video.paused
    );
  }
}