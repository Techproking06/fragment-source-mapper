import { jaccardDetail, tokenize } from '../lib/text';
import { buildTrace } from '../lib/trace';
import type { AnalysisResult } from '../lib/types';
import {
  FragmentViz,
  JaccardViz,
  VectorViz,
  CosineViz,
  RankingViz,
  DecisionViz,
} from './StepVisuals';

/* Fixed example sentences — real Jaccard arithmetic on fixed text, always
   labelled as an example, never presented as the current run's numbers.
   A/B share the idea and most words; C is A paraphrased. */
const A = 'renewable energy sources reduce emissions';
const B = 'clean energy sources reduce pollution';
const C = 'clean energy systems cut pollution';

const EX1 = jaccardDetail(tokenize(A), tokenize(B));
const EX2 = jaccardDetail(tokenize(A), tokenize(C));

const s2 = (n: number) => n.toFixed(2);
const s4 = (n: number) => n.toFixed(4);

/** Which fragment the Method section is quoting: the first matched one. */
function focusIndex(result: AnalysisResult | null): number | null {
  if (!result || result.matches.length === 0) return null;
  const matched = result.matches.findIndex((m) => m.status !== 'none');
  return matched >= 0 ? matched : 0;
}

interface Props {
  result: AnalysisResult | null;
}

/** The same six stages the trace panel walks through, in the same order. */
function StageFlow({ vectorStage }: { vectorStage: string }) {
  const names = ['Submitted fragment', 'Jaccard', vectorStage, 'Cosine similarity', 'Source ranking', 'Final decision'];
  return (
    <div className="flow-strip" aria-label="Calculation pipeline: fragment, Jaccard, vectors, cosine, ranking, decision">
      {names.flatMap((n, i) => {
        const step = (
          <span className="fs-step" key={n}>
            <b>{i + 1}</b>
            {n}
          </span>
        );
        return i === 0 ? [step] : [<span className="fs-arw" key={`a${i}`} aria-hidden>→</span>, step];
      })}
    </div>
  );
}

export default function Method({ result }: Props) {
  const idx = focusIndex(result);
  const trace = idx !== null && result ? buildTrace(result, idx) : null;
  const live = trace !== null;

  const liveId = trace?.fragmentId ?? '';
  const jac = trace?.jaccard ?? null;
  const target = trace?.winnerSub?.id ?? '—';
  const cos = trace?.cosine ?? null;
  const eng = trace?.engine ?? null;
  const sem = trace?.semantic ?? null;
  const sbertLive = sem !== null && sem.kind === 'sbert';
  const fallbackActive = result !== null && !result.engine.genuine;
  const rank = trace?.ranking ?? [];
  const rankLine = rank.map((r) => `${r.sourceId} ${s2(r.cosine)}`).join(' · ');

  return (
    <section className="method wrap" id="method">
      <header className="sec-head reveal">
        <span className="eyebrow">How the matching works {live ? `· live from ${liveId}` : ''}</span>
        <h2>
          Six stages, <em>shown not claimed.</em>
        </h2>
        <p className="lede">
          One submitted fragment, followed from plain text to a decision. Jaccard word overlap and the
          vectors are two parallel evidence streams; cosine alone ranks the sources and applies the
          thresholds.{' '}
          {live
            ? `Numbers below come from your current run, fragment ${liveId}.`
            : 'Run a demo above to fill these stages with live numbers.'}
        </p>
      </header>

      <div className="reveal">
        <StageFlow vectorStage={eng?.dims ? 'Sentence-BERT' : 'TF-IDF vector'} />
      </div>

      <ol className="steps steps-6">
        {/* ------------------------------ 01 ------------------------------ */}
        <li className="step reveal">
          <span className="step-n">01 · input</span>
          <h3>Submitted fragment</h3>
          <p>The submission is split into sentences, and one fragment is followed here stage by stage.</p>
          <FragmentViz focus={trace?.fragmentId} />
          <code className="formula">
            {live
              ? `tokenize(${liveId}) → ${jac ? jac.countA : 0} unique tokens`
              : 'fragmentize(text) → F1, F2, F3 …'}
            <br />
            <span className="formula-note">
              {live ? `live · ${liveId} of ${trace.fragmentCount} fragments` : 'run a demo to follow your own fragment'}
            </span>
          </code>
        </li>

        {/* ------------------------------ 02 ------------------------------ */}
        <li className="step reveal">
          <span className="step-n">02 · lexical</span>
          <h3>Jaccard</h3>
          <p>Counts the words both texts share, after stop-words are removed and stems applied.</p>
          <JaccardViz detail={jac ?? EX1} />
          <code className="formula">
            {jac && trace?.winnerSub ? (
              <>
                |A ∩ B| / |A ∪ B| = {jac.countIntersection} / {jac.countUnion} = {s2(jac.score)}
                <br />
                <span className="formula-note">
                  live · {liveId} vs {target}
                </span>
              </>
            ) : (
              <>
                |A ∩ B| / |A ∪ B| = {EX1.countIntersection} / {EX1.countUnion} = {s2(EX1.score)}
                <br />
                <span className="formula-note">example sentences, computed live</span>
              </>
            )}
            <br />
            |A ∩ C| / |A ∪ C| = {EX2.countIntersection} / {EX2.countUnion} = {s2(EX2.score)}{' '}
            <span className="formula-note">· paraphrase: same meaning, fewer shared words</span>
          </code>
        </li>

        {/* ------------------------------ 03 ------------------------------ */}
        <li className="step reveal">
          <span className="step-n">03 · semantic</span>
          <h3>{eng?.dims ? 'SBERT' : fallbackActive ? 'TF-IDF vector' : 'SBERT'}</h3>
          <p>Turns each text into one vector: fixed-length, so a paraphrase still lands close.</p>
          <VectorViz dims={eng?.dims ?? null} fallback={fallbackActive} />
          {sbertLive && eng && sem.kind === 'sbert' ? (
            <code className="formula">
              {eng.model} · {sem.dims} dimensions
              <br />
              <span className="formula-note">
                live · vectors of {liveId} / {target}
              </span>
            </code>
          ) : fallbackActive ? (
            <code className="formula">
              {eng?.requested === 'illustrative'
                ? 'illustrative engine · no SBERT vectors'
                : 'fallback active · no SBERT vectors'}
              <br />
              <span className="formula-note">
                {eng?.requested === 'illustrative'
                  ? 'chosen in the engine switch · TF-IDF terms stand in for the embedding'
                  : 'TF-IDF terms stand in for the embedding'}
              </span>
            </code>
          ) : (
            <code className="formula">
              all-MiniLM-L6-v2 · 384 dimensions
              <br />
              <span className="formula-note">run a demo to see the live vectors</span>
            </code>
          )}
        </li>

        {/* ------------------------------ 04 ------------------------------ */}
        <li className="step reveal">
          <span className="step-n">04 · comparison</span>
          <h3>Cosine</h3>
          <p>The angle between two vectors, ignoring their length — texts of any size stay comparable.</p>
          <CosineViz />
          <code className="formula">
            cos θ = (A · B) / (‖A‖ ‖B‖)
            {cos && (
              <>
                <br />
                {s4(cos.dot)} / ({s4(cos.normA)} × {s4(cos.normB)}) = <b>{s2(cos.score)}</b>
              </>
            )}
            <br />
            <span className="formula-note">
              {cos ? `live · ${eng?.genuine ? 'SBERT' : 'TF-IDF'} vectors` : 'the score that ranks the sources'}
            </span>
          </code>
        </li>

        {/* ------------------------------ 05 ------------------------------ */}
        <li className="step reveal">
          <span className="step-n">05 · ranking</span>
          <h3>Source ranking</h3>
          <p>Each source keeps its highest-scoring sub-fragment; the four scores are sorted by cosine.</p>
          <RankingViz rows={rank.length ? rank : undefined} />
          <code className="formula">
            {rank.length ? (
              <>
                {rankLine}
                <br />
                <span className="formula-note">
                  live · best {rank[0].subId} → Source {rank[0].sourceId}
                </span>
              </>
            ) : (
              <>
                A · B · C · D compared → sorted by cosine
                <br />
                <span className="formula-note">run a demo to see the four real scores</span>
              </>
            )}
          </code>
        </li>

        {/* ------------------------------ 06 ------------------------------ */}
        <li className="step reveal">
          <span className="step-n">06 · decision</span>
          <h3>Source mapping</h3>
          <p>The top cosine becomes a status through the thresholds — or stays below them.</p>
          <DecisionViz
            thresholds={trace?.decision.thresholds ?? { strong: 0.7, possible: 0.52 }}
            score={trace?.decision.score ?? null}
          />
          {trace ? (
            <code className="formula">
              {s2(trace.decision.score)} vs {s2(trace.decision.thresholds.strong)} /{' '}
              {s2(trace.decision.thresholds.possible)} → {trace.decision.statusLabel}
              <br />
              <span className="formula-note">
                live · {trace.decision.status === 'none' ? `${liveId} keeps its own words` : `${liveId} → Source ${trace.winner?.sourceId}`}
              </span>
            </code>
          ) : (
            <code className="formula">
              the ranking and the decision appear here
              <br />
              <span className="formula-note">run a demo to see live values</span>
            </code>
          )}
        </li>
      </ol>
    </section>
  );
}
