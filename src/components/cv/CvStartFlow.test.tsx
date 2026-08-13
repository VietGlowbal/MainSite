import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CvStartFlow } from './CvStartFlow';

describe('CvStartFlow', () => {
  it('requires a format, then sends both actions through that format', async () => {
    render(<CvStartFlow applicationId="app-1" />);

    expect(screen.queryByRole('link', { name: 'Start building your CV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Upload' })).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Choose now' })[0]);
    expect(screen.getByRole('link', { name: 'Start building your CV' })).toHaveAttribute(
      'href',
      '/apply/app-1/cv-builder?template=technical',
    );
    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'href',
      '/apply/app-1/cv-review?template=technical',
    );

    await userEvent.click(screen.getAllByRole('button', { name: 'Choose now' })[1]);
    expect(screen.getByRole('link', { name: 'Start building your CV' })).toHaveAttribute(
      'href',
      '/apply/app-1/cv-builder?template=academic',
    );
  });
});
