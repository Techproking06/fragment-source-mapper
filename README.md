# Fragment Source Mapper

### Fragment-Level Source Mapping for Patchwork Plagiarism Analysis

A **client-side web prototype** that detects potential patchwork plagiarism by splitting a submitted document into fragments, comparing each fragment against a reference corpus, and mapping it to its most likely source.

> **Important:** This prototype identifies **similarity leads**, not plagiarism. A similarity score is not proof of plagiarism and must be reviewed by a human.

```text
Submitted Document
       ↓
   Fragmentation
       ↓
Jaccard + Semantic Matching
       ↓
Best Matching Source Fragment
       ↓
Fragment → Source Map
       ↓
Explainable Decision
```

---

## Overview

Traditional whole-document similarity checks can hide the structure of a document assembled from multiple sources.

**Fragment Source Mapper** takes a different approach:

- Splits the submission into individual fragments.
- Compares every fragment against every reference source.
- Uses **Sentence-BERT semantic embeddings** and cosine similarity for semantic matching.
- Uses **Jaccard word overlap** as a lexical baseline.
- Identifies the best matching **source document and source sub-fragment**.
- Applies transparent, engine-specific thresholds.
- Provides a step-by-step **Trace This Result** explanation.
- Includes a live validation suite against declared demo ground truth.
- Runs entirely in the browser with **no backend, API key, or GPU**.

---

## Key Features

| Feature | Description |
|---|---|
| Fragment-level analysis | Maps individual submitted fragments instead of only whole documents |
| Semantic matching | `all-MiniLM-L6-v2` Sentence-BERT embeddings |
| Lexical baseline | Jaccard word-overlap comparison |
| Source mapping | Identifies the best source and matching sub-fragment |
| Explainability | Six-stage trace for every result |
| Live validation | Re-runs all bundled demos through the actual engine |
| Local inference | ONNX Runtime + WebAssembly in the browser |
| Fallback engine | Transparent TF-IDF-based illustrative engine |
| Presentation mode | Five-slide presentation using live analysis data |
| Theme support | Light/dark mode with OS preference detection |
| No backend | No server-side processing or API keys required |

---

## Quick Start

### Requirements

- **Node.js 18+**
- Modern browser
- Internet connection for the first Sentence-BERT model download

Tested with **Node.js 22**.

### Install

```powershell
cd "D:\Micro-Project Prototype"
npm install
```

### Development

```powershell
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

### Production Preview

For a presentation or final demonstration:

```powershell
npm run build
npm run preview
```

The production preview normally runs at:

```text
http://localhost:4173
```

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Type-check and create production build |
| `npm run preview` | Serve production build |
| `npm run typecheck` | Run TypeScript checking |

> The application is a client-side SPA and should be served through a web server. Opening `index.html` directly from the file system is not supported.

---

# Semantic Matching Engine

## Is the semantic model real?

**Yes. The semantic engine runs locally in the browser.**

The prototype uses:

| Component | Implementation |
|---|---|
| Model | `all-MiniLM-L6-v2` |
| Model type | Sentence-BERT sentence embeddings |
| Runtime | `@huggingface/transformers` |
| Execution | ONNX Runtime + WebAssembly |
| Embedding size | 384 dimensions |
| Pooling | Mean pooling |
| Normalisation | L2 normalisation |
| Similarity | Cosine similarity |
| Backend | None |
| API keys | None |
| GPU | Not required |

The model weights are downloaded from the Hugging Face CDN on the first run and subsequently cached by the browser.

The application also preloads the model in the background shortly after loading so that analysis normally does not need to wait for model initialisation.

### Verify the model yourself

Open the browser's Developer Tools:

```text
DevTools → Network
```

Then filter for:

```text
onnx
```

or:

```text
huggingface
```

The model files can be observed during the initial load.

The application's engine indicator also identifies which engine produced the displayed results.

---

# Illustrative Fallback Engine

If the Sentence-BERT model cannot be downloaded because of an offline environment, blocked CDN, or network restriction, the application can use a clearly labelled **Illustrative** engine.

The fallback uses:

- Stop-word removal
- Porter stemming
- TF-IDF vectors
- Cosine similarity
- A small curated paraphrase lexicon

The fallback is intentionally labelled **Illustrative**.

It is **not presented as a machine-learning result**.

This distinction is maintained throughout the interface, including:

- Run controls
- Warning banner
- Results
- Validation
- Trace panel
- Footer

The application therefore makes a clear distinction between:

```text
Sentence-BERT
Real semantic embedding model
            vs.
Illustrative
Heuristic TF-IDF baseline
```

---

# How It Works

The core pipeline is:

```text
1. Fragment
      ↓
2. Calculate Jaccard overlap
      ↓
3. Generate embeddings
      ↓
4. Calculate cosine similarity
      ↓
5. Rank source fragments
      ↓
6. Apply threshold
      ↓
7. Assign source / no source
```

For each submitted fragment, the engine compares it against the fragments belonging to every reference document.

The score assigned to a source is the **maximum cosine similarity** obtained against that source's fragments.

Therefore, the result identifies both:

```text
Best Source
     +
Best Matching Source Fragment
```

rather than only reporting a document-level score.

---

## Thresholds

Two decision thresholds are used:

| Engine | Strong Match | Possible Match |
|---|---:|---:|
| Sentence-BERT | `0.70` | `0.52` |
| Illustrative | `0.60` | `0.40` |

The thresholds are engine-specific and documented in the source code.

The final source ranking is determined by **cosine similarity**.

Jaccard is displayed as a separate lexical comparison and does **not** change the source ranking.

---

# Using the Application

### 1. Choose a demo or enter your own document

You can:

- Select a bundled demo.
- Paste text into the submission panel.
- Load a `.txt` file.

Then select **Analyze**.

### 2. Inspect the fragment map

The submitted document is divided into fragments.

Each fragment is visually connected to its best matching reference source.

### 3. Inspect the results table

For every fragment, the results table provides:

- Best source
- Matching source sub-fragment
- Cosine similarity
- Jaccard overlap
- Margin over the runner-up
- Scores for all reference sources
- Final threshold decision

### 4. Trace an individual result

Select:

```text
Trace This Result
```

to inspect the complete calculation for a specific fragment.

---

# Trace This Result

The trace panel provides an explainable six-stage pipeline.

```text
Fragment
   ↓
Jaccard
   ↓
Sentence-BERT
   ↓
Cosine
   ↓
Ranking
   ↓
Decision
```

| Stage | Information shown |
|---|---|
| **1 · Submitted Fragment** | Fragment text, engine, tokens, position and processing paths |
| **2 · Jaccard** | Token sets, intersection, union and actual calculation |
| **3 · SBERT** | Model, dimensions, pooling, normalisation and embedding values |
| **4 · Cosine** | Dot product, vector norms and calculated similarity |
| **5 · Ranking** | All sources ranked by cosine similarity |
| **6 · Decision** | Score, threshold, rule and final source assignment |

The trace panel uses the **intermediate values already produced by the engine**.

Nothing is recomputed solely for display.

This ensures that:

```text
Results Table
      =
Trace Panel
```

for the same analysis run.

Jaccard and Sentence-BERT are presented as **parallel evidence streams**.

Jaccard does not alter the semantic ranking.

---

# Live Validation

The **Validation** section re-runs all four bundled demonstrations through the actual analysis engine.

It compares:

```text
Declared Ground Truth
        vs.
Actual Engine Mapping
```

and reports:

- Expected source
- Actual source
- Fragment-level cosine
- PASS / FAIL status
- Engine used

Under the genuine Sentence-BERT engine, all four bundled cases pass.

The fallback engine is intentionally weaker on paraphrased examples, demonstrating the difference between lexical/heuristic matching and semantic embedding-based matching.

The validation system does **not** use pre-computed results.

---

# Demo Cases

| Demo | Purpose |
|---|---|
| **Single source** | All six fragments map to Source A |
| **Patchwork · multiple sources** | Fragments map to A, C, A, B, D, C |
| **Paraphrased patchwork** | Demonstrates semantic matching despite rewritten wording |
| **Mostly original** | Only two fragments receive source matches |

The paraphrased case is particularly useful for demonstrating the difference between lexical overlap and semantic similarity.

---

# Presentation Mode

The application includes a five-slide presentation mode.

Open:

```text
Presentation
```

from the application header.

### Slides

1. **What is patchwork plagiarism?**
2. **Fragmentation**
3. **Semantic matching**
4. **Source mapping**
5. **Final source map**

The presentation uses the application's live analysis where applicable.

Slides clearly distinguish between:

```text
Live data
```

and:

```text
Concept illustration
```

so illustrative graphics are not presented as measured results.

### Controls

Presentation navigation supports:

- `→`
- `←`
- `Space`
- `PageUp`
- `PageDown`
- On-screen controls
- Slide indicators
- `Esc` to close

Opening presentation mode without an active analysis automatically launches the patchwork demo.

---

# Comparison Section

The application includes a qualitative comparison between a conventional similarity-report workflow and the fragment-level approach used by this prototype.

### Illustrative reference

The reference panel is an **original hand-built mock**.

It is:

- Not an actual Turnitin report
- Not obtained from a commercial similarity service
- Not intended to reproduce a vendor interface
- Not a claim about any commercial system's results

It exists only to illustrate the difference between document-level similarity reporting and fragment-level source mapping.

### This prototype

The live panel displays:

- Current fragment
- Jaccard score
- Shared tokens
- Embedding information
- Cosine similarity
- Ranked sources
- Threshold decision
- Active engine

The two panels are independent and share no calculations.

> This is a qualitative workflow comparison, not a performance benchmark. No claim of superior accuracy is made.

---

# Project Structure

The main analysis logic is located in `src/lib/`.

| File | Responsibility |
|---|---|
| `text.ts` | Fragmentation, stop-words, Porter stemming and Jaccard |
| `sbert.ts` | Sentence-BERT model loading and sentence embeddings |
| `similarity.ts` | TF-IDF, synonym expansion and cosine calculations |
| `engine.ts` | Main analysis pipeline and source mapping |
| `trace.ts` | Explainability data for Trace This Result |
| `validate.ts` | Demo validation and ground-truth comparison |
| `lexicon.ts` | Paraphrase groups used by the illustrative engine |

The main pipeline is orchestrated by `engine.ts`:

```text
Fragment
   ↓
Jaccard
   ↓
Embedding
   ↓
Cosine
   ↓
Ranking
   ↓
Mapping
```

---

# Testing

## Calculation and Ranking Tests

Run:

```powershell
npm run test:calc
```

The calculation test suite checks the core algorithms and engine behaviour, including:

- Tokenisation
- Stop-word removal
- Stemming
- Fragmentation
- Jaccard calculation
- Jaccard detail generation
- Cosine calculation
- TF-IDF cosine range
- Cosine symmetry
- Engine-specific thresholds
- Source ranking
- Best-match selection
- Winning source sub-fragment
- Trace/result consistency
- Demo ground-truth expectations

---

## Browser End-to-End Tests

Build and start the production preview:

```powershell
npm run build
npm run preview
```

Install Playwright:

```powershell
npm i --no-save playwright
npx playwright install chromium
```

Run:

```powershell
node test/browser.mjs
```

The browser suite covers:

- All four demos
- Both analysis engines
- Theme switching
- Presentation mode
- Trace panel
- Trace/table numerical consistency
- Six-stage pipeline
- Validation
- Engine switching
- Comparison panels
- Passage/source interaction
- Empty-input state
- Console errors
- Page errors

Screenshots are written to:

```text
artifacts/
```

---

## Visual Inspection

A separate inspection script is available:

```powershell
node test/inspect.mjs
```

It checks selected UI areas including:

- Method section
- Comparison panels
- Light/dark themes
- Trace panel
- Mobile-width layout
- Keyboard interaction

---

# Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Hand-written CSS design system

### Machine Learning

- `@huggingface/transformers`
- `all-MiniLM-L6-v2`
- ONNX Runtime
- WebAssembly

### Algorithms

- Sentence embeddings
- Cosine similarity
- Jaccard similarity
- TF-IDF
- Porter stemming
- Tokenisation

### Testing

- Vite SSR test execution
- Playwright
- Chromium

### Fonts

- Inter
- Instrument Serif
- JetBrains Mono

The application falls back to system fonts when external font loading is unavailable.

---

# Architecture

```text
┌───────────────────────────────────────┐
│             React UI                  │
│ Results · Trace · Validation · Demo   │
└───────────────────┬───────────────────┘
                    │
┌───────────────────▼───────────────────┐
│          Analysis Engine              │
│ Fragment → Jaccard → Embed → Rank     │
└───────────────┬───────────┬───────────┘
                │           │
       ┌────────▼──────┐ ┌──▼───────────┐
       │ Sentence-BERT │ │ Illustrative │
       │ 384-D vectors │ │ TF-IDF       │
       │ ONNX / WASM   │ │ fallback     │
       └───────────────┘ └──────────────┘
                │           │
                └─────┬─────┘
                      ↓
              Fragment → Source
                   Mapping
```

The semantic engine and illustrative engine implement the same analysis interface, allowing the active engine to be switched without changing the rest of the application.

---

# Privacy and Data Flow

The prototype has **no backend server** and requires **no API key**.

For normal analysis:

```text
Document
   ↓
Browser
   ↓
Local analysis
   ↓
Results
```

The document itself does not need to be uploaded to a project server for analysis.

The only network dependency is the initial retrieval of the Sentence-BERT model weights when they are not already cached.

---

# Limitations

This prototype is intentionally scoped as a research/academic demonstration.

### 1. Similarity is not proof

A high similarity score is a **lead for human review**, not a plagiarism verdict.

### 2. Short fragments can be noisy

Very short fragments may produce unstable similarity scores.

### 3. Shared terminology can create false positives

Documents discussing the same technical topic may naturally contain similar language.

### 4. Citations and quotations are not modelled

A legitimate quotation can produce a high similarity score.

The prototype does not determine authorial intent.

### 5. Limited reference corpus

The bundled reference documents are short synthetic passages created for demonstration.

### 6. Language scope

The current implementation is primarily designed around English text.

### 7. Semantic similarity is not textual identity

Sentence-BERT measures semantic similarity. It does not establish that two passages were copied from one another.

### 8. Illustrative engine limitations

The fallback engine intentionally performs worse on paraphrased text.

This demonstrates why semantic embeddings are useful; its numbers should not be interpreted as machine-learning results.

---

# Research / Academic Scope

This project demonstrates the feasibility of **fragment-level source mapping** as an alternative way of presenting similarity evidence.

The prototype focuses on:

```text
Fragmentation
      +
Lexical Evidence
      +
Semantic Evidence
      +
Source Ranking
      +
Explainability
```

It is **not** intended to replace commercial plagiarism-detection systems, institutional academic-integrity processes, or human review.

---

# Reproducibility

To reproduce the prototype locally:

```powershell
git clone <repository-url>
cd <repository-folder>
npm install
npm run build
npm run preview
```

For development:

```powershell
npm run dev
```

For calculation tests:

```powershell
npm run test:calc
```

For browser testing:

```powershell
npm i --no-save playwright
npx playwright install chromium
node test/browser.mjs
```

---

# License

This project is an academic prototype developed for demonstration and evaluation purposes.

---

## Author

**Aditya Singh Tomar**
