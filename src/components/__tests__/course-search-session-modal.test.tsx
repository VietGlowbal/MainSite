import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Hoisted mock functions so the vi.mock factory below stays self-contained
// (referencing top-level consts inside a vi.mock factory triggers a TDZ error
// because vi.mock is hoisted above them).
const { mockGetUserFn, mockProfileSingleFn } = vi.hoisted(() => ({
  mockGetUserFn: vi.fn(),
  mockProfileSingleFn: vi.fn(),
}));

const DEFAULT_PROFILE = {
  user_id: 'test-user-id',
  nationality: 'United Kingdom',
  study_level: 'Undergraduate',
  grades_summary: { gpa: 3.5 },
  budget_range: '£20,000 - £30,000',
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUserFn,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockProfileSingleFn,
        })),
      })),
    })),
  }),
}));

// Default fetch mock for entitlements and course search APIs. Installed before
// every test so individual tests that reassign global.fetch don't leak into
// subsequent tests.
function installDefaultFetch() {
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
}

installDefaultFetch();

describe('CourseSearchSessionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    universityId: 123,
    universityName: 'Test University',
    universityDomain: 'test.edu',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset fetch to the default so tests that override it stay isolated.
    installDefaultFetch();

    // Reset mock to authenticated state with a default student profile.
    mockGetUserFn.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockProfileSingleFn.mockResolvedValue({
      data: { ...DEFAULT_PROFILE },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when isOpen is true', () => {
    render(<CourseSearchSessionModal {...defaultProps} />);
    
    expect(screen.getByText(/Find a course at Test University/i)).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    render(<CourseSearchSessionModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText(/Find a course at Test University/i)).not.toBeInTheDocument();
  });

  it('displays university information correctly', () => {
    render(<CourseSearchSessionModal {...defaultProps} />);
    
    expect(screen.getByText((content, element) => {
      return element?.textContent === 'Find a course at Test University';
    })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<CourseSearchSessionModal {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText(/close modal/i);
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<CourseSearchSessionModal {...defaultProps} onClose={onClose} />);
    
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts at confirm step', async () => {
    render(<CourseSearchSessionModal {...defaultProps} />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });
    
    // Should show the course subject input
    expect(screen.getByLabelText(/What course or subject are you interested in/i)).toBeInTheDocument();
  });

  it('navigates from confirm to results step', async () => {
    render(<CourseSearchSessionModal {...defaultProps} />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
    });
    
    // Fill in required field
    const courseInput = screen.getByLabelText(/What course or subject are you interested in/i);
    fireEvent.change(courseInput, { target: { value: 'Computer Science' } });
    
    // Click find courses button
    const findButton = screen.getByText(/Find course options/i);
    fireEvent.click(findButton);
    
    // Should transition to results step
    await waitFor(() => {
      expect(screen.getByText(/Showing 1 course options/i)).toBeInTheDocument();
    });
  });

  it('shows step indicators', () => {
    render(<CourseSearchSessionModal {...defaultProps} />);
    
    const stepIndicators = screen.getAllByLabelText(/Step \d/);
    expect(stepIndicators).toHaveLength(3);
    expect(screen.getByLabelText('Step 1: Confirm')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 2: Results')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 3: Added')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<CourseSearchSessionModal {...defaultProps} />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'course-search-modal-title');
  });

  it('has proper modal structure with header, body, and footer', () => {
    const { container } = render(<CourseSearchSessionModal {...defaultProps} />);
    
    // Check for header with title
    expect(screen.getByRole('heading', { name: /Find a course at Test University/i })).toBeInTheDocument();
    
    // Check for close button
    expect(screen.getByLabelText(/close modal/i)).toBeInTheDocument();
    
    // Check for footer with step indicators
    expect(screen.getByLabelText('Step 1: Confirm')).toBeInTheDocument();
  });

  // Task 10.2 Specific Tests
  describe('Task 10.2: Step 1 - Confirm Details', () => {
    it('displays university name prominently in header', () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      const heading = screen.getByRole('heading', { name: /Find a course at Test University/i });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toContain('Test University');
    });

    it('has course subject input field marked as required', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('placeholder');
    });

    it('has study level dropdown with correct options', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      const dropdown = screen.getByLabelText(/Study level/i);
      expect(dropdown).toBeInTheDocument();
      expect(dropdown.tagName).toBe('SELECT');
      
      const options = Array.from((dropdown as HTMLSelectElement).options).map(opt => opt.value);
      expect(options).toContain('Undergraduate');
      expect(options).toContain('Postgraduate Taught');
      expect(options).toContain('Postgraduate Research');
      expect(options).toContain('Foundation');
    });

    it('prefills study level from user profile', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      const dropdown = screen.getByLabelText(/Study level/i) as HTMLSelectElement;
      
      // Should be prefilled with 'Undergraduate' from mock profile
      await waitFor(() => {
        expect(dropdown.value).toBe('Undergraduate');
      });
    });

    it('displays user profile information', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Profile section should be visible
      await waitFor(() => {
        expect(screen.getByText(/Your Profile/i)).toBeInTheDocument();
        expect(screen.getByText(/United Kingdom/i)).toBeInTheDocument();
        expect(screen.getByText(/£20,000 - £30,000/i)).toBeInTheDocument();
      });
    });

    it('displays usage state correctly', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Should show usage: 1 of 3 searches used
      await waitFor(() => {
        expect(screen.getByText(/1 of 3 free university course searches used/i)).toBeInTheDocument();
      });
    });

    it('has Find course options CTA button', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      const button = screen.getByText(/Find course options/i);
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    it('disables button when course subject is empty', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      const button = screen.getByText(/Find course options/i);
      expect(button).toBeDisabled();
    });

    it('enables button when course subject is filled', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      const button = screen.getByText(/Find course options/i);
      expect(button).not.toBeDisabled();
    });

    it('shows validation error when submitting empty form', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: '' } });
      
      const button = screen.getByText(/Find course options/i);
      expect(button).toBeDisabled();
    });
  });

  describe('Task 10.2: Upgrade Prompt When At Limit', () => {
    beforeEach(() => {
      // Mock fetch to return user at limit
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/entitlements/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plan: 'free',
              courseSearchLimit: 3,
              courseSearchesUsed: 3,
              courseAddLimit: 5,
              coursesAdded: 2,
              canCreateSession: false,
              upgradeRequired: true,
              limitReason: 'You have reached your free search limit. Upgrade to continue searching.',
            }),
          });
        }
        return Promise.reject(new Error('Not found'));
      }) as any;
    });

    it('disables button when user is at limit', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill in subject
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Button should still be disabled due to limit
      const button = screen.getByText(/Find course options/i);
      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });

    it('shows upgrade prompt when user is at limit', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Should show upgrade message
      await waitFor(() => {
        expect(screen.getByText(/Upgrade Required/i)).toBeInTheDocument();
        expect(screen.getByText(/You have reached your free search limit/i)).toBeInTheDocument();
        expect(screen.getByText(/Upgrade to GlowBal Plus/i)).toBeInTheDocument();
      });
    });

    it('shows upgrade link when at limit', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      await waitFor(() => {
        const upgradeLink = screen.getByText(/Upgrade to GlowBal Plus/i);
        expect(upgradeLink).toBeInTheDocument();
        expect(upgradeLink.tagName).toBe('A');
        expect(upgradeLink).toHaveAttribute('href', '/plus');
      });
    });
  });

  describe('Task 10.3: Form Submission and Search Execution', () => {
    beforeEach(() => {
      // Reset fetch mock to normal state
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
    });

    it('calls POST /api/course-search-sessions on form submission', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill in course subject
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Should call the API
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/course-search-sessions',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('Computer Science'),
          })
        );
      });
    });

    it('shows loading state during search', async () => {
      // Use a search request that stays pending so the loading state is
      // observable (otherwise it resolves before we can assert).
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
          return new Promise(() => {}); // never resolves
        }
        return Promise.reject(new Error('Not found'));
      }) as any;

      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill in course subject
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Should show loading state once the search request is in flight
      await waitFor(() => {
        expect(screen.getByText(/Searching for courses/i)).toBeInTheDocument();
      });
    });

    it('transitions to results step on successful search', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill in course subject
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Should transition to results - look for the results summary
      await waitFor(() => {
        expect(screen.getByText(/Showing 1 course options/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('handles API error and displays error message', async () => {
      // Mock API error
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
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Search Error/i)).toBeInTheDocument();
        expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      // Mock API error
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
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
              error: 'Failed to search',
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
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Should show retry button
      await waitFor(() => {
        expect(screen.getByText(/Try again/i)).toBeInTheDocument();
      });
    });

    it('handles 403 quota exceeded error', async () => {
      // Mock quota exceeded error
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
          return Promise.resolve({
            ok: false,
            status: 403,
            json: () => Promise.resolve({
              error: 'You have reached your search limit for this month.',
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
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Should show quota error
      await waitFor(() => {
        expect(screen.getByText(/You have reached your search limit for this month/i)).toBeInTheDocument();
      });
    });

    it('handles 408 timeout error', async () => {
      // Mock timeout error
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
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Should show timeout error (component maps 408 to a user-friendly message)
      await waitFor(() => {
        expect(screen.getByText(/Search temporarily unavailable\. Try again or use manual paste\./i)).toBeInTheDocument();
      });
    });

    it('updates usage data after successful search', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Check initial usage (1 of 3)
      expect(screen.getByText(/1 of 3 free university course searches used/i)).toBeInTheDocument();
      
      // Fill in course subject
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/Showing 1 course options/i)).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Click "Search again" to go back to confirm step
      const searchAgainButton = screen.getByText(/Search again/i);
      fireEvent.click(searchAgainButton);
      
      // Should show quota warning
      await waitFor(() => {
        expect(screen.getByText(/Start a new search/i)).toBeInTheDocument();
      });
    });
  });

  describe('Task 10.3: Quota Warning', () => {
    it('shows quota warning when clicking "Search again"', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill in and submit form
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/Showing 1 course options/i)).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Click "Search again"
      const searchAgainButton = screen.getByText(/Search again/i);
      fireEvent.click(searchAgainButton);
      
      // Should show quota warning
      await waitFor(() => {
        expect(screen.getByText(/Start a new search/i)).toBeInTheDocument();
        expect(screen.getByText(/1 of your 3 free university course searches/i)).toBeInTheDocument();
        expect(screen.getByText(/Each new search creates a new session and counts toward your quota/i)).toBeInTheDocument();
      });
    });

    it('allows canceling quota warning', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill in and submit form
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/Showing 1 course options/i)).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Click "Search again"
      const searchAgainButton = screen.getByText(/Search again/i);
      fireEvent.click(searchAgainButton);
      
      // Should show quota warning
      await waitFor(() => {
        expect(screen.getByText(/Start a new search/i)).toBeInTheDocument();
      });
      
      // Click cancel
      const cancelButton = screen.getByText(/Cancel/i);
      fireEvent.click(cancelButton);
      
      // Should go back to results (not showing warning)
      await waitFor(() => {
        expect(screen.queryByText(/Start a new search/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Showing 1 course options/i)).toBeInTheDocument();
      });
    });

    it('allows confirming quota warning and returning to confirm step', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill in and submit form
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/Showing 1 course options/i)).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Click "Search again"
      const searchAgainButton = screen.getByText(/Search again/i);
      fireEvent.click(searchAgainButton);
      
      // Should show quota warning
      await waitFor(() => {
        expect(screen.getByText(/Start a new search/i)).toBeInTheDocument();
      });
      
      // Click confirm
      const confirmButton = screen.getByText(/Continue with new search/i);
      fireEvent.click(confirmButton);
      
      // Should return to confirm step
      await waitFor(() => {
        expect(screen.getByLabelText(/What course or subject are you interested in/i)).toBeInTheDocument();
      });
    });
  });

  describe('Task 10.3: Authentication Flow', () => {
    it('redirects to auth page when the search API returns 401', async () => {
      // Anonymous searches are allowed (Task 17); the modal redirects to auth
      // only when the search API responds with 401 (e.g. expired session).
      mockGetUserFn.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
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
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Unauthorized' }),
          });
        }
        return Promise.reject(new Error('Not found'));
      }) as any;

      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill in course subject
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      // Click find courses button
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Should redirect to auth page
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('/auth')
        );
      });
    });
  });

  /**
   * Task 10.4: Build Step 2 - Review course options with selection feedback
   */
  describe('Task 10.4: Step 2 - Review Course Options', () => {
    const defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      universityId: 123,
      universityName: 'Test University',
      universityDomain: 'test.edu',
    };

    beforeEach(() => {
      // Reset mocks
      mockPush.mockClear();
      vi.clearAllMocks();
    });

    it('displays session query summary with result count', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Fill form and submit
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      
      const button = screen.getByText(/Find course options/i);
      fireEvent.click(button);
      
      // Wait for results to appear
      await waitFor(() => {
        expect(screen.getByText(/Showing 1 course options/i)).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Should show query details (use getAllByText since the query/university
      // also appear inside the course cards)
      expect(screen.getAllByText(/Computer Science/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Test University/i).length).toBeGreaterThan(0);
    });

    it('renders CourseResultCard components for each result', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Check for course card elements
      expect(screen.getByText('Good match')).toBeInTheDocument();
      expect(screen.getByText(/comprehensive computer science program/i)).toBeInTheDocument();
    });

    it('shows selected count when no courses selected', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/0 courses selected/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('updates selected count when courses are selected', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Click on the course card to select it
      const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
      if (courseCard) {
        fireEvent.click(courseCard);
      }
      
      // Should show 1 course selected
      await waitFor(() => {
        expect(screen.getByText(/1 course selected/i)).toBeInTheDocument();
      });
    });

    it('shows remaining slots message for free plan', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results and check remaining slots message
      await waitFor(() => {
        expect(screen.getByText(/You can add 3 more courses on your free plan/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('disables "Add courses" button when no courses selected', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Find "Add courses" button and check it's disabled
      const addButton = screen.getByText(/Add.*courses to Apply/i);
      expect(addButton).toBeDisabled();
    });

    it('enables "Add courses" button when courses are selected', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Select a course
      const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
      if (courseCard) {
        fireEvent.click(courseCard);
      }
      
      // Find "Add courses" button and check it's enabled
      await waitFor(() => {
        const addButton = screen.getByText(/Add 1 course to Apply/i);
        expect(addButton).not.toBeDisabled();
      });
    });

    it('shows "Search again" link', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Check for "Search again" button
      expect(screen.getByText(/Search again/i)).toBeInTheDocument();
    });

    it('shows "View official course directory" fallback link', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Check for fallback link
      const fallbackLink = screen.getByText(/View official course directory/i);
      expect(fallbackLink).toBeInTheDocument();
      expect(fallbackLink.closest('a')).toHaveAttribute('href', 'https://test.edu');
      expect(fallbackLink.closest('a')).toHaveAttribute('target', '_blank');
    });

    it('shows over-limit warning when selection exceeds remaining slots', async () => {
      // Mock entitlement with 0 remaining slots
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/entitlements/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              plan: 'free',
              courseSearchLimit: 3,
              courseSearchesUsed: 1,
              courseAddLimit: 5,
              coursesAdded: 5, // Already at limit
              canCreateSession: true,
              upgradeRequired: false,
            }),
          });
        }
        if (url.includes('/api/course-search-sessions')) {
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
                coursesAdded: 5, // At limit
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
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Select a course (which exceeds limit)
      const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
      if (courseCard) {
        fireEvent.click(courseCard);
      }
      
      // Should show over-limit warning
      await waitFor(() => {
        expect(screen.getByText(/Too many courses selected/i)).toBeInTheDocument();
        expect(screen.getByText(/You've selected 1 courses, but you can only add 0 more/i)).toBeInTheDocument();
      });
      
      // Button should be disabled
      const addButton = screen.getByText(/Add 1 course to Apply/i);
      expect(addButton).toBeDisabled();
    });

    it('updates button text with selected count', async () => {
      render(<CourseSearchSessionModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
      });
      
      // Submit search
      const input = screen.getByLabelText(/What course or subject are you interested in/i);
      fireEvent.change(input, { target: { value: 'Computer Science' } });
      fireEvent.click(screen.getByText(/Find course options/i));
      
      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Initially should show "Add courses to Apply" without number
      expect(screen.getByText(/Add.*courses to Apply/i)).toBeInTheDocument();
      
      // Select a course
      const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
      if (courseCard) {
        fireEvent.click(courseCard);
      }
      
      // Should now show "Add 1 course to Apply"
      await waitFor(() => {
        expect(screen.getByText(/Add 1 course to Apply/i)).toBeInTheDocument();
      });
    });
  });

  // Task 14.3: Error Handling Tests
  describe('Task 14.3: Enhanced Error Handling', () => {
    describe('403 Error - Upgrade Modal', () => {
      it('shows upgrade modal on 403 error when adding courses', async () => {
        // Mock 403 error for add-courses endpoint
        global.fetch = vi.fn((url) => {
          if (url.includes('/api/entitlements/check')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                plan: 'free',
                courseSearchLimit: 3,
                courseSearchesUsed: 1,
                courseAddLimit: 5,
                coursesAdded: 4,
                canCreateSession: true,
                upgradeRequired: false,
              }),
            });
          }
          if (url.includes('/api/course-search-sessions')) {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({
                sessionId: 'test-session-123',
                status: 'complete',
                results: [
                  {
                    id: 'result-1',
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
                  coursesAdded: 4,
                  courseAddLimit: 5,
                  plan: 'free',
                },
              }),
            });
          }
          if (url.includes('/api/apply-shortlist/add-courses')) {
            return Promise.resolve({
              ok: false,
              status: 403,
              json: () => Promise.resolve({
                error: 'You have reached your course limit.',
              }),
            });
          }
          return Promise.reject(new Error('Not found'));
        }) as any;

        render(<CourseSearchSessionModal {...defaultProps} />);
        
        await waitFor(() => {
          expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
        });
        
        // Submit search
        const input = screen.getByLabelText(/What course or subject are you interested in/i);
        fireEvent.change(input, { target: { value: 'Computer Science' } });
        fireEvent.click(screen.getByText(/Find course options/i));
        
        // Wait for results
        await waitFor(() => {
          expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
        }, { timeout: 3000 });
        
        // Select and add course
        const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
        if (courseCard) {
          fireEvent.click(courseCard);
        }
        
        await waitFor(() => {
          const addButton = screen.getByText(/Add 1 course to Apply/i);
          fireEvent.click(addButton);
        });
        
        // Should show upgrade modal
        await waitFor(() => {
          expect(screen.getByText(/Upgrade to Plus/i)).toBeInTheDocument();
          expect(screen.getByText(/reached your course limit/i)).toBeInTheDocument();
        });
      });

      it('displays upgrade benefits in modal', async () => {
        // Setup same as above
        global.fetch = vi.fn((url) => {
          if (url.includes('/api/entitlements/check')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                plan: 'free',
                courseSearchLimit: 3,
                courseSearchesUsed: 1,
                courseAddLimit: 5,
                coursesAdded: 4,
                canCreateSession: true,
                upgradeRequired: false,
              }),
            });
          }
          if (url.includes('/api/course-search-sessions')) {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({
                sessionId: 'test-session-123',
                status: 'complete',
                results: [
                  {
                    id: 'result-1',
                    universityId: 123,
                    courseName: 'Computer Science BSc',
                    courseUrl: 'https://test.edu/courses/cs',
                    sourceDomain: 'test.edu',
                    snippet: 'Test',
                    degreeLevel: 'Undergraduate',
                    duration: '3 years',
                    tuitionFeeText: '£9,250',
                    confidenceLabel: 'Good',
                    sourceConfidence: 0.85,
                    rank: 1,
                    sourceType: 'cached',
                  },
                ],
                usage: {
                  courseSearchesUsed: 2,
                  courseSearchLimit: 3,
                  coursesAdded: 4,
                  courseAddLimit: 5,
                  plan: 'free',
                },
              }),
            });
          }
          if (url.includes('/api/apply-shortlist/add-courses')) {
            return Promise.resolve({
              ok: false,
              status: 403,
              json: () => Promise.resolve({
                error: 'You have reached your course limit.',
              }),
            });
          }
          return Promise.reject(new Error('Not found'));
        }) as any;

        render(<CourseSearchSessionModal {...defaultProps} />);
        
        await waitFor(() => {
          expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
        });
        
        // Submit search, select course, trigger error
        const input = screen.getByLabelText(/What course or subject are you interested in/i);
        fireEvent.change(input, { target: { value: 'Computer Science' } });
        fireEvent.click(screen.getByText(/Find course options/i));
        
        await waitFor(() => {
          expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
        }, { timeout: 3000 });
        
        const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
        if (courseCard) {
          fireEvent.click(courseCard);
        }
        
        await waitFor(() => {
          const addButton = screen.getByText(/Add 1 course to Apply/i);
          fireEvent.click(addButton);
        });
        
        // Check for benefits
        await waitFor(() => {
          expect(screen.getByText(/Unlimited AI-powered course searches/i)).toBeInTheDocument();
          expect(screen.getByText(/Unlimited course applications/i)).toBeInTheDocument();
          expect(screen.getByText(/Priority AI parsing and checklist generation/i)).toBeInTheDocument();
        });
      });

      it('provides upgrade and archive options', async () => {
        global.fetch = vi.fn((url) => {
          if (url.includes('/api/entitlements/check')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                plan: 'free',
                courseSearchLimit: 3,
                courseSearchesUsed: 1,
                courseAddLimit: 5,
                coursesAdded: 4,
                canCreateSession: true,
                upgradeRequired: false,
              }),
            });
          }
          if (url.includes('/api/course-search-sessions')) {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({
                sessionId: 'test-session-123',
                status: 'complete',
                results: [
                  {
                    id: 'result-1',
                    universityId: 123,
                    courseName: 'Computer Science BSc',
                    courseUrl: 'https://test.edu/courses/cs',
                    sourceDomain: 'test.edu',
                    snippet: 'Test',
                    degreeLevel: 'Undergraduate',
                    duration: '3 years',
                    tuitionFeeText: '£9,250',
                    confidenceLabel: 'Good',
                    sourceConfidence: 0.85,
                    rank: 1,
                    sourceType: 'cached',
                  },
                ],
                usage: {
                  courseSearchesUsed: 2,
                  courseSearchLimit: 3,
                  coursesAdded: 4,
                  courseAddLimit: 5,
                  plan: 'free',
                },
              }),
            });
          }
          if (url.includes('/api/apply-shortlist/add-courses')) {
            return Promise.resolve({
              ok: false,
              status: 403,
              json: () => Promise.resolve({
                error: 'You have reached your course limit.',
              }),
            });
          }
          return Promise.reject(new Error('Not found'));
        }) as any;

        render(<CourseSearchSessionModal {...defaultProps} />);
        
        await waitFor(() => {
          expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
        });
        
        const input = screen.getByLabelText(/What course or subject are you interested in/i);
        fireEvent.change(input, { target: { value: 'Computer Science' } });
        fireEvent.click(screen.getByText(/Find course options/i));
        
        await waitFor(() => {
          expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
        }, { timeout: 3000 });
        
        const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
        if (courseCard) {
          fireEvent.click(courseCard);
        }
        
        await waitFor(() => {
          const addButton = screen.getByText(/Add 1 course to Apply/i);
          fireEvent.click(addButton);
        });
        
        // Check for action buttons
        await waitFor(() => {
          expect(screen.getByText(/Upgrade to Plus/i)).toBeInTheDocument();
          expect(screen.getByText(/Archive a course/i)).toBeInTheDocument();
        });
      });
    });

    describe('500 Error - Retry Functionality', () => {
      it('shows error message with retry button on 500 error', async () => {
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
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({
                sessionId: 'test-session-123',
                status: 'complete',
                results: [
                  {
                    id: 'result-1',
                    universityId: 123,
                    courseName: 'Computer Science BSc',
                    courseUrl: 'https://test.edu/courses/cs',
                    sourceDomain: 'test.edu',
                    snippet: 'Test',
                    degreeLevel: 'Undergraduate',
                    duration: '3 years',
                    tuitionFeeText: '£9,250',
                    confidenceLabel: 'Good',
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
          if (url.includes('/api/apply-shortlist/add-courses')) {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: () => Promise.resolve({
                error: 'Internal server error occurred',
              }),
            });
          }
          return Promise.reject(new Error('Not found'));
        }) as any;

        render(<CourseSearchSessionModal {...defaultProps} />);
        
        await waitFor(() => {
          expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
        });
        
        const input = screen.getByLabelText(/What course or subject are you interested in/i);
        fireEvent.change(input, { target: { value: 'Computer Science' } });
        fireEvent.click(screen.getByText(/Find course options/i));
        
        await waitFor(() => {
          expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
        }, { timeout: 3000 });
        
        const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
        if (courseCard) {
          fireEvent.click(courseCard);
        }
        
        await waitFor(() => {
          const addButton = screen.getByText(/Add 1 course to Apply/i);
          fireEvent.click(addButton);
        });
        
        // Should show error with retry
        await waitFor(() => {
          expect(screen.getByText(/Failed to Add Courses/i)).toBeInTheDocument();
          expect(screen.getByText(/Internal server error occurred/i)).toBeInTheDocument();
          expect(screen.getByText(/Try again/i)).toBeInTheDocument();
        });
      });

      it('retries request when retry button is clicked', async () => {
        let attemptCount = 0;
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
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({
                sessionId: 'test-session-123',
                status: 'complete',
                results: [
                  {
                    id: 'result-1',
                    universityId: 123,
                    courseName: 'Computer Science BSc',
                    courseUrl: 'https://test.edu/courses/cs',
                    sourceDomain: 'test.edu',
                    snippet: 'Test',
                    degreeLevel: 'Undergraduate',
                    duration: '3 years',
                    tuitionFeeText: '£9,250',
                    confidenceLabel: 'Good',
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
          if (url.includes('/api/apply-shortlist/add-courses')) {
            attemptCount++;
            if (attemptCount === 1) {
              // First attempt fails
              return Promise.resolve({
                ok: false,
                status: 500,
                json: () => Promise.resolve({
                  error: 'Server error',
                }),
              });
            } else {
              // Second attempt succeeds
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                  applicationsCreated: [
                    {
                      id: 'app-1',
                      courseName: 'Computer Science BSc',
                      courseUrl: 'https://test.edu/courses/cs',
                      parseStatus: 'processing',
                    },
                  ],
                  skippedDuplicates: [],
                  failedValidation: [],
                  usage: {
                    coursesAdded: 3,
                    courseAddLimit: 5,
                    plan: 'free',
                  },
                }),
              });
            }
          }
          return Promise.reject(new Error('Not found'));
        }) as any;

        render(<CourseSearchSessionModal {...defaultProps} />);
        
        await waitFor(() => {
          expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
        });
        
        const input = screen.getByLabelText(/What course or subject are you interested in/i);
        fireEvent.change(input, { target: { value: 'Computer Science' } });
        fireEvent.click(screen.getByText(/Find course options/i));
        
        await waitFor(() => {
          expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
        }, { timeout: 3000 });
        
        const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
        if (courseCard) {
          fireEvent.click(courseCard);
        }
        
        await waitFor(() => {
          const addButton = screen.getByText(/Add 1 course to Apply/i);
          fireEvent.click(addButton);
        });
        
        // Should show error
        await waitFor(() => {
          expect(screen.getByText(/Failed to Add Courses/i)).toBeInTheDocument();
        });
        
        // Click retry
        const retryButton = screen.getByText(/Try again/i);
        fireEvent.click(retryButton);
        
        // Should succeed on retry and show success step
        await waitFor(() => {
          expect(screen.getByText(/added to your Apply shortlist/i)).toBeInTheDocument();
        }, { timeout: 3000 });
        
        expect(attemptCount).toBe(2);
      });
    });

    describe('Error Logging', () => {
      it('logs 403 errors to console', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        global.fetch = vi.fn((url) => {
          if (url.includes('/api/entitlements/check')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                plan: 'free',
                courseSearchLimit: 3,
                courseSearchesUsed: 1,
                courseAddLimit: 5,
                coursesAdded: 4,
                canCreateSession: true,
                upgradeRequired: false,
              }),
            });
          }
          if (url.includes('/api/course-search-sessions')) {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({
                sessionId: 'test-session-123',
                status: 'complete',
                results: [
                  {
                    id: 'result-1',
                    universityId: 123,
                    courseName: 'Computer Science BSc',
                    courseUrl: 'https://test.edu/courses/cs',
                    sourceDomain: 'test.edu',
                    snippet: 'Test',
                    degreeLevel: 'Undergraduate',
                    duration: '3 years',
                    tuitionFeeText: '£9,250',
                    confidenceLabel: 'Good',
                    sourceConfidence: 0.85,
                    rank: 1,
                    sourceType: 'cached',
                  },
                ],
                usage: {
                  courseSearchesUsed: 2,
                  courseSearchLimit: 3,
                  coursesAdded: 4,
                  courseAddLimit: 5,
                  plan: 'free',
                },
              }),
            });
          }
          if (url.includes('/api/apply-shortlist/add-courses')) {
            return Promise.resolve({
              ok: false,
              status: 403,
              json: () => Promise.resolve({
                error: 'Course limit reached',
              }),
            });
          }
          return Promise.reject(new Error('Not found'));
        }) as any;

        render(<CourseSearchSessionModal {...defaultProps} />);
        
        await waitFor(() => {
          expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
        });
        
        const input = screen.getByLabelText(/What course or subject are you interested in/i);
        fireEvent.change(input, { target: { value: 'Computer Science' } });
        fireEvent.click(screen.getByText(/Find course options/i));
        
        await waitFor(() => {
          expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
        }, { timeout: 3000 });
        
        const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
        if (courseCard) {
          fireEvent.click(courseCard);
        }
        
        await waitFor(() => {
          const addButton = screen.getByText(/Add 1 course to Apply/i);
          fireEvent.click(addButton);
        });
        
        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith('Add courses error (403):', 'Course limit reached');
        });
        
        consoleSpy.mockRestore();
      });

      it('logs 500 errors to console', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
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
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () => Promise.resolve({
                sessionId: 'test-session-123',
                status: 'complete',
                results: [
                  {
                    id: 'result-1',
                    universityId: 123,
                    courseName: 'Computer Science BSc',
                    courseUrl: 'https://test.edu/courses/cs',
                    sourceDomain: 'test.edu',
                    snippet: 'Test',
                    degreeLevel: 'Undergraduate',
                    duration: '3 years',
                    tuitionFeeText: '£9,250',
                    confidenceLabel: 'Good',
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
          if (url.includes('/api/apply-shortlist/add-courses')) {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: () => Promise.resolve({
                error: 'Server error',
              }),
            });
          }
          return Promise.reject(new Error('Not found'));
        }) as any;

        render(<CourseSearchSessionModal {...defaultProps} />);
        
        await waitFor(() => {
          expect(screen.queryByText(/Loading your details/i)).not.toBeInTheDocument();
        });
        
        const input = screen.getByLabelText(/What course or subject are you interested in/i);
        fireEvent.change(input, { target: { value: 'Computer Science' } });
        fireEvent.click(screen.getByText(/Find course options/i));
        
        await waitFor(() => {
          expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
        }, { timeout: 3000 });
        
        const courseCard = screen.getByText('Computer Science BSc').closest('div[role="button"]');
        if (courseCard) {
          fireEvent.click(courseCard);
        }
        
        await waitFor(() => {
          const addButton = screen.getByText(/Add 1 course to Apply/i);
          fireEvent.click(addButton);
        });
        
        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            'Add courses error (500):',
            'Server error',
            expect.any(Object)
          );
        });
        
        consoleSpy.mockRestore();
      });
    });
  });
});