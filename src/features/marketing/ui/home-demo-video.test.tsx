import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HomeDemoVideo } from './home-demo-video';

describe('HomeDemoVideo', () => {
  it('does not mount video sources until the visitor presses play', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HomeDemoVideo
        title="GlowBal Matcher"
        video={{
          sources: [
            { src: '/home/features/glowbal-matcher.webm', type: 'video/webm' },
            { src: '/home/features/glowbal-matcher.mp4', type: 'video/mp4' },
          ],
        }}
      />,
    );

    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelectorAll('source')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Play GlowBal Matcher demo video' }));

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(container.querySelectorAll('source')).toHaveLength(2);
  });
});
