import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './modal';

describe('Modal', () => {
  it('traps Tab focus in both directions and returns focus on close', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const onClose = vi.fn();

    const { rerender } = render(
      <Modal open label="Test dialog" onClose={onClose}>
        <button>First</button>
        <button>Last</button>
      </Modal>,
    );

    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    expect(first).toHaveFocus();

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    rerender(
      <Modal open={false} label="Test dialog" onClose={onClose}>
        <button>First</button>
      </Modal>,
    );
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
