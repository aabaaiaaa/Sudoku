import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGameStore,
  type GenerationFailure,
  type GeneratorFactory,
} from '../store/game';
import type { GeneratorHandle } from '../workers/generator-client';
import { GenerationFailedDialog } from './GenerationFailedDialog';

/**
 * Generator factory that records each call. Returned handles never resolve,
 * so any `newGame` triggered by the dialog leaves the store in `loading: true`
 * without an actual worker spawn.
 */
function recordingGenerator(): {
  generator: GeneratorFactory;
  calls: Array<{ variantId: string; difficulty: string }>;
} {
  const calls: Array<{ variantId: string; difficulty: string }> = [];
  const generator: GeneratorFactory = (variant, difficulty) => {
    calls.push({ variantId: variant.id, difficulty });
    const handle: GeneratorHandle = {
      promise: new Promise(() => {}),
      cancel: () => {},
      onProgress: () => {},
    };
    return handle;
  };
  return { generator, calls };
}

function makeFailure(
  difficulty: GenerationFailure['difficulty'],
): GenerationFailure {
  return {
    difficulty,
    closestRating: null,
    attempts: 50,
    elapsedMs: 60_000,
  };
}

describe('GenerationFailedDialog', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing when generationFailure is null', () => {
    const store = createGameStore('classic');
    const { queryByTestId } = render(<GenerationFailedDialog store={store} />);
    expect(queryByTestId('generation-failed-dialog')).toBeNull();
  });

  it('renders a modal dialog when generationFailure is set', () => {
    const store = createGameStore('classic');
    store.setState({ generationFailure: makeFailure('Demonic') });

    const { getByTestId } = render(<GenerationFailedDialog store={store} />);

    const dialog = getByTestId('generation-failed-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('heading mentions the target tier', () => {
    const store = createGameStore('classic');
    store.setState({ generationFailure: makeFailure('Demonic') });

    const { getByTestId } = render(<GenerationFailedDialog store={store} />);

    const dialog = getByTestId('generation-failed-dialog');
    expect(dialog.textContent).toContain("Couldn't find a Demonic puzzle in time.");
  });

  it('renders body text explaining the situation', () => {
    const store = createGameStore('classic');
    store.setState({ generationFailure: makeFailure('Demonic') });

    const { getByTestId } = render(<GenerationFailedDialog store={store} />);

    const dialog = getByTestId('generation-failed-dialog');
    // Some flavour text — exact wording may evolve, but it should hint at
    // the retry option.
    expect(dialog.textContent?.toLowerCase()).toContain('retry');
  });

  it('renders Try-again, Try-easier, and Cancel when an easier tier exists', () => {
    const store = createGameStore('classic');
    store.setState({ generationFailure: makeFailure('Demonic') });

    const { getByTestId } = render(<GenerationFailedDialog store={store} />);

    expect(getByTestId('generation-failed-try-again')).toBeTruthy();
    expect(getByTestId('generation-failed-try-easier')).toBeTruthy();
    expect(getByTestId('generation-failed-cancel')).toBeTruthy();
  });

  it('Try-easier button label includes the next-easier tier name', () => {
    const store = createGameStore('classic');
    store.setState({ generationFailure: makeFailure('Demonic') });

    const { getByTestId } = render(<GenerationFailedDialog store={store} />);

    const btn = getByTestId('generation-failed-try-easier');
    expect(btn.textContent).toContain('Diabolical');
  });

  it('hides Try-easier when the failed target was Easy', () => {
    const store = createGameStore('classic');
    store.setState({ generationFailure: makeFailure('Easy') });

    const { getByTestId, queryByTestId } = render(
      <GenerationFailedDialog store={store} />,
    );

    expect(getByTestId('generation-failed-try-again')).toBeTruthy();
    expect(queryByTestId('generation-failed-try-easier')).toBeNull();
    expect(getByTestId('generation-failed-cancel')).toBeTruthy();
  });

  it('renders failure.lastError as a muted technical-details line when present', () => {
    const store = createGameStore('classic');
    store.setState({
      generationFailure: {
        ...makeFailure('Demonic'),
        lastError: 'Solver bailed out: cells exhausted',
      },
    });

    const { getByTestId } = render(<GenerationFailedDialog store={store} />);

    const errEl = getByTestId('failure-last-error');
    expect(errEl.textContent).toBe('Solver bailed out: cells exhausted');
  });

  it('does not render failure.lastError when it is absent', () => {
    const store = createGameStore('classic');
    store.setState({ generationFailure: makeFailure('Demonic') });

    const { queryByTestId } = render(<GenerationFailedDialog store={store} />);

    expect(queryByTestId('failure-last-error')).toBeNull();
  });

  it('renders diagnostic line for empty-string lastError', () => {
    // The user direction in iteration 3 was "always visible when present" —
    // an empty-string lastError still represents a present (non-null) error
    // signal from the worker, so the diagnostic line must still render.
    const store = createGameStore('classic');
    store.setState({
      generationFailure: {
        ...makeFailure('Demonic'),
        lastError: '',
      },
    });

    const { getByTestId } = render(<GenerationFailedDialog store={store} />);

    const errEl = getByTestId('failure-last-error');
    expect(errEl).toBeTruthy();
    expect(errEl.textContent).toBe('');
  });

  it('handles a lowercase difficulty value (Home picker convention) for the heading', () => {
    const store = createGameStore('classic');
    store.setState({
      // Cast through unknown — the static type expects a capitalized tier but
      // the runtime value coming through Home is lowercase, and the dialog
      // must render reasonably either way.
      generationFailure: makeFailure(
        'demonic' as unknown as GenerationFailure['difficulty'],
      ),
    });

    const { getByTestId } = render(<GenerationFailedDialog store={store} />);

    const dialog = getByTestId('generation-failed-dialog');
    expect(dialog.textContent).toContain('Demonic');
    expect(getByTestId('generation-failed-try-easier').textContent).toContain(
      'Diabolical',
    );
  });

  describe('actions', () => {
    it('Try-again invokes newGame with the current variant and difficulty', () => {
      const { generator, calls } = recordingGenerator();
      const store = createGameStore('classic', { generator });
      store.setState({
        generationFailure: makeFailure('Demonic'),
        difficulty: 'Demonic',
      });

      const { getByTestId } = render(<GenerationFailedDialog store={store} />);

      fireEvent.click(getByTestId('generation-failed-try-again'));

      expect(calls).toHaveLength(1);
      expect(calls[0].variantId).toBe('classic');
      expect(calls[0].difficulty).toBe('Demonic');
    });

    it('Try-easier invokes newGame with the next-easier tier', () => {
      const { generator, calls } = recordingGenerator();
      const store = createGameStore('classic', { generator });
      store.setState({
        generationFailure: makeFailure('Demonic'),
        difficulty: 'Demonic',
      });

      const { getByTestId } = render(<GenerationFailedDialog store={store} />);

      fireEvent.click(getByTestId('generation-failed-try-easier'));

      expect(calls).toHaveLength(1);
      expect(calls[0].variantId).toBe('classic');
      expect(calls[0].difficulty.toLowerCase()).toBe('diabolical');
    });

    it('Cancel clears generationFailure and invokes onCancel', () => {
      const store = createGameStore('classic');
      store.setState({ generationFailure: makeFailure('Demonic') });
      const onCancel = vi.fn();

      const { getByTestId, queryByTestId } = render(
        <GenerationFailedDialog store={store} onCancel={onCancel} />,
      );

      fireEvent.click(getByTestId('generation-failed-cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(store.getState().generationFailure).toBeNull();
      expect(queryByTestId('generation-failed-dialog')).toBeNull();
    });

    it('Cancel works without an onCancel handler', () => {
      const store = createGameStore('classic');
      store.setState({ generationFailure: makeFailure('Demonic') });

      const { getByTestId } = render(<GenerationFailedDialog store={store} />);

      // Should not throw.
      fireEvent.click(getByTestId('generation-failed-cancel'));
      expect(store.getState().generationFailure).toBeNull();
    });
  });

  describe('focus management', () => {
    it('Escape closes the dialog and invokes onCancel', () => {
      const store = createGameStore('classic');
      store.setState({ generationFailure: makeFailure('Demonic') });
      const onCancel = vi.fn();

      const { queryByTestId } = render(
        <GenerationFailedDialog store={store} onCancel={onCancel} />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(store.getState().generationFailure).toBeNull();
      expect(queryByTestId('generation-failed-dialog')).toBeNull();
    });

    it('focuses the first action button when the dialog opens', () => {
      const store = createGameStore('classic');
      store.setState({ generationFailure: makeFailure('Demonic') });

      const { getByTestId } = render(<GenerationFailedDialog store={store} />);

      // First focusable button is "Try again".
      expect(document.activeElement).toBe(
        getByTestId('generation-failed-try-again'),
      );
    });

    it('restores focus to the previously-focused element after closing', () => {
      // Stage a focusable element outside the dialog.
      const trigger = document.createElement('button');
      trigger.setAttribute('data-testid', 'external-trigger');
      document.body.appendChild(trigger);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      const store = createGameStore('classic');
      store.setState({ generationFailure: makeFailure('Demonic') });

      const { getByTestId } = render(<GenerationFailedDialog store={store} />);

      // Trap moved focus into the dialog.
      expect(document.activeElement).toBe(
        getByTestId('generation-failed-try-again'),
      );

      // Cancelling clears the failure → the dialog returns null and the trap
      // deactivates, restoring focus to `trigger`.
      fireEvent.click(getByTestId('generation-failed-cancel'));

      expect(document.activeElement).toBe(trigger);

      trigger.remove();
    });
  });
});
