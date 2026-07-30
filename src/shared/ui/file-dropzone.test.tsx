// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileDropzone } from './file-dropzone';
import { formatBytes } from './document-row';

function file(name: string, type = 'application/pdf', size = 1024): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('FileDropzone', () => {
  it('exposes a real file input, labelled and in the tab order', () => {
    // The whole accessibility argument for this component: drag-and-drop is
    // unreachable by keyboard, so the input has to be a genuine control rather
    // than display:none with a click handler on a div.
    render(<FileDropzone onFiles={vi.fn()} label="Click to upload CV" />);

    const input = screen.getByLabelText(/Click to upload CV/);
    expect(input).toHaveAttribute('type', 'file');
    expect(input).not.toHaveAttribute('hidden');
  });

  it('filters a drop by extension, which the browser does not do', () => {
    // `accept` is only enforced by the picker. A drop bypasses it entirely, so
    // without this the likeliest way to supply the wrong file is the one path
    // with no validation.
    const onFiles = vi.fn();
    const { container } = render(<FileDropzone onFiles={onFiles} accept=".pdf" />);
    const zone = container.querySelector('label')!;

    fireEvent.drop(zone, {
      dataTransfer: { files: [file('notes.txt', 'text/plain'), file('cv.pdf')] },
    });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]![0].map((f: File) => f.name)).toEqual(['cv.pdf']);
  });

  it('does not fire at all when a drop contains nothing acceptable', () => {
    const onFiles = vi.fn();
    const { container } = render(<FileDropzone onFiles={onFiles} accept=".pdf" />);

    fireEvent.drop(container.querySelector('label')!, {
      dataTransfer: { files: [file('notes.txt', 'text/plain')] },
    });

    expect(onFiles).not.toHaveBeenCalled();
  });

  it('keeps only the first file unless multiple is set', () => {
    const onFiles = vi.fn();
    const { container, rerender } = render(<FileDropzone onFiles={onFiles} />);

    fireEvent.drop(container.querySelector('label')!, {
      dataTransfer: { files: [file('a.pdf'), file('b.pdf')] },
    });
    expect(onFiles.mock.calls[0]![0]).toHaveLength(1);

    rerender(<FileDropzone onFiles={onFiles} multiple />);
    fireEvent.drop(container.querySelector('label')!, {
      dataTransfer: { files: [file('a.pdf'), file('b.pdf')] },
    });
    expect(onFiles.mock.calls[1]![0]).toHaveLength(2);
  });

  it('accepts a wildcard mime pattern', () => {
    const onFiles = vi.fn();
    const { container } = render(<FileDropzone onFiles={onFiles} accept="image/*" />);

    fireEvent.drop(container.querySelector('label')!, {
      dataTransfer: { files: [file('scan.png', 'image/png'), file('cv.pdf')] },
    });

    expect(onFiles.mock.calls[0]![0].map((f: File) => f.name)).toEqual(['scan.png']);
  });

  it('ignores a drop while disabled', () => {
    const onFiles = vi.fn();
    const { container } = render(<FileDropzone onFiles={onFiles} disabled />);

    fireEvent.drop(container.querySelector('label')!, {
      dataTransfer: { files: [file('cv.pdf')] },
    });

    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('formatBytes', () => {
  it('uses the units a file manager would show', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(204800)).toBe('200 KB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    // Past 10MB the decimal is noise.
    expect(formatBytes(1024 * 1024 * 12.4)).toBe('12 MB');
  });

  it('does not print a number it cannot compute', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
  });
});
