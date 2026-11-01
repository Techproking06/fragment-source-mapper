/* ------------------------------------------------------------------ *
 * Genuine validation: runs every bundled demo through the real engine
 * and compares the produced mapping with the declared ground truth.
 * Nothing is pre-computed — a FAIL is reported as a FAIL.
 * ------------------------------------------------------------------ */

import { DEMOS } from '../data/demos';
import { analyze } from './engine';
import type { EngineInfo, EngineMode, MatchStatus, SourceId } from './types';

/** Source a fragment mapped to, or null when it stayed unmatched. */
export type Cell = SourceId | null;

export interface CaseOutcome {
  id: string;
  label: string;
  caption: string;
  expectedText: string;
  expected: Cell[];
  actual: Cell[];
  scores: number[];
  statuses: MatchStatus[];
  pass: boolean;
  /** engine that actually produced these numbers */
  engine: EngineInfo;
  error?: string;
}

export interface ValidationRun {
  requested: EngineMode;
  cases: CaseOutcome[];
  passed: number;
  total: number;
  allPassed: boolean;
  /** every case reports the same engine, or this is set */
  enginesMatch: boolean;
}

export function cellsOf(matches: { status: MatchStatus; best: { sourceId: SourceId } | null }[]): Cell[] {
  return matches.map((m) => (m.status !== 'none' && m.best ? m.best.sourceId : null));
}

export function cellsEqual(a: Cell[], b: Cell[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Human mapping, e.g. "A, C, A, B, D, C" — "-" for an unmatched fragment. */
export function cellsToString(cells: Cell[]): string {
  return cells.map((c) => c ?? '-').join(', ');
}

export async function runValidation(
  requested: EngineMode,
  onCase?: (id: string) => void,
): Promise<ValidationRun> {
  const cases: CaseOutcome[] = [];

  for (const d of DEMOS) {
    onCase?.(d.id);
    try {
      const r = await analyze({ submittedText: d.text, mode: requested, instant: true });
      const actual = cellsOf(r.matches);
      cases.push({
        id: d.id,
        label: d.label,
        caption: d.caption,
        expectedText: d.expected,
        expected: d.expectation,
        actual,
        scores: r.matches.map((m) => m.similarity),
        statuses: r.matches.map((m) => m.status),
        pass: cellsEqual(actual, d.expectation),
        engine: r.engine,
      });
    } catch (err) {
      cases.push({
        id: d.id,
        label: d.label,
        caption: d.caption,
        expectedText: d.expected,
        expected: d.expectation,
        actual: [],
        scores: [],
        statuses: [],
        pass: false,
        engine: {
          mode: requested,
          requested,
          genuine: false,
          model: '',
          dims: null,
          thresholds: { strong: 0, possible: 0 },
        },
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passed = cases.filter((c) => c.pass).length;
  const enginesMatch = cases.every((c) => c.engine.mode === cases[0]?.engine.mode);

  return {
    requested,
    cases,
    passed,
    total: cases.length,
    allPassed: passed === cases.length && cases.length > 0,
    enginesMatch,
  };
}
