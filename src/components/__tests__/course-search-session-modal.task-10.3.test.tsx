import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CourseSearchSessionModal } from '../course-search-session-modal';

// Mock Next.js router
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock Supabase client
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              nationality: 'United Kingdom',
              study_level: 'Undergraduate',
              grades_summary: { gpa: 3.5 },
              budget_range: '£20,000 - £30,000',
            },
            error: null,
          }),
        })),
      })),
    })),
  }),
}));

describe('CourseSearchSessionModal - Task 10.3: Form Submission and Search Execution', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    universityId: 123,
    universityName: 'Test University',
    universityDomain: 'test.edu',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
  });

  it('checks authentication and redirects if logged out', async () => {
    // Mock logged out state
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    global.fetch = vi.fn((url) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 1,
            courseAddLimit: 5,
            coursesAdded: 2,
            canCreateSession: true,
            upgradeRequired: false,
          }),
        });
      }
      if (url.includes('/api/course-search-sessions')) {
        // Logged-out / expired session -> API returns 401, modal redirects to auth.
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Unauthorized' }),
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    render(<CourseSearchSessionModal {...defaultProps} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });

    // Fill in course subject
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });

    // Click find courses button
    const findButton = screen.getByText(/Find course options/i);
    fireEvent.click(findButton);

    // Should redirect to auth page with an encoded redirect URL preserving context
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('/auth?redirect=')
      );
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('universityId%3D123')
      );
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('openCourseSearch%3Dtrue')
      );
    });
  });

  it('calls POST /api/course-search-sessions when logged in', async () => {
    const mockFetch = vi.fn((url) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 1,
            courseAddLimit: 5,
            coursesAdded: 2,
            canCreateSession: true,
            upgradeRequired: false,
          }),
        });
      }
      if (url === '/api/course-search-sessions') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            sessionId: 'test-session-123',
            status: 'complete',
            results: [
              {
                universityId: 123,
                courseName: 'Computer Science BSc',
                courseUrl: 'https://test.edu/courses/cs',
                sourceDomain: 'test.edu',
                snippet: 'A comprehensive computer science program',
                degreeLevel: 'Undergraduate',
                duration: '3 years',
                tuitionFeeText: '£9,250 per year',
                confidenceLabel: 'Good match',
                sourceConfidence: 0.85,
                rank: 1,
                sourceType: 'cached',
              },
            ],
            usage: {
              courseSearchesUsed: 2,
              courseSearchLimit: 3,
              coursesAdded: 2,
              courseAddLimit: 5,
              plan: 'free',
            },
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    global.fetch = mockFetch;

    render(<CourseSearchSessionModal {...defaultProps} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });

    // Fill in form
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });

    const studyLevelSelect = screen.getByLabelText(/Study level/i);
    fireEvent.change(studyLevelSelect, { target: { value: 'Undergraduate' } });

    // Click find courses button
    const findButton = screen.getByText(/Find course options/i);
    fireEvent.click(findButton);

    // Verify API was called with correct body
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/course-search-sessions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Computer Science'),
        })
      );
    });

    // Should transition to results step
    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ course options/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during search', async () => {
    let resolveSearch: any;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });

    global.fetch = vi.fn((url) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 1,
            courseAddLimit: 5,
            coursesAdded: 2,
            canCreateSession: true,
            upgradeRequired: false,
          }),
        });
      }
      if (url === '/api/course-search-sessions') {
        return searchPromise.then(() => ({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            sessionId: 'test-session-123',
            status: 'complete',
            results: [],
            usage: {
              courseSearchesUsed: 2,
              courseSearchLimit: 3,
              coursesAdded: 2,
              courseAddLimit: 5,
              plan: 'free',
            },
          }),
        }));
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    render(<CourseSearchSessionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });

    // Fill in course subject
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });

    // Click find courses button
    const findButton = screen.getByText(/Find course options/i);
    fireEvent.click(findButton);

    // Should show loading state with spinner
    await waitFor(() => {
      expect(screen.getByText(/Searching for courses/i)).toBeInTheDocument();
    });

    // Button should be disabled during loading
    expect(findButton).toBeDisabled();

    // Resolve the search
    resolveSearch();

    // Loading should disappear
    await waitFor(() => {
      expect(screen.queryByText(/Searching for courses/i)).not.toBeInTheDocument();
    });
  });

  it('handles API errors gracefully with retry option', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 1,
            courseAddLimit: 5,
            coursesAdded: 2,
            canCreateSession: true,
            upgradeRequired: false,
          }),
        });
      }
      if (url === '/api/course-search-sessions') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            error: 'Internal server error',
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    render(<CourseSearchSessionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });

    // Fill in course subject
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });

    // Click find courses button
    const findButton = screen.getByText(/Find course options/i);
    fireEvent.click(findButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Search Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
    });

    // Should have a retry button
    const retryButton = screen.getByText(/Try again/i);
    expect(retryButton).toBeInTheDocument();
  });

  it('handles timeout error (408)', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 1,
            courseAddLimit: 5,
            coursesAdded: 2,
            canCreateSession: true,
            upgradeRequired: false,
          }),
        });
      }
      if (url === '/api/course-search-sessions') {
        return Promise.resolve({
          ok: false,
          status: 408,
          json: () => Promise.resolve({
            error: 'The search took longer than expected. Please try again.',
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    render(<CourseSearchSessionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });

    // Fill in course subject
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });

    // Click find courses button
    fireEvent.click(screen.getByText(/Find course options/i));

    // Should show timeout error message (component maps 408 to a friendly message)
    await waitFor(() => {
      expect(screen.getByText(/Search temporarily unavailable\. Try again or use manual paste\./i)).toBeInTheDocument();
    });
  });

  it('shows quota warning when "Search again" is clicked', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 1,
            courseAddLimit: 5,
            coursesAdded: 2,
            canCreateSession: true,
            upgradeRequired: false,
          }),
        });
      }
      if (url === '/api/course-search-sessions') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            sessionId: 'test-session-123',
            status: 'complete',
            results: [],
            usage: {
              courseSearchesUsed: 2,
              courseSearchLimit: 3,
              coursesAdded: 2,
              courseAddLimit: 5,
              plan: 'free',
            },
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    render(<CourseSearchSessionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });

    // Fill in and submit form
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });
    fireEvent.click(screen.getByText(/Find course options/i));

    // Wait for results step
    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ course options/i)).toBeInTheDocument();
    });

    // Click "Search again"
    const searchAgainButton = screen.getByText(/Search again/i);
    fireEvent.click(searchAgainButton);

    // Should show quota warning
    await waitFor(() => {
      expect(screen.getByText(/Start a new search/i)).toBeInTheDocument();
      expect(screen.getByText(/1 of your 3 free university course searches/i)).toBeInTheDocument();
      expect(screen.getByText(/Each new search creates a new session/i)).toBeInTheDocument();
    });

    // Should have Cancel and Continue buttons
    expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
    expect(screen.getByText(/Continue with new search/i)).toBeInTheDocument();
  });

  it('allows canceling the quota warning', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 1,
            courseAddLimit: 5,
            coursesAdded: 2,
            canCreateSession: true,
            upgradeRequired: false,
          }),
        });
      }
      if (url === '/api/course-search-sessions') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            sessionId: 'test-session-123',
            status: 'complete',
            results: [],
            usage: {
              courseSearchesUsed: 2,
              courseSearchLimit: 3,
              coursesAdded: 2,
              courseAddLimit: 5,
              plan: 'free',
            },
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    render(<CourseSearchSessionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });

    // Submit form and get to results
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });
    fireEvent.click(screen.getByText(/Find course options/i));

    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ course options/i)).toBeInTheDocument();
    });

    // Show quota warning
    fireEvent.click(screen.getByText(/Search again/i));

    await waitFor(() => {
      expect(screen.getByText(/Start a new search/i)).toBeInTheDocument();
    });

    // Click Cancel
    fireEvent.click(screen.getByText(/Cancel/i));

    // Should return to results view
    await waitFor(() => {
      expect(screen.queryByText(/Start a new search/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Showing \d+ course options/i)).toBeInTheDocument();
    });
  });

  it('updates usage display after successful search', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 1,
            courseAddLimit: 5,
            coursesAdded: 2,
            canCreateSession: true,
            upgradeRequired: false,
          }),
        });
      }
      if (url === '/api/course-search-sessions') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            sessionId: 'test-session-123',
            status: 'complete',
            results: [],
            usage: {
              courseSearchesUsed: 2,
              courseSearchLimit: 3,
              coursesAdded: 2,
              courseAddLimit: 5,
              plan: 'free',
            },
          }),
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as any;

    render(<CourseSearchSessionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });

    // Initial usage should show 1 of 3
    expect(screen.getByText(/1 of 3 free university course searches used/i)).toBeInTheDocument();

    // Submit form
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });
    fireEvent.click(screen.getByText(/Find course options/i));

    // After search, usage should update to 2 of 3 in the quota warning
    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ course options/i)).toBeInTheDocument();
    });

    // Click Search again to see updated usage
    fireEvent.click(screen.getByText(/Search again/i));

    await waitFor(() => {
      expect(screen.getByText(/1 of your 3 free university course searches/i)).toBeInTheDocument();
    });
  });
});
