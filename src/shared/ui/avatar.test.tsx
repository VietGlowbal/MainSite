import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';

describe('Avatar', () => {
  it('falls back to initials when an image URL fails to load', () => {
    render(
      <Avatar
        name="University of Birmingham"
        src="https://invalid.example/university-logo.png"
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'University of Birmingham' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('UB')).toBeInTheDocument();
  });

  it('tries a replacement URL after a previous source failed', () => {
    const { rerender } = render(<Avatar name="University of Birmingham" src="/old.png" />);
    fireEvent.error(screen.getByRole('img'));

    rerender(<Avatar name="University of Birmingham" src="/new.png" />);

    expect(screen.getByRole('img')).toHaveAttribute('src', '/new.png');
  });
});
