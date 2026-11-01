import type { SourceId } from '../lib/types';

export interface Demo {
  id: string;
  label: string;
  caption: string;
  /** what the presenter should expect to see */
  expected: string;
  /**
   * Ground truth for validation: the source each fragment should map to, in
   * fragment order. `null` = the fragment is expected to stay unmatched.
   * Derived from the demo text against the four bundled reference documents.
   */
  expectation: (SourceId | null)[];
  text: string;
}

/**
 * Four ready-made submissions. Every demo is compared against the same
 * four reference documents (Sources A–D), which is what makes the
 * fragment → source map readable at a glance.
 */
export const DEMOS: Demo[] = [
  {
    id: 'single',
    label: 'Single source',
    caption: 'Every fragment traces back to one document.',
    expected: 'All 6 fragments → Source A.',
    text: [
      'Wind and solar power generate electricity with no combustion of fossil fuels, so the greenhouse gases released into the atmosphere fall sharply.',
      'Grid operators face a continuous challenge, because sunlight and wind are intermittent and supply must be balanced against demand every second.',
      'Batteries let the surplus energy generated on a windy afternoon be stored and discharged later, exactly when demand peaks.',
      'The strongest wind and solar resources lie far from the cities where people actually live, so transmission networks have to be extended.',
      'Cables and substations therefore matter just as much as turbines and panels, because the best renewable resources sit far from the cities that need them.',
      'Battery storage decides how much of that wind and solar power is genuinely usable, since surplus output can be saved and released when demand peaks.',
    ].join(' '),
    expectation: ['A', 'A', 'A', 'A', 'A', 'A'],
  },
  {
    id: 'patchwork',
    label: 'Patchwork · multiple sources',
    caption: 'The main case: fragments stitched from four different documents.',
    expected: '6 fragments → A, C, A, B, D, C.',
    text: [
      'Renewable sources such as wind and solar generate electricity without combusting fossil fuels, sharply lowering greenhouse gas emissions.',
      'Machine learning models can recognise patterns in medical images that clinicians often overlook during a routine examination.',
      'Since sunlight and wind are intermittent, grid operators must continuously balance supply and demand with the help of storage.',
      'Sensors placed throughout a city record particulate matter and nitrogen dioxide at street level with fine spatial detail.',
      'Making polluters pay for every tonne of carbon they release gives them a direct financial reason to switch to cleaner production.',
      'Trained on large annotated datasets, deep networks now reach a level of diagnostic accuracy close to that of experienced specialists.',
    ].join(' '),
    expectation: ['A', 'C', 'A', 'B', 'D', 'C'],
  },
  {
    id: 'paraphrased',
    label: 'Paraphrased patchwork',
    caption: 'Same stitching, rewritten by an AI paraphraser — words change, meaning does not.',
    expected: 'Word overlap collapses; semantic similarity still maps A, C, A, B, D, C.',
    text: [
      'Electricity produced from wind turbines and solar panels involves no burning of coal or gas, so the greenhouse gases released into the air fall considerably.',
      'Artificial intelligence systems are able to spot structures in medical scans that trained doctors might miss during an ordinary check-up.',
      'Because the sun does not always shine and the wind does not always blow, grid managers must match generation with consumption every second using batteries and backup plants.',
      'Devices installed along city streets record levels of soot particles and nitrogen dioxide very close to where pedestrians breathe.',
      'Charging companies for each unit of carbon they emit encourages them to move toward less polluting ways of producing goods and services.',
      'After learning from vast collections of labelled images, such systems can classify disease about as accurately as a senior specialist.',
    ].join(' '),
    expectation: ['A', 'C', 'A', 'B', 'D', 'C'],
  },
  {
    id: 'original',
    label: 'Mostly original',
    caption: 'Only two fragments have a source; the rest are the student’s own writing.',
    expected: 'Fragments 1 and 4 map to B and D; the other four stay unmatched.',
    text: [
      'Short bursts of pollution are dangerous because they provoke respiratory problems in vulnerable residents within a few hours.',
      'Our group surveyed eighty undergraduates about their study habits during the second week of the semester.',
      'Each questionnaire held twelve closed questions and one open prompt, and every response was entered by hand into a shared spreadsheet.',
      'The money raised from a carbon tax can be handed straight back to citizens as a dividend, cushioning them against higher energy bills.',
      'We grouped the answers by year of study and produced one simple bar chart for every question.',
      'Two members of the team double-checked the entries, so the final counts differ very little from the raw forms.',
    ].join(' '),
    expectation: ['B', null, null, 'D', null, null],
  },
];

export const DEFAULT_DEMO = DEMOS[1];
