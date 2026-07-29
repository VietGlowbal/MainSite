import { describe, expect, it } from 'vitest';
import {
  courseUrlLabel,
  displayCourseName,
  displayUniversityName,
  isParsePending,
} from './course-name';

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

describe('displayUniversityName', () => {
  it('rejects the insert placeholder, case and padding insensitively', () => {
    expect(displayUniversityName('Unknown University')).toBeNull();
    expect(displayUniversityName('unknown university')).toBeNull();
    expect(displayUniversityName('  Unknown University  ')).toBeNull();
  });

  it('keeps a real name regardless of parse state', () => {
    // Unlike the course name this is NOT withheld mid-parse: when the paste
    // matched the directory the name is real from the moment of insert.
    expect(displayUniversityName('University of Toronto')).toBe('University of Toronto');
  });

  it('does not swallow a university whose real name contains the word', () => {
    expect(displayUniversityName('University of the Unknown')).toBe('University of the Unknown');
  });

  it('returns null for an empty or missing name', () => {
    expect(displayUniversityName(null)).toBeNull();
    expect(displayUniversityName(undefined)).toBeNull();
    expect(displayUniversityName('')).toBeNull();
  });
});

describe('courseUrlLabel', () => {
  it('gives the host without the www prefix', () => {
    expect(courseUrlLabel('https://www.utoronto.ca/courses/cmp1')).toBe('utoronto.ca');
    expect(courseUrlLabel('https://future.utoronto.ca/apply')).toBe('future.utoronto.ca');
  });

  it('returns null rather than throwing on a value that is not a URL', () => {
    // The column is unconstrained and predates URL validation.
    expect(courseUrlLabel('utoronto.ca/courses')).toBeNull();
    expect(courseUrlLabel('')).toBeNull();
    expect(courseUrlLabel(null)).toBeNull();
    expect(courseUrlLabel(undefined)).toBeNull();
  });
});
