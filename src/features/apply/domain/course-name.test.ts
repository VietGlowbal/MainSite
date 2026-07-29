import { describe, expect, it } from 'vitest';
import { displayCourseName, isParsePending } from './course-name';

describe('isParsePending', () => {
  it('is true only while the worker has not settled the row', () => {
    expect(isParsePending('pending')).toBe(true);
    expect(isParsePending('processing')).toBe(true);
    expect(isParsePending('complete')).toBe(false);
    expect(isParsePending('failed')).toBe(false);
    expect(isParsePending('timeout')).toBe(false);
  });

  it('treats a missing status as settled', () => {
    // Rows predating the parse_status column. Assuming they are still parsing
    // would put every legacy application into a permanent polling loop.
    expect(isParsePending(null)).toBe(false);
    expect(isParsePending(undefined)).toBe(false);
  });
});

describe('displayCourseName', () => {
  it('withholds the name while the parse is running, whatever the column holds', () => {
    expect(displayCourseName('Loading course details...', 'pending')).toBeNull();
    // Even a plausible-looking value: mid-parse it is not yet trustworthy.
    expect(displayCourseName('BSc Computer Science', 'processing')).toBeNull();
  });

  it('rejects the placeholder on a settled row', () => {
    // A parse that failed before overwriting the name leaves the placeholder in
    // place — this is the case that put "Loading course details..." in an <h1>.
    expect(displayCourseName('Loading course details...', 'failed')).toBeNull();
    expect(displayCourseName('loading course details', 'complete')).toBeNull();
  });

  it('returns a real name once the parse has settled', () => {
    expect(displayCourseName('BSc Computer Science', 'complete')).toBe('BSc Computer Science');
    expect(displayCourseName('BSc Computer Science', null)).toBe('BSc Computer Science');
  });

  it('returns null for an empty or missing name', () => {
    expect(displayCourseName(null, 'complete')).toBeNull();
    expect(displayCourseName(undefined, 'complete')).toBeNull();
    expect(displayCourseName('', 'complete')).toBeNull();
  });

  it('does not swallow a course that merely starts with a similar word', () => {
    expect(displayCourseName('Loading Dock Engineering', 'complete')).toBe(
      'Loading Dock Engineering',
    );
  });
});
