/**
 * Tests for `<ConfirmDialog>` covering keyboard dismissal and focus trap
 * integration (requirements §10). Click-driven flows for confirm/cancel are
 * already exercised end-to-end through `Home.test.tsx`; this file covers the
 * accessibility behaviours layered on top by TASK-038.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when open is false', () => {
    const { queryByTestId } = render(
      <ConfirmDialog
        open={false}
        title="Replace save?"
        body="A save already exists."
        confirmLabel="Replace"
        cancelLabel="Keep"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(queryByTestId('confirm-dialog')).toBeNull();
  });

  it('renders a modal dialog with the supplied title and body when open', () => {
    const { getByTestId } = render(
      <ConfirmDialog
        open={true}
        title="Replace save?"
        body="A save already exists for classic/easy."
        confirmLabel="Replace"
        cancelLabel="Keep"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = getByTestId('confirm-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Replace save?');
    expect(dialog.textContent).toContain('A save already exists for classic/easy.');
  });

  it('clicking confirm invokes onConfirm', () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(
      <ConfirmDialog
        open={true}
        title="t"
        body="b"
        confirmLabel="OK"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(getByTestId('confirm-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('clicking cancel invokes onCancel', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <ConfirmDialog
        open={true}
        title="t"
        body="b"
        confirmLabel="OK"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(getByTestId('confirm-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  describe('focus management', () => {
    it('Escape invokes onCancel', () => {
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          open={true}
          title="t"
          body="b"
          confirmLabel="OK"
          cancelLabel="No"
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('focuses the confirm button when the dialog opens', () => {
      const { getByTestId } = render(
        <ConfirmDialog
          open={true}
          title="t"
          body="b"
          confirmLabel="OK"
          cancelLabel="No"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      // The confirm button is the first focusable element in the dialog.
      expect(document.activeElement).toBe(getByTestId('confirm-dialog-confirm'));
    });

    it('Tab from the cancel button cycles focus back to confirm', () => {
      const { getByTestId } = render(
        <ConfirmDialog
          open={true}
          title="t"
          body="b"
          confirmLabel="OK"
          cancelLabel="No"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const confirmBtn = getByTestId('confirm-dialog-confirm');
      const cancelBtn = getByTestId('confirm-dialog-cancel');

      cancelBtn.focus();
      expect(document.activeElement).toBe(cancelBtn);

      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(confirmBtn);
    });

    it('Shift+Tab from the confirm button cycles focus to cancel', () => {
      const { getByTestId } = render(
        <ConfirmDialog
          open={true}
          title="t"
          body="b"
          confirmLabel="OK"
          cancelLabel="No"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const confirmBtn = getByTestId('confirm-dialog-confirm');
      const cancelBtn = getByTestId('confirm-dialog-cancel');

      confirmBtn.focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(cancelBtn);
    });

    it('restores focus to the previously-focused element on close', () => {
      const trigger = document.createElement('button');
      trigger.setAttribute('data-testid', 'external-trigger');
      document.body.appendChild(trigger);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      const { rerender, getByTestId } = render(
        <ConfirmDialog
          open={true}
          title="t"
          body="b"
          confirmLabel="OK"
          cancelLabel="No"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      // Trap activated → focus is now inside the dialog.
      expect(document.activeElement).toBe(getByTestId('confirm-dialog-confirm'));

      rerender(
        <ConfirmDialog
          open={false}
          title="t"
          body="b"
          confirmLabel="OK"
          cancelLabel="No"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(document.activeElement).toBe(trigger);

      trigger.remove();
    });
  });
});
