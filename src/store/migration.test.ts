import { beforeEach, describe, expect, it } from 'vitest';
import { hasOldSaves, removeOldSaves } from './migration';

describe('migration helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('hasOldSaves', () => {
    it('returns true when v1 keys exist', () => {
      window.localStorage.setItem('sudoku.save.v1', '{}');
      expect(hasOldSaves()).toBe(true);
    });

    it('returns true when v2 keys exist', () => {
      window.localStorage.setItem('sudoku.stats.v2', '{}');
      expect(hasOldSaves()).toBe(true);
    });

    it('returns true when a mix of v1 and v2 keys exist', () => {
      window.localStorage.setItem('sudoku.save.v1', '{}');
      window.localStorage.setItem('sudoku.stats.v2', '{}');
      window.localStorage.setItem('sudoku.settings.v1', '{}');
      window.localStorage.setItem('sudoku.settings.v2', '{}');
      expect(hasOldSaves()).toBe(true);
    });

    it('returns false when only v3 keys exist', () => {
      window.localStorage.setItem('sudoku.save.v3', '{}');
      window.localStorage.setItem('sudoku.stats.v3', '{}');
      window.localStorage.setItem('sudoku.settings.v3', '{}');
      expect(hasOldSaves()).toBe(false);
    });

    it('returns false when no keys exist', () => {
      expect(hasOldSaves()).toBe(false);
    });

    it('returns false for unrelated keys', () => {
      window.localStorage.setItem('someOtherApp.thing', 'value');
      window.localStorage.setItem('sudoku.save.v10', '{}');
      window.localStorage.setItem('sudoku.unrelated.v1', '{}');
      expect(hasOldSaves()).toBe(false);
    });
  });

  describe('removeOldSaves', () => {
    it('removes only v1 and v2 keys, leaving v3 keys intact', () => {
      window.localStorage.setItem('sudoku.save.v1', '{"v":1}');
      window.localStorage.setItem('sudoku.save.v2', '{"v":2}');
      window.localStorage.setItem('sudoku.save.v3', '{"v":3}');
      window.localStorage.setItem('sudoku.stats.v1', '{"v":1}');
      window.localStorage.setItem('sudoku.stats.v2', '{"v":2}');
      window.localStorage.setItem('sudoku.stats.v3', '{"v":3}');
      window.localStorage.setItem('sudoku.settings.v1', '{"v":1}');
      window.localStorage.setItem('sudoku.settings.v2', '{"v":2}');
      window.localStorage.setItem('sudoku.settings.v3', '{"v":3}');

      removeOldSaves();

      expect(window.localStorage.getItem('sudoku.save.v1')).toBeNull();
      expect(window.localStorage.getItem('sudoku.save.v2')).toBeNull();
      expect(window.localStorage.getItem('sudoku.stats.v1')).toBeNull();
      expect(window.localStorage.getItem('sudoku.stats.v2')).toBeNull();
      expect(window.localStorage.getItem('sudoku.settings.v1')).toBeNull();
      expect(window.localStorage.getItem('sudoku.settings.v2')).toBeNull();

      expect(window.localStorage.getItem('sudoku.save.v3')).toBe('{"v":3}');
      expect(window.localStorage.getItem('sudoku.stats.v3')).toBe('{"v":3}');
      expect(window.localStorage.getItem('sudoku.settings.v3')).toBe('{"v":3}');
    });

    it('is a no-op when there are no matching keys', () => {
      window.localStorage.setItem('sudoku.save.v3', '{"v":3}');
      window.localStorage.setItem('someOtherApp.thing', 'value');

      expect(() => removeOldSaves()).not.toThrow();

      expect(window.localStorage.length).toBe(2);
      expect(window.localStorage.getItem('sudoku.save.v3')).toBe('{"v":3}');
      expect(window.localStorage.getItem('someOtherApp.thing')).toBe('value');
    });

    it('does not delete unrelated keys', () => {
      window.localStorage.setItem('sudoku.save.v1', '{}');
      window.localStorage.setItem('someOtherApp.thing', 'value');
      window.localStorage.setItem('sudoku.save.v10', '{}');
      window.localStorage.setItem('sudoku.unrelated.v1', '{}');
      window.localStorage.setItem('not-sudoku.save.v1', '{}');

      removeOldSaves();

      expect(window.localStorage.getItem('sudoku.save.v1')).toBeNull();
      expect(window.localStorage.getItem('someOtherApp.thing')).toBe('value');
      expect(window.localStorage.getItem('sudoku.save.v10')).toBe('{}');
      expect(window.localStorage.getItem('sudoku.unrelated.v1')).toBe('{}');
      expect(window.localStorage.getItem('not-sudoku.save.v1')).toBe('{}');
    });

    it('removes all matching keys even when many are present (no index-shift bug)', () => {
      // Seed many matching keys interleaved with non-matching ones.
      // If removeOldSaves naively iterated and called removeItem in the same
      // pass, indices would shift and some keys would be missed.
      window.localStorage.setItem('sudoku.save.v1', 'a');
      window.localStorage.setItem('keep.1', 'a');
      window.localStorage.setItem('sudoku.save.v2', 'a');
      window.localStorage.setItem('keep.2', 'a');
      window.localStorage.setItem('sudoku.stats.v1', 'a');
      window.localStorage.setItem('keep.3', 'a');
      window.localStorage.setItem('sudoku.stats.v2', 'a');
      window.localStorage.setItem('keep.4', 'a');
      window.localStorage.setItem('sudoku.settings.v1', 'a');
      window.localStorage.setItem('keep.5', 'a');
      window.localStorage.setItem('sudoku.settings.v2', 'a');

      removeOldSaves();

      expect(hasOldSaves()).toBe(false);
      expect(window.localStorage.getItem('keep.1')).toBe('a');
      expect(window.localStorage.getItem('keep.2')).toBe('a');
      expect(window.localStorage.getItem('keep.3')).toBe('a');
      expect(window.localStorage.getItem('keep.4')).toBe('a');
      expect(window.localStorage.getItem('keep.5')).toBe('a');
    });
  });

  describe('explicit storage argument', () => {
    function makeStorage(): Storage {
      const map = new Map<string, string>();
      return {
        get length() {
          return map.size;
        },
        clear() {
          map.clear();
        },
        getItem(key: string) {
          return map.has(key) ? (map.get(key) as string) : null;
        },
        key(index: number) {
          return Array.from(map.keys())[index] ?? null;
        },
        removeItem(key: string) {
          map.delete(key);
        },
        setItem(key: string, value: string) {
          map.set(key, value);
        },
      };
    }

    it('hasOldSaves operates on the supplied storage instance', () => {
      const storage = makeStorage();
      storage.setItem('sudoku.save.v1', '{}');

      expect(hasOldSaves(storage)).toBe(true);
      // Default localStorage is untouched.
      expect(hasOldSaves()).toBe(false);
    });

    it('removeOldSaves operates on the supplied storage instance', () => {
      const storage = makeStorage();
      storage.setItem('sudoku.save.v1', '{}');
      storage.setItem('sudoku.save.v3', '{}');
      window.localStorage.setItem('sudoku.save.v1', '{}');

      removeOldSaves(storage);

      expect(storage.getItem('sudoku.save.v1')).toBeNull();
      expect(storage.getItem('sudoku.save.v3')).toBe('{}');
      // Default localStorage is untouched.
      expect(window.localStorage.getItem('sudoku.save.v1')).toBe('{}');
    });
  });
});
