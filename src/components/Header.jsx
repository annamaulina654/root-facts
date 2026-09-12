import { Sprout } from 'lucide-react';

function Header({ modelStatus }) {
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
          <span>{modelStatus}</span>
        </div>
      </div>
    </header>
  );
}

export default Header;