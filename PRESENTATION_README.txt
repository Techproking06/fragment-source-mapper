FRAGMENT-LEVEL SOURCE MAPPING FOR PATCHWORK PLAGIARISM ANALYSIS
B.Tech Micro-Project - Final Presentation

Prepared by : Aditya Singh Tomar (BTMC25O1010), Aryaman Goyal (BTMC25O1021)
Submitted to : Dr. Dheeraj Kumar Dixit, Head of Department (HOD)
Department   : Engineering Mathematics and Computing (MAC), MITS Gwalior
Deck format  : 16:9 widescreen (13.333 x 7.5 in), 7 slides, speaker notes on every slide
Last verified: 22 October 2026


1. FILES
--------
Final deck
  D:\Micro-Project Prototype\Fragment_Source_Mapping_Micro_Project_Final.pptx

PDF preview (exported from the final deck)
  D:\Micro-Project Prototype\_deckbuild\Fragment_Source_Mapping_Micro_Project_Final.pdf

Rendered slide images (1920 x 1080)
  D:\Micro-Project Prototype\_deckbuild\render\Slide1.PNG ... Slide7.PNG

Editable build script (python-pptx)
  D:\Micro-Project Prototype\_deckbuild\build_deck.py

PowerPoint render/export script (pywin32)
  D:\Micro-Project Prototype\_deckbuild\render.py

Evidence images used in the deck
  D:\Micro-Project Prototype\_deckbuild\assets\source-map.png
  D:\Micro-Project Prototype\_deckbuild\assets\validation-4of4.png


2. SLIDE ORDER AND CONTENT
--------------------------
Slide 1 - Title
  Project title, both students and roll numbers, Dr. Dheeraj Kumar Dixit (HOD),
  Department of Engineering Mathematics and Computing (MAC), MITS Gwalior.
  Right panel: the actual patchwork-demo mapping (6 fragments, 4 sources) with
  cosine scores F1-A 0.93, F2-C 0.92, F3-A 0.93, F4-B 0.89, F5-D 0.87,
  F6-C 0.93; distribution A x2, C x2, B x1, D x1, 0 unmatched.

Slide 2 - Introduction
  Defines patchwork plagiarism (sentences stitched from several documents) and
  contrasts a whole-document score with a fragment-level source map.
  Visual: the actual demo mapping F1->A, F2->C, F3->A, F4->B, F5->D, F6->C
  with the four reference documents and their fragment counts.
  Key line: checkable leads for a reviewer, not a verdict.

Slide 3 - Objectives
  Four implemented objectives:
    01 fragment the submission;
    02 compare with Jaccard and Sentence-BERT plus cosine;
    03 map each fragment to its best source and sub-fragment using fixed thresholds;
    04 make the arithmetic and validation inspectable.
  Scope strip: 4 reference documents, 16 reference sub-fragments, 4 demo
  submissions, 2 analysis modes, browser-only (no server).

Slide 4 - Workflow / Methodology
  Native-shape diagram in the real order of computation:
    Input document -> Fragmentation -> two parallel evidence streams
    (Jaccard baseline and Sentence-BERT semantic) -> Cosine similarity ->
    Candidate source mapping -> Human review.
  The slide states clearly that Jaccard is lexical evidence and does not rank;
  only the cosine ranks and decides. Thresholds shown: >= 0.70 strong,
  0.52-0.69 possible, < 0.52 no source assigned.
  Worked arithmetic: F1-A1 Jaccard 10/19 = 0.53; cosine 0.9298 ~ 0.93.

Slide 5 - Results / Implementation
  Left: the actual source-map presentation view from the local build
  (website_visual_audit.pdf, page 34), patchwork demo.
  Right: a real fragment-to-source worked example for F1 -> Source A, A1:
    Jaccard 10 / 19 = 0.53 (10 shared stemmed tokens in the union of 19);
    cosine 0.9298 ~ 0.93 (dot 0.9298, both L2 norms 1.0000);
    all four sources ranked by cosine: A 0.93, D 0.46, B 0.20, C 0.00;
    best sub-fragment A1; 0.93 >= 0.70, so the UI labels a strong match.
  The card explains that each source is represented by its best-scoring
  sub-fragment and that the 0.70/0.52 thresholds drive the status.

Slide 6 - Results / Validation and Limitations
  Left: the actual validation view (website_visual_audit.pdf, page 38).
    Genuine Sentence-BERT run: 4/4 bundled demos reproduced their declared
    mapping. Negative control "Mostly original" leaves four fragments
    unmatched, so the tool can say "no source".
  Right and bottom:
    what the run establishes (4/4, negative control, explainability);
    what it does not establish (real-student accuracy, proof of plagiarism,
    a benchmark against commercial tools);
    reference scope (4 short synthetic documents x 4 sub-fragments, English
    only, closed demo set);
    fallback behaviour (if the ~23 MB SBERT weights cannot load, the app
    switches to a labelled illustrative TF-IDF heuristic; validation then
    reports 2/4 and shows the failures);
    why similarity is not proof (shared topic/vocabulary/citations can score
    highly; intent is not modelled; a human must verify the passage).

Slide 7 - Conclusion
  What was built, why it is useful, and the next step: a labelled, licensed
  reference corpus, calibrated thresholds, then quotation/citation awareness
  before any accuracy claim.
  Limits strip: 4 synthetic references, English only, 4 demo submissions,
  weaker offline fallback. Closing line: "A match is a lead, not a verdict."


3. EVIDENCE USED
----------------
All numbers in the deck are actual outputs of the local build. No score,
screenshot, test result, or comparison was invented.

Primary evidence
  - website_visual_audit.pdf, page 34: actual source-map presentation view
    (source-map.png). Values: F1->A 0.93, F2->C 0.92, F3->A 0.93,
    F4->B 0.89, F5->D 0.87, F6->C 0.93; A x2, C x2, B x1, D x1; 0 unmatched.
  - website_visual_audit.pdf, page 38: actual validation view
    (validation-4of4.png). Genuine SBERT: 4/4 PASS with per-fragment cosines
    and the declared expected mapping visible in the table.
  - src/lib/engine.ts: pipeline order, source ranking, thresholds 0.70/0.52.
  - src/lib/text.ts: stop-word removal, Porter stemming, Jaccard token sets,
    sentence fragmentation and short-sentence merging.
  - src/lib/sbert.ts: all-MiniLM-L6-v2, 384-dimensional vectors, mean pooling,
    L2 normalisation, ONNX/WebAssembly inference.
  - src/data/demos.ts: declared demo expectations and ground truth used by
    the validation view.
  - src/data/sources.ts: the four synthetic reference documents.
  - artifacts/hod-review/test-output.txt: earlier 22/22 test evidence and the
    fallback 2/4 result.

Re-verified on 22 October 2026 in this workspace
  - npm run test:calc  -> 22 tests, 22 pass, 0 fail.
  - npm run typecheck  -> clean (tsc --noEmit, no errors).
  - The test output also reports the illustrative fallback at 2/4: the
    single-source and paraphrased demos fail at F5, exactly as the deck says.


4. WHAT THE DECK DOES NOT CLAIM
-------------------------------
- It does not claim accuracy on real student submissions.
- It does not claim that a high cosine score proves plagiarism or intent.
- It does not claim superiority to Turnitin or any commercial service.
  No vendor comparison was run or obtained.
- It does not present the 4/4 validation as held-out evaluation. The test
  submissions and the expected mappings are declared in the same project;
  this is an internal consistency check on a closed demo set.
- It does not use illustrative or estimated numbers anywhere. The app has a
  separate, explicitly labelled illustrative TF-IDF fallback; it appears in
  the deck only as a described fallback with its real 2/4 validation result,
  never as if it were SBERT output.
- The app's side-by-side "illustrative reference panel" is not used in any
  slide.

Known limits, stated on the slides
  - 4 short synthetic reference documents, 4 sub-fragments each.
  - English only.
  - 4 bundled demo submissions.
  - The offline fallback is weaker and is labelled as illustrative.
  - No intent, citation, or quoted-material modelling.


5. PRESENTING
-------------
- Speaker notes are in the PowerPoint Notes pane for every slide. They contain
  a talk track with timing, transitions, and likely viva questions with short,
  truthful answers.
- Suggested pace: about 8-10 minutes for all seven slides, then questions.
  Slides 4-6 carry most of the explanation.
- The screenshots are evidence, but some UI text inside them is small on a
  projector. The important numbers are restated in large type in the cards
  beside each screenshot; use those when speaking.
- The deck is fully editable: all text, cards, the workflow diagram, and the
  connectors are native PowerPoint objects. The only images are the two
  genuine screenshots.
- No animations or transitions are required or configured.


6. VERIFICATION PERFORMED
-------------------------
- Created the PPTX with python-pptx from _deckbuild/build_deck.py.
- Exported all seven slides to PNG at 1920 x 1080 through PowerPoint COM and
  visually inspected every slide for clipping, overlap, broken connectors,
  inconsistent spacing, and unreadable text.
- Exported the final deck to PDF and opened the PDF preview.
- Reopened the final PPTX with python-pptx:
    7 slides; 13.333 x 7.5 in;
    every slide has non-empty speaker notes (1,249-2,135 characters);
    no shape extends outside the slide bounds;
    both screenshots keep their original aspect ratio (1.6009 vs 1.6000 and
    2.0000 vs 2.0000), so they are not stretched.
- Re-ran the calculation test suite and the TypeScript type check (results
  above).


7. REBUILDING
-------------
From D:\Micro-Project Prototype:

  python _deckbuild\build_deck.py
  python _deckbuild\render.py

build_deck.py regenerates the PPTX. render.py opens it in PowerPoint, exports
Slide1.PNG-Slide7.PNG and the PDF preview, then closes PowerPoint. Rendering
requires desktop PowerPoint and pywin32; building the PPTX itself only needs
python-pptx and Pillow.


8. FILES NOT PART OF THE DELIVERABLE
------------------------------------
The _deckbuild folder also contains extraction scripts, PDF page images,
crops, and an older desktop screenshot used during preparation. They are
working files, not part of the presentation. The deliverable is the PPTX
above, with this README and the PDF/PNG previews for convenience.
