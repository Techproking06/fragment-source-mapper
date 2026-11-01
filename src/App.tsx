import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Header from './components/Header';
import WorkflowRail from './components/WorkflowRail';
import Workbench from './components/Workbench';
import Method from './components/Method';
import Validation from './components/Validation';
import Comparison from './components/Comparison';
import Limitations from './components/Limitations';
import Presentation from './components/Presentation';
import { ArrowRight, Play } from './components/Icons';
import { DEFAULT_DEMO, DEMOS } from './data/demos';
import { analyze, type Stage } from './lib/engine';
import { loadSbert, modelLabel } from './lib/sbert';
import { useTheme } from './hooks';
import type { AnalysisResult, EngineMode, EngineState } from './lib/types';

export default function App() {
  const { theme, toggle } = useTheme();

  /* ---------------------------- engine ---------------------------- */
  const [engineMode, setEngineMode] = useState<EngineMode>('sbert');
  const [engineState, setEngineState] = useState<EngineState>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [label, setLabel] = useState('checking environment');

  /* ---------------------------- document -------------------------- */
  const [activeDemo, setActiveDemo] = useState(DEFAULT_DEMO.id);
  const [text, setText] = useState(DEFAULT_DEMO.text);

  /* ---------------------------- analysis -------------------------- */
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [presenting, setPresenting] = useState(false);
  const busy = useRef(false);

  /* Download the 23 MB ONNX weights once, shortly after first paint, so a
     presentation never waits on the network. Cached by the browser after. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      loadSbert((p) => {
        if (p.status === 'progress' && typeof p.progress === 'number') {
          setLoadProgress(p.progress);
        }
      })
        .then((ok) => {
          setLoadProgress(100);
          setEngineState(ok ? 'ready' : 'error');
          setLabel(ok ? modelLabel || 'all-MiniLM-L6-v2' : 'offline — illustrative engine only');
        })
        .catch(() => {
          setEngineState('error');
          setLabel('offline — illustrative engine only');
        });
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  /* Runs are serialised: a run requested while another is in flight is kept
     as `pending` and executed next, so the engine selector can never leave
     results from a different engine on screen. */
  const pending = useRef<{ text: string; mode: EngineMode } | null>(null);
  const runRef = useRef<(t: string, m: EngineMode) => void>(() => {});

  const run = useCallback(async (inputText: string, mode: EngineMode) => {
    if (busy.current) {
      pending.current = { text: inputText, mode };
      return;
    }
    busy.current = true;
    setAnalyzing(true);
    setResult(null); // stale numbers never survive a new run
    setStage('fragment');
    try {
      if (!inputText.trim()) {
        setResult(null);
        return;
      }
      let used = mode;
      if (mode === 'sbert') {
        const ok = await loadSbert();
        setEngineState(ok ? 'ready' : 'error');
        setLabel(ok ? modelLabel || 'all-MiniLM-L6-v2' : 'offline — illustrative engine only');
        if (!ok) used = 'illustrative';
      }
      const r = await analyze({ submittedText: inputText, mode: used, onStage: setStage });
      setResult(r);
    } catch (err) {
      // Surface engine failures instead of silently showing nothing.
      console.error('[analysis failed]', err);
      setEngineState('error');
      setLabel('offline — illustrative engine only');
      setResult(null);
    } finally {
      setStage(null);
      setAnalyzing(false);
      busy.current = false;
      const next = pending.current;
      if (next) {
        pending.current = null;
        runRef.current(next.text, next.mode);
      }
    }
  }, []);

  useEffect(() => {
    runRef.current = (t, m) => void run(t, m);
  }, [run]);

  /* Open the site and the default patchwork demo is already analysed, so the
     source map, the Method numbers and the trace panel are never empty. */
  useEffect(() => {
    const t = window.setTimeout(() => runRef.current(DEFAULT_DEMO.text, 'sbert'), 500);
    return () => window.clearTimeout(t);
  }, []);

  const pickDemo = useCallback(
    (id: string) => {
      const d = DEMOS.find((x) => x.id === id);
      if (!d) return;
      setActiveDemo(id);
      setText(d.text);
      void run(d.text, engineMode);
    },
    [engineMode, run],
  );

  const pickEngine = useCallback(
    (m: EngineMode) => {
      setEngineMode(m);
      if (m === 'sbert' && engineState !== 'ready') void loadSbert();
      // Switching engines must never leave the previous engine's numbers on
      // screen: results are cleared and the analysis re-runs immediately.
      if (text.trim()) runRef.current(text, m);
      else setResult(null);
    },
    [engineState, text],
  );

  const openPresentation = useCallback(() => {
    setPresenting(true);
    if (!result && !analyzing) {
      const d = DEMOS.find((x) => x.id === 'patchwork')!;
      setActiveDemo(d.id);
      setText(d.text);
      void run(d.text, engineMode);
    }
  }, [result, analyzing, engineMode, run]);

  /* The footer light follows the pointer through two CSS variables. rAF keeps
     style writes off the pointer event and React never re-renders for a move. */
  const creditsFrame = useRef(0);

  const trackCreditsGlow = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const panel = e.currentTarget;
    const x = e.clientX;
    const y = e.clientY;
    if (creditsFrame.current) return;
    creditsFrame.current = window.requestAnimationFrame(() => {
      creditsFrame.current = 0;
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty('--gx', `${x - rect.left - rect.width / 2}px`);
      panel.style.setProperty('--gy', `${y - rect.top - rect.height / 2}px`);
    });
  }, []);

  const settleCreditsGlow = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (creditsFrame.current) {
      window.cancelAnimationFrame(creditsFrame.current);
      creditsFrame.current = 0;
    }
    e.currentTarget.style.setProperty('--gx', '0px');
    e.currentTarget.style.setProperty('--gy', '0px');
  }, []);

  /* Hero summary — the live state of the current analysis. */
  const heroEngine = result
    ? result.engine.genuine
      ? `SBERT · ${result.engine.model}`
      : result.engine.requested === 'illustrative'
        ? 'Illustrative TF-IDF (selected)'
        : 'Illustrative TF-IDF (fallback)'
    : engineState === 'loading'
      ? 'loading Sentence-BERT…'
      : engineMode === 'sbert'
        ? 'Sentence-BERT'
        : 'Illustrative TF-IDF';

  /* One observer for every `.reveal` on the page (hero, runbar, results,
     method steps). Re-runs when new content appears. */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.is-in)'));
    if (!els.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [result]);

  /* Print, PDF export and full-page screenshots never scroll, so the observer
     would leave every section below the fold at opacity 0. Printing fires
     beforeprint and a full-page capture resizes the viewport, so reveal the
     rest on either — with a late backstop for tools that do neither. A reader
     who scrolls keeps the on-scroll animation. */
  useEffect(() => {
    const revealRest = () =>
      document
        .querySelectorAll<HTMLElement>('.reveal:not(.is-in)')
        .forEach((el) => el.classList.add('is-in'));
    const timer = window.setTimeout(revealRest, 12000);
    const onScroll = () => window.clearTimeout(timer);
    window.addEventListener('scroll', onScroll, { once: true, passive: true });
    window.addEventListener('beforeprint', revealRest);
    window.addEventListener('resize', revealRest);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeprint', revealRest);
      window.removeEventListener('resize', revealRest);
    };
  }, []);

  return (
    <>
      <Header theme={theme} onToggleTheme={toggle} onPresent={openPresentation} />

      <main id="top">
        {/* ------------------------------- hero ------------------------------- */}
        <section className="hero wrap">
          <div className="hero-copy">
            <span className="eyebrow reveal">Patchwork plagiarism · fragment-level analysis</span>
            <h1 className="reveal">
              One submission.
              <br />
              <em>Multiple different sources.</em>
            </h1>
            <p className="lede reveal">
              Splits the submission into fragments, compares each with a reference set using
              Sentence-BERT and cosine similarity, and draws a{' '}
              <strong>fragment → source map</strong>.
            </p>
            <div className="hero-actions reveal">
              <button
                className="btn btn-primary"
                onClick={() => {
                  pickDemo('patchwork');
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <Play /> Run the patchwork demo
              </button>
              <a className="btn btn-line" href="#method">
                How the matching works <ArrowRight />
              </a>
            </div>
          </div>

          <aside className="hero-live reveal" aria-label="Current analysis summary">
            <header className="hl-head">
              <span className="eyebrow">Current analysis</span>
              <span className="hl-engine" title={heroEngine}>
                {heroEngine}
              </span>
            </header>
            {result ? (
              <>
                <div className="hl-stats">
                  <div className="hl-stat">
                    <b>{result.matches.length}</b>
                    <span>fragments</span>
                  </div>
                  <div className="hl-stat">
                    <b>{result.matchedFragments}</b>
                    <span>matched</span>
                  </div>
                  <div className="hl-stat">
                    <b>{result.distinctSources}</b>
                    <span>{result.distinctSources === 1 ? 'distinct source' : 'distinct sources'}</span>
                  </div>
                </div>
                <div className="hl-map">
                  <span className="hl-map-label">fragment → source</span>
                  <div className="hl-chips">
                    {result.matches.map((m, i) => {
                      const sid = m.status !== 'none' ? m.best?.sourceId : null;
                      return (
                        <span key={m.fragment.id} className="hl-chip" data-src={sid ?? 'none'}>
                          F{i + 1}→{sid ?? '—'}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <a className="hl-link" href="#demo">
                  See the full map ↓
                </a>
              </>
            ) : (
              <p className="hl-idle">
                {analyzing
                  ? 'Analyzing the patchwork demo…'
                  : 'Run a demo to fill this summary with live numbers.'}
              </p>
            )}
          </aside>
        </section>

        <div className="wrap">
          <WorkflowRail activeStage={stage} done={result !== null} />
        </div>

        {/* ----------------------------- workbench ---------------------------- */}
        <Workbench
          text={text}
          onTextChange={(t) => {
            setText(t);
            setResult(null);
          }}
          activeDemo={activeDemo}
          onDemo={pickDemo}
          engineMode={engineMode}
          onEngineMode={pickEngine}
          engineState={engineState}
          engineLabel={label}
          loadProgress={loadProgress}
          result={result}
          analyzing={analyzing}
          stage={stage}
          onAnalyze={() => void run(text, engineMode)}
        />

        {/* ---------------------------- validation ----------------------------- */}
        <Validation engineMode={engineMode} modelLoading={engineState === 'loading'} />

        {/* ------------------------------ method ------------------------------- */}
        <Method result={result} />

        {/* ---------------------------- comparison ----------------------------- */}
        <Comparison result={result} />

        {/* ---------------------------- limitations ---------------------------- */}
        <Limitations />
      </main>

      {/* ------------------------------- footer ------------------------------- */}
      <footer className="site-foot wrap">
        <div
          className="credits-panel"
          role="group"
          aria-label="Academic project credits"
          tabIndex={0}
          onPointerEnter={trackCreditsGlow}
          onPointerMove={trackCreditsGlow}
          onPointerDown={trackCreditsGlow}
          onPointerLeave={settleCreditsGlow}
          onPointerCancel={settleCreditsGlow}
        >
          <span className="credits-aura" aria-hidden="true" />
          <span className="credits-sheen" aria-hidden="true" />
          <span className="credits-glow" aria-hidden="true" />
          <div className="credits-inner">
            <header className="credits-head">
              <h2 className="credits-title">Fragment Source Mapper</h2>
              <p className="credits-subtitle">
                Fragment-Level Source Mapping for Patchwork Plagiarism Analysis
              </p>
            </header>

            <div className="credits-hair" aria-hidden="true" />

            <div className="credits-grid">
              <section className="credits-block">
                <h3>Submitted by</h3>
                <ul className="credits-students">
                  <li>
                    <span className="credits-name">Aditya Singh Tomar</span>
                    <span className="credits-meta">Enrollment No. BTMC25O1010</span>
                  </li>
                  <li>
                    <span className="credits-name">Aryaman Goyal</span>
                    <span className="credits-meta">Enrollment No. BTMC25O1021</span>
                  </li>
                </ul>
              </section>

              <section className="credits-block credits-block-guide">
                <h3>Submitted to</h3>
                <span className="credits-name">Dr. Dheeraj Kumar Dixit</span>
                <span className="credits-role">Head of Department (HOD)</span>
                <span className="credits-role">Engineering Mathematics and Computing (MAC)</span>
              </section>
            </div>
          </div>
        </div>
      </footer>

      <Presentation open={presenting} result={result} onClose={() => setPresenting(false)} />
    </>
  );
}
