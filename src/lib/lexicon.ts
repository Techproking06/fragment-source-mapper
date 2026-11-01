/**
 * Curated paraphrase groups for the ILLUSTRATIVE engine only.
 *
 * Each group lists surface words that carry the same meaning in this
 * prototype's corpus. Members are stemmed at load time. A token's vector
 * gets a reduced-weight contribution from its sibling members, which is how
 * "different words, same idea" survives in this heuristic model.
 *
 * This is NOT a language model. It exists so the prototype can still run —
 * and honestly label itself — when the Sentence-BERT weights are unavailable.
 */
export const PARAPHRASE_GROUPS: string[][] = [
  ['renewable', 'clean', 'green', 'sustainable'],
  ['electricity', 'power', 'energy'],
  ['emit', 'emission', 'release', 'discharge', 'pollute', 'pollutant'],
  ['greenhouse', 'co2', 'carbon', 'dioxide', 'gas', 'gase'],
  ['reduce', 'lower', 'cut', 'decrease', 'decline', 'fall', 'drop', 'shrink'],
  ['fuel', 'coal', 'fossil', 'burn', 'combust'],
  ['wind', 'solar', 'sun', 'sunlight', 'turbine'],
  ['intermittent', 'variable', 'fluctuate', 'continuous', 'continuously'],
  ['balance', 'match', 'reconcile'],
  ['supply', 'generation', 'generate', 'produce', 'production', 'output'],
  ['demand', 'consumption', 'usage', 'requirement'],
  ['storage', 'battery', 'batteries', 'store', 'surplus', 'excess', 'charge'],
  ['grid', 'transmission', 'infrastructure', 'network'],
  ['city', 'urban', 'municipal', 'street', 'district', 'metropolitan'],
  ['sensor', 'device', 'instrument', 'monitor', 'monitoring', 'detector'],
  ['particulate', 'particle', 'soot', 'dust', 'matter'],
  ['nitrogen', 'no2', 'ozone', 'nox'],
  ['air', 'atmosphere', 'breathe', 'breathing', 'respiratory', 'lung'],
  ['medical', 'health', 'healthcare', 'clinical', 'clinic', 'patient', 'hospital'],
  ['doctor', 'physician', 'clinician', 'specialist', 'human'],
  ['image', 'scan', 'picture', 'imaging', 'radiograph'],
  ['model', 'algorithm', 'system', 'machine', 'artificial', 'intelligence', 'deep', 'neural'],
  ['detect', 'pattern', 'spot', 'identify', 'recognise', 'recognize', 'notice', 'find'],
  ['diagnosis', 'diagnostic', 'classify', 'classification', 'accuracy', 'accurate', 'precision'],
  ['dataset', 'data', 'annotation', 'annotated', 'labelled', 'labeled', 'sample'],
  ['interpret', 'interpretability', 'explanation', 'transparent', 'transparency'],
  ['validate', 'validation', 'evaluate', 'evaluation', 'trust', 'reliable', 'reliance'],
  ['price', 'pricing', 'cost', 'financial', 'revenue', 'money', 'pay', 'payment', 'tax'],
  ['company', 'firm', 'polluter', 'corporation', 'industry', 'industrial', 'business'],
  ['permit', 'allowance', 'quota', 'cap', 'trade', 'market', 'allow'],
  ['climate', 'warming', 'temperature', 'environment', 'environmental', 'global'],
  ['policy', 'regulation', 'regulatory', 'government', 'coordination', 'governance'],
  ['citizen', 'resident', 'people', 'public', 'household', 'dividend', 'refund'],
  ['pollution', 'pollutant', 'smog', 'contamination'],
  ['traffic', 'vehicle', 'transport', 'intersection', 'road'],
  ['calibration', 'calibrate', 'drift', 'reference', 'standard', 'accuracy'],
  ['safe', 'safety', 'risk', 'danger', 'harmful'],
];
