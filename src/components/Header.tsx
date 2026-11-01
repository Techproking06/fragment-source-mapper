import { Mark, Moon, Play, Sun } from './Icons';
import type { Theme } from '../hooks';

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  onPresent: () => void;
}

export default function Header({ theme, onToggleTheme, onPresent }: Props) {
  return (
    <header className="site-head">
      <div className="wrap head-inner">
        <a className="brand" href="#top">
          <Mark />
          <span className="brand-text">
            <strong>Fragment Source Mapper</strong>
            <small>Patchwork plagiarism · Micro-Project prototype</small>
          </span>
        </a>

        <nav className="head-nav" aria-label="Primary">
          <a href="#demo">Demo</a>
          <a href="#validation">Validation</a>
          <a href="#method">Method</a>
          <a href="#compare">Compare</a>
        </nav>

        <div className="head-actions">
          <button className="btn btn-line" aria-label="Presentation" onClick={onPresent}>
            <Play /> <span className="btn-label">Presentation</span>
          </button>
          <button
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
        </div>
      </div>
    </header>
  );
}
