import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingGlobe } from '../landing-globe';

vi.mock('react-globe.gl', () => ({
  default: () => <div data-testid="webgl-globe" />,
}));

describe('LandingGlobe', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a static fallback without mounting the 3D globe when WebGL is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    render(<LandingGlobe theme="marble" size={320} />);

    expect(
      await screen.findByRole('img', { name: 'Decorative globe' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('webgl-globe')).not.toBeInTheDocument();
    });
  });
});
