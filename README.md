# Fragment Source Mapper

**Fragment-Level Source Mapping for Patchwork Plagiarism Analysis** — a presentation-ready web prototype.

```
Submitted document
      ↓  Fragmentation
      ↓  Semantic matching   (Sentence-BERT + cosine similarity, all local)
      ↓  Best source
      ↓  Fragment-level source map
```

One submission can be stitched together from several documents. Whole-document checks miss this.
This prototype splits the submission into **fragments**, compares **each fragment** against a
reference set, and draws a **fragment → source map**.

---

## Run it (Windows, PowerShell)

Requires **Node.js 18+** (tested on Node 22). No Python, no GPU, no API keys.

```powershell
cd "D:\Micro-Project Prototype"
npm install
npm run dev
```

Then open the URL Vite prints — **http://localhost:5173**

For a presentation, build once and serve the production bundle (faster and no dev warnings):

```powershell
npm run build
npm run preview
```

Opens **http://localhost:4173**

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (once) |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build (use this for the presentation) |
| `npm run typecheck` | TypeScript only |

> The app is a client-side SPA, so it needs a web server. Opening `index.html` from the file
> system will not work.

---

## Is the semantic model real or illustrative?

**Real, and it runs locally.**

| | |
| --- | --- |
| **Model** | `all-MiniLM-L6-v2` — a standard Sentence-BERT sentence-embedding model |
| **Runtime** | `@huggingface/transformers` (ONNX Runtime, WebAssembly) **inside the browser** |
| **Vector** | 384 dimensions, mean-pooled, L2-normalised |
| **Score** | Cosine similarity between the two embedding vectors |
| **Server / API key** | None. Nothing leaves the machine. |
| **First run** | Downloads ~23 MB of quantised weights from the Hugging Face CDN once, then the browser caches them. The app preloads this in the background ~1.2 s after load, so an analysis never waits on the network. |

You can verify it yourself: open DevTools → Network, filter by `onnx` / `huggingface`, and watch
the weights load. The engine pill in the footer states which engine produced the numbers on screen.

### Fallback: the labelled *Illustrative* engine

If the weights cannot be fetched (offline, blocked CDN, corporate proxy), the app automatically
falls back to an **Illustrative** engine and says so in the UI — on the run bar, in a warning
banner, in the results footnote, and in the footer:

* stemmed tokenisation (Porter stemmer) + stop-word removal
* TF-IDF vectors + cosine
* reduced-weight synonym expansion from a small curated paraphrase lexicon (`src/lib/lexicon.ts`)

**This is a transparent heuristic, not a machine-learning result.** It is never presented as one.
The `Sentence-BERT / Illustrative` segmented control lets you switch engines deliberately and
compare — which is exactly the point of the "Why semantic similarity" section.

---

## Using it

1. Pick a demo (one click populates both documents and runs the analysis), or paste your own text
   into the left pane (or press **Open .txt** to load a plain-text document) and press **Analyze**.
2. The submitted document on the left re-renders as coloured fragments; curved lines connect each
   fragment to its best-matching source on the right.
3. The table underneath shows, per fragment: best source, the source sub-fragment that matched
   (`§2`), the margin over the runner-up, all four source scores, cosine similarity **and** the
   Jaccard word-overlap baseline for comparison.
4. Press **Trace This Result** on any row to open the step-by-step working for that one fragment.

### Trace This Result

Every result row opens an explainability panel that walks one fragment through the whole pipeline in
one continuous column — **fragment → Jaccard → Sentence-BERT → cosine → ranking → decision** — with a
numbered stage strip at the top and a connector between each pair of cards stating what the previous
stage hands on. It reads only intermediates the engine already computed — nothing is recomputed for
display, so the panel and the table can never disagree:

| Stage | Shows |
| --- | --- |
| **1 · Submitted fragment** | The fragment, the engine that produced the numbers, its tokens (total and unique), the position (`F1 of 6`) and the fact that the text takes two parallel paths below |
| **2 · Jaccard word overlap** | The real token sets `A` and `B`, their intersection and union as chips, and `\|A ∩ B\| / \|A ∪ B\| = 10 / 19 = 0.53` |
| **3 · SBERT** | Model id, dimensionality, mean-pooling + L2 normalisation, and the first 8 values of **both** vectors (or the top TF-IDF terms, labelled as the illustrative engine) |
| **4 · Cosine** | `cos θ = (A · B) / (‖A‖ · ‖B‖)` with the dot product and both norms substituted, and the clamped score the engine used |
| **5 · Ranking** | All four sources by cosine, each represented by its best sub-fragment, with the Jaccard cross-check for the same pair |
| **6 · Decision** | Score, thresholds, the exact rule applied, the assigned source — or **“Below threshold — no source assigned.”** — and a generated sentence |

Jaccard and SBERT are shown as **two parallel evidence streams**. Cosine alone ranks the sources and
decides the status; Jaccard never moves a source up or down, and the connector after stage 2 says so
in the panel. The Method section walks the same six stages, live, with the same numbers.

### Validation (live PASS/FAIL)

The **Validation** section re-runs all four bundled submissions through the real engine and compares
the produced mapping against the declared ground truth in `src/data/demos.ts`. Expected and actual
mappings are shown side by side with the per-fragment cosine and a PASS/FAIL pill.

Nothing is pre-computed and no threshold is tuned to make a case pass: under the real Sentence-BERT
engine all four cases pass; under the fallback engine, `single` (fragment 5) and `paraphrased`
(fragment 5) fail honestly — which is exactly the gap the section exists to show. The run names the
engine that actually produced the numbers, including when the fallback was used despite SBERT being
requested.

### Comparison and limitations

* **Real-world comparison** — two balanced panels, then a compact five-row “What’s different?”
  table.
  * **Left — illustrative reference.** No similarity report exists in this project and none was
    obtained, so the panel is an original hand-built mock: a sample document with highlighted
    passages, an explicitly illustrative similarity indicator and a placeholder source list.
    Selecting a passage selects its placeholder source and selecting a source highlights its
    passage. It is labelled **“Illustrative reference · Not an actual Turnitin report.”**, imitates
    no vendor’s report and states no result of any commercial service.
  * **Right — this prototype, live.** The selected fragment with its real Jaccard score and shared
    tokens, the actual embedding information, the computed cosine, all four ranked sources and the
    threshold decision — read from the current run, always labelled with the engine that produced it.
  * The two panels are independent and share no calculation; the note under the table states that
    this is a qualitative workflow comparison, not a performance benchmark, and that no claim of
    superior accuracy is made.
* **Honest scope** — four stated limitations (reference corpus, semantic false positives,
  similarity-is-not-proof, language & evaluation scope) plus a collapsed future-work list.

### Demo modes

| Demo | What it shows |
| --- | --- |
| **Single source** | All six fragments resolve to Source A |
| **Patchwork · multiple sources** | The main case — fragments map to A, C, A, B, D, C |
| **Paraphrased patchwork** | Same stitching, rewritten wording. Jaccard collapses to 4–29 %; SBERT cosine stays at 57–77 % and the mapping is still correct |
| **Mostly original** | Only two fragments have a source; the other four stay below threshold |

### Presentation mode

Click **Presentation** in the header (or `npm run preview`, then the button). Five slides:

1. What is patchwork plagiarism? — **the band pattern mirrors your live mapping**
2. Fragmentation — **your real fragment ids**
3. Semantic matching — **your real Jaccard and cosine values**
4. Source mapping
5. Final source map — **mirrors your live analysis**

Slides 1–3 show their data source under the graphic ("live · …" or "concept illustration — run a
demo"), so nothing on screen is ever presented as measured when it is illustrative.

Navigate with `→` / `←`, `Space`, `PageUp` / `PageDown`, the on-screen arrows, or the dots.
`Esc` closes. Opening presentation with no analysis running automatically launches the patchwork
demo so the last two slides are never empty.

### Theme

Sun/moon toggle in the header. Defaults to your OS preference and is remembered.

---

## How the pipeline works

`src/lib/`

| File | Role |
| --- | --- |
| `text.ts` | Sentence fragmentation, stop-words, Porter stemmer, Jaccard (+ `jaccardDetail` for the panel) |
| `sbert.ts` | Loads `all-MiniLM-L6-v2` via transformers.js and embeds sentences |
| `similarity.ts` | Sparse TF-IDF vectors, synonym expansion, cosine (dense + sparse) and the `cosine*Detail` arithmetic |
| `engine.ts` | Orchestrates: fragment → jaccard → embed → cosine → rank → map. Exports `STAGES`, `THRESHOLDS`, `statusFor` |
| `trace.ts` | Builds the "Trace This Result" panel from the stored intermediates only |
| `validate.ts` | Re-runs every demo through the engine and compares mapping vs ground truth |
| `lexicon.ts` | Paraphrase groups used **only** by the illustrative engine |

A source's score for a fragment is the **maximum** cosine over that source's own fragments, so the
map reports which sub-fragment matched, not just which document. The Jaccard shown for that pair is
read at the **same** winning sub-fragment index, so lexical and semantic evidence always describe
the same two pieces of text.

Two thresholds are used to decide *strong* / *possible* / *no strong match*, calibrated per engine
(`sbert`: 0.70 / 0.52 · `illustrative`: 0.60 / 0.40) and documented in the source.

---

## Honest limitations

* **A match is a lead for a human reviewer, not proof of plagiarism.** Nothing in this prototype
  should be read as a verdict. Every screen that shows a score says so.
* Very short fragments produce noisy scores. All bundled demo fragments are a full sentence.
* Shared technical vocabulary produces false leads — documents on the same topic resemble each
  other even with no copying.
* Proper quotation and citation would also score highly; this prototype does not model intent.
* The four reference documents are short synthetic passages written for this project.
* The illustrative engine deliberately under-performs on paraphrase. That gap is the argument for
  Sentence-BERT, not a bug — but do not quote its numbers as ML results.
* Sentence-BERT captures semantic similarity, not verbatim overlap. The two engines are shown
  side by side (cosine **and** Jaccard) precisely so the reviewer sees both signals.

---

## Tests

### 1. Calculation & ranking assertions

```powershell
npm run test:calc
```

`test/calc.test.mjs` loads the real TypeScript modules through Vite's SSR loader (same code the
browser runs) and asserts: tokenisation strips stop-words and stems, fragmentation merges runt
sentences, Jaccard matches the textbook definition, `jaccardDetail` returns the *same* score the
engine uses and reports its real sets, cosine matches hand-computed `dot / (‖a‖ · ‖b‖)`, TF-IDF
cosine stays in [0, 1] and is symmetric, `statusFor` honours the per-engine thresholds, ranking is
sorted with `best === scores[0]`, Jaccard is computed on the cosine-winning sub-fragment, the trace
panel agrees with the results table row-for-row, and the declared demo expectations are compared
against the actual engine output (printed as PASS/FAIL).

### 2. Browser end-to-end

```powershell
npm run build
npm run preview
npm i --no-save playwright
npx playwright install chromium
node test/browser.mjs
```

`test/browser.mjs` runs all four demos in both engines, toggles the theme, walks all five
presentation slides, opens the **Trace This Result** panel for two different rows and asserts its
numbers equal the table's (including the six-stage pipeline order, the five connectors and the
explicit no-source decision below threshold), runs the validation view and asserts 4/4 PASS under the
genuine SBERT engine, checks that switching engines re-runs instead of leaving stale numbers, drives
both comparison panels (passage ↔ placeholder source in the illustrative panel; fragment selection,
cosine/Jaccard equality with the results table and the engine label in the live panel) and asserts the
two panels stay independent, checks the empty input state, and fails on any console or page error
(0 problems expected). Screenshots land in `artifacts/`.

`test/inspect.mjs` is a small visual pass for review: it re-shoots the Method section, both
comparison panels in dark and light, the trace panel top/bottom, both panels on a 430 px viewport, and
checks that the comparison controls work from the keyboard.

---

## Stack

React 18 · TypeScript · Vite · `@huggingface/transformers` (lazy-loaded, code-split) · hand-written
CSS design system. No UI kit, no CSS framework.

Fonts: Inter, Instrument Serif, JetBrains Mono (Google Fonts). Offline, the app falls back to
system fonts and still works.
