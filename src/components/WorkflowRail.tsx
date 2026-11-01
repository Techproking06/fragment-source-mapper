import { STAGES, type Stage } from '../lib/engine';

interface Props {
  activeStage: Stage | null;
  done: boolean;
}

/**
 * The whole project in five words: Document → Fragmentation →
 * Semantic matching → Best source → Fragment-level source map.
 * The rail lights up step by step while an analysis runs.
 */
export default function WorkflowRail({ activeStage, done }: Props) {
  const activeIndex = activeStage ? STAGES.findIndex((s) => s.id === activeStage) : -1;
  /* The document is the input to step 1, so it is finished the moment a run
     starts — it must never sit at "idle" while later stages are lit. */
  const running = activeIndex >= 0;

  return (
    <ol className="rail" aria-label="Pipeline">
      <li className="rail-node" data-state={done || running ? 'done' : 'idle'}>
        <span className="rail-dot" />
        <span className="rail-name">Document</span>
      </li>
      {STAGES.map((s, i) => {
        const state = done || (activeIndex >= 0 && i < activeIndex) ? 'done' : i === activeIndex ? 'active' : 'idle';
        return (
          <li key={s.id} className="rail-node" data-state={state}>
            <span className="rail-dot" />
            <span className="rail-name">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
