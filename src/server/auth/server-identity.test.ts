import { describe, expect, it } from 'vitest';
import { identityFromClaims } from './server-identity';

describe('identityFromClaims', () => {
  it('maps verified claims into the server identity used by page chrome', () => {
    expect(
      identityFromClaims({
        sub: 'user-1',
        email: 'student@example.com',
        user_metadata: { full_name: 'Student', avatar_url: 'https://example.com/avatar.png' },
      }),
    ).toEqual({
      id: 'user-1',
      email: 'student@example.com',
      name: 'Student',
      avatarUrl: 'https://example.com/avatar.png',
      userMetadata: { full_name: 'Student', avatar_url: 'https://example.com/avatar.png' },
    });
  });

  it('rejects claims without a subject', () => {
    expect(identityFromClaims({ email: 'student@example.com' })).toBeNull();
  });
});
