/* ------------------------------------------------------------------ *
 * Real Sentence-BERT running locally in the browser via transformers.js
 * (ONNX runtime, WebAssembly). No server, no API key.
 *
 * Model: all-MiniLM-L6-v2 — the standard 384-dimension sentence
 * embedding model. First run downloads ~23 MB of weights from the
 * Hugging Face CDN; afterwards they are served from the browser cache.
 * ------------------------------------------------------------------ */

const MODEL_CANDIDATES = [
  'Xenova/all-MiniLM-L6-v2',
  'onnx-community/all-MiniLM-L6-v2-ONNX',
];

type Progress = (p: { status: string; file?: string; progress?: number }) => void;

let extractor: ((text: string | string[], opts: unknown) => Promise<unknown>) | null = null;
let loading: Promise<boolean> | null = null;
export let modelLabel = '';

export function isReady(): boolean {
  return extractor !== null;
}

async function tryLoad(onProgress?: Progress): Promise<boolean> {
  // Imported lazily so the app shell never waits on the ONNX runtime bundle.
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  let lastError: unknown;
  for (const model of MODEL_CANDIDATES) {
    for (const dtype of ['q8', 'fp32'] as const) {
      try {
        const pipe = (await pipeline('feature-extraction', model, {
          dtype,
          progress_callback: onProgress as never,
        })) as never as (t: string | string[], o: unknown) => Promise<unknown>;
        extractor = pipe;
        modelLabel = `${model.split('/').pop()} · ${dtype}`;
        return true;
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError;
}

/** Start (or reuse) the model download. Resolves true when SBERT is usable. */
export function loadSbert(onProgress?: Progress): Promise<boolean> {
  if (extractor) return Promise.resolve(true);
  if (!loading) {
    loading = tryLoad(onProgress).catch(() => {
      loading = null;
      return false;
    });
  }
  return loading;
}

/**
 * Mean-pooled, L2-normalised sentence embeddings.
 * Returns one Float32Array(384) per input string.
 */
export async function embed(texts: string[]): Promise<Float32Array[]> {
  if (!extractor) throw new Error('Sentence-BERT model is not loaded');
  const out = (await extractor(texts, { pooling: 'mean', normalize: true })) as {
    data: Float32Array;
    dims: number[];
  };

  const dims = out.dims ?? [];
  if (dims.length === 2 && dims[0] === texts.length) {
    const dim = dims[1];
    const rows: Float32Array[] = [];
    for (let i = 0; i < texts.length; i++) {
      rows.push(out.data.slice(i * dim, (i + 1) * dim));
    }
    return rows;
  }
  // Single vector returned for a single input
  if (texts.length === 1) return [Float32Array.from(out.data)];

  // Fallback: call one by one
  const rows: Float32Array[] = [];
  for (const t of texts) {
    const one = (await extractor(t, { pooling: 'mean', normalize: true })) as {
      data: Float32Array;
      dims: number[];
    };
    rows.push(Float32Array.from(one.data));
  }
  return rows;
}
