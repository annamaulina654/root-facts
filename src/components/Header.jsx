import { Sprout } from 'lucide-react';

function Header({ modelStatus }) {
  // Indikator titik (dot) hanya akan menyala (hijau) jika statusnya "Aktif"
  const isActive = modelStatus === 'Aktif';

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Sprout size={20} />
          <span>RootFacts</span>
        </div>

        <div className="status-pill">
          <span className={`status-dot ${isActive ? 'active' : ''}`}></span>
          {/* Langsung render text dari props agar mendukung format "Encoder: 21% | Decoder: 18%" */}
          <span>{modelStatus}</span>
        </div>
      </div>
    </header>
  );
}

export default Header;