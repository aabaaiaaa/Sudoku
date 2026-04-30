import { describe, it, expect } from 'vitest';
import { GLOSSARY, type GlossaryTermId } from './glossary';

const EXPECTED_TERM_IDS: GlossaryTermId[] = [
  'candidate',
  'box',
  'pair',
  'chain',
  'cluster',
  'pivot-pincer',
  'placement',
  'elimination',
];

describe('GLOSSARY', () => {
  it('has an entry for every GlossaryTermId', () => {
    for (const id of EXPECTED_TERM_IDS) {
      expect(GLOSSARY[id], `missing entry for "${id}"`).toBeDefined();
    }
  });

  it('each entry id matches its key', () => {
    for (const id of EXPECTED_TERM_IDS) {
      expect(GLOSSARY[id].id).toBe(id);
    }
  });

  it('each entry has a non-empty term and definition', () => {
    for (const id of EXPECTED_TERM_IDS) {
      const entry = GLOSSARY[id];
      expect(entry.term.length).toBeGreaterThan(0);
      expect(entry.definition.length).toBeGreaterThan(0);
    }
  });

  it('each entry has a diagram function', () => {
    for (const id of EXPECTED_TERM_IDS) {
      expect(typeof GLOSSARY[id].diagram).toBe('function');
    }
  });

  it('has exactly 8 entries', () => {
    expect(Object.keys(GLOSSARY)).toHaveLength(8);
  });
});
