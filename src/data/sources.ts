import type { SourceDoc } from '../lib/types';

/**
 * The four reference documents every demo is compared against.
 * Texts are short synthetic passages written for this prototype so that the
 * fragment-level mapping is unambiguous to a human reader.
 */
export const SOURCES: SourceDoc[] = [
  {
    id: 'A',
    label: 'Source A',
    title: 'Renewable Energy and the Grid',
    kind: 'Textbook chapter',
    meta: 'Ch. 4 · Power Systems',
    text: [
      'Renewable energy sources such as wind and solar produce electricity without burning fossil fuels, which dramatically reduces greenhouse gas emissions.',
      'Because sunlight and wind are intermittent, grid operators must balance supply and demand in real time using storage and flexible generation.',
      'Large-scale battery storage allows surplus energy produced on sunny or windy days to be released later, when demand peaks.',
      'Upgrading transmission infrastructure is essential, since the best wind and solar resources are often located far from populated cities.',
    ].join(' '),
  },
  {
    id: 'B',
    label: 'Source B',
    title: 'Urban Air Quality Monitoring',
    kind: 'Journal article',
    meta: 'Vol. 12 · Environmental Sensors',
    text: [
      'Air quality sensors deployed across a city can track particulate matter and nitrogen dioxide at street level with high spatial resolution.',
      'Low-cost sensor networks let researchers identify pollution hotspots around traffic intersections and industrial districts.',
      'Continuous monitoring is vital, because short spikes in pollution cause respiratory problems for vulnerable residents.',
      'Calibration against reference stations is required, since inexpensive sensors tend to drift over time and lose accuracy.',
    ].join(' '),
  },
  {
    id: 'C',
    label: 'Source C',
    title: 'Machine Learning in Healthcare',
    kind: 'Conference paper',
    meta: 'ICML workshop · Clinical AI',
    text: [
      'Machine learning models can detect patterns in medical images that are difficult for human clinicians to notice during a routine examination.',
      'Deep neural networks trained on large annotated datasets achieve diagnostic accuracy comparable to that of experienced specialists.',
      'Despite their high performance, clinical deployment remains limited by the interpretability of predictions and concerns about patient safety.',
      'Prospective validation on data from several hospitals is necessary before such tools can be trusted in everyday practice.',
    ].join(' '),
  },
  {
    id: 'D',
    label: 'Source D',
    title: 'Climate Policy and Carbon Markets',
    kind: 'Policy report',
    meta: 'Section 2 · Carbon Pricing',
    text: [
      'Carbon pricing makes polluters pay for each tonne of emissions, creating a financial incentive to switch to cleaner production methods.',
      'Cap-and-trade systems set a declining ceiling on total emissions while allowing companies to buy and sell limited permits.',
      'Revenue from carbon taxes can be returned to citizens as dividends, which helps to offset higher energy prices.',
      'Without international coordination, firms may relocate production to regions with weaker regulation, a problem known as carbon leakage.',
    ].join(' '),
  },
];

export const SOURCE_MAP: Record<string, SourceDoc> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s]),
);

export const SOURCE_COLOR: Record<string, string> = {
  A: 'var(--src-a)',
  B: 'var(--src-b)',
  C: 'var(--src-c)',
  D: 'var(--src-d)',
};
