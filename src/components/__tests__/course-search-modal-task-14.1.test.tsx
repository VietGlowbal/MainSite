/**
 * Task 14.1: "Add courses" Button Handler Test
 * 
 * This test verifies that the "Add courses" button in Step 2 (results) correctly:
 * 1. Collects all selected result IDs
 * 2. Disables button while request is in flight
 * 3. Calls POST /api/apply-shortlist/add-courses with sessionId and selectedResultIds
 * 4. Shows loading state: "Adding courses to your shortlist..."
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CourseSearchSessionModal } from '../course-search-session-modal';

// Mock Next.js router
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/apply',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              user_id: 'user-123',
              nationality: 'United Kingdom',
              study_level: 'Undergraduate',
              grades_summary: { level: 'A-Level' },
              budget_range: '£10,000-£20,000',
            },
            error: null,
          }),
        })),
      })),
    })),
  }),
}));

describe('Task 14.1: Add Courses Button Handler', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    universityId: 123,
    universityName: 'Test University',
    universityDomain: 'test.ac.uk',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should collect selected result IDs and call the API when Add courses button is clicked', async () => {
    // Mock entitlement check
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 0,
            courseAddLimit: 5,
            coursesAdded: 0,
            canCreateSession: true,
          }),
        });
      }
      
      if (url.includes('/api/course-search-sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sessionId: 'session-123',
            results: [
              {
                id: 'result-1',
                courseName: 'Computer Science BSc',
                courseUrl: 'https://test.ac.uk/cs',
                sourceDomain: 'test.ac.uk',
                snippet: 'Test course',
                confidenceLabel: 'Good match',
              },
              {
                id: 'result-2',
                courseName: 'Software Engineering MSc',
                courseUrl: 'https://test.ac.uk/se',
                sourceDomain: 'test.ac.uk',
                snippet: 'Test course 2',
                confidenceLabel: 'Good match',
              },
            ],
            usage: {
              plan: 'free',
              courseSearchLimit: 3,
              courseSearchesUsed: 1,
              courseAddLimit: 5,
              coursesAdded: 0,
            },
          }),
        });
      }
      
      if (url.includes('/api/apply-shortlist/add-courses')) {
        // Delay slightly so the loading state is observable, and return the
        // route's actual response shape.
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({
                  success: true,
                  applicationsCreated: [
                    {
                      id: 'app-1',
                      courseName: 'Computer Science BSc',
                      courseUrl: 'https://test.ac.uk/cs',
                      parseStatus: 'pending',
                    },
                  ],
                  skippedDuplicates: [],
                  failedValidation: [],
                  usage: {
                    plan: 'free',
                    courseAddLimit: 5,
                    coursesAdded: 1,
                  },
                }),
              }),
            50
          )
        );
      }

      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<CourseSearchSessionModal {...defaultProps} />);

    // Wait for initial loading
    await waitFor(() => {
      expect(screen.getByText(/What course or subject are you interested in/i)).toBeInTheDocument();
    });

    // Fill in the form
    const subjectInput = screen.getByPlaceholderText(/e.g., Computer Science/i);
    fireEvent.change(subjectInput, { target: { value: 'Computer Science' } });

    // Submit search
    const searchButton = screen.getByText('Find course options');
    fireEvent.click(searchButton);

    // Wait for results to load
    await waitFor(() => {
      expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Select the first course by clicking its checkbox
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);

    // Wait for selection state to update
    await waitFor(() => {
      expect(screen.getByText(/1 course selected/i)).toBeInTheDocument();
    });

    // Find and click the "Add courses" button
    const addButton = screen.getByText(/Add 1 course to Apply/i);
    expect(addButton).toBeInTheDocument();
    expect(addButton).not.toBeDisabled();

    // Click the add button
    fireEvent.click(addButton);

    // Verify loading state is shown
    await waitFor(() => {
      expect(screen.getByText(/Adding courses to your shortlist.../i)).toBeInTheDocument();
    });

    // Verify button is disabled during request
    const loadingButton = screen.getByText(/Adding courses to your shortlist.../i).closest('button');
    expect(loadingButton).toBeDisabled();

    // Verify API was called with correct parameters
    await waitFor(() => {
      const addCoursesCalls = (global.fetch as any).mock.calls.filter((call: any) => 
        call[0].includes('/api/apply-shortlist/add-courses')
      );
      expect(addCoursesCalls.length).toBe(1);
      
      const [url, options] = addCoursesCalls[0];
      expect(url).toContain('/api/apply-shortlist/add-courses');
      expect(options.method).toBe('POST');
      
      const body = JSON.parse(options.body);
      expect(body).toHaveProperty('sessionId', 'session-123');
      expect(body).toHaveProperty('selectedResultIds');
      expect(Array.isArray(body.selectedResultIds)).toBe(true);
      expect(body.selectedResultIds).toContain('result-1');
    });

    // Verify transition to Step 3 (added confirmation)
    await waitFor(() => {
      expect(screen.getByText(/1 course added to your Apply shortlist/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should keep button disabled when no courses are selected', async () => {
    // Mock entitlement check
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 0,
            courseAddLimit: 5,
            coursesAdded: 0,
            canCreateSession: true,
          }),
        });
      }
      
      if (url.includes('/api/course-search-sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sessionId: 'session-123',
            results: [
              {
                id: 'result-1',
                courseName: 'Computer Science BSc',
                courseUrl: 'https://test.ac.uk/cs',
                sourceDomain: 'test.ac.uk',
                snippet: 'Test course',
                confidenceLabel: 'Good match',
              },
            ],
            usage: {
              plan: 'free',
              courseSearchLimit: 3,
              courseSearchesUsed: 1,
              courseAddLimit: 5,
              coursesAdded: 0,
            },
          }),
        });
      }

      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<CourseSearchSessionModal {...defaultProps} />);

    // Wait for initial loading
    await waitFor(() => {
      expect(screen.getByText(/What course or subject are you interested in/i)).toBeInTheDocument();
    });

    // Fill in the form
    const subjectInput = screen.getByPlaceholderText(/e.g., Computer Science/i);
    fireEvent.change(subjectInput, { target: { value: 'Computer Science' } });

    // Submit search
    const searchButton = screen.getByText('Find course options');
    fireEvent.click(searchButton);

    // Wait for results to load
    await waitFor(() => {
      expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Find the "Add courses" button
    const addButton = screen.getByText(/Add.*courses to Apply/i);
    
    // Button should be disabled when no courses selected
    expect(addButton).toBeDisabled();
  });

  it('should handle API errors gracefully', async () => {
    // Mock entitlement check
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/entitlements/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plan: 'free',
            courseSearchLimit: 3,
            courseSearchesUsed: 0,
            courseAddLimit: 5,
            coursesAdded: 0,
            canCreateSession: true,
          }),
        });
      }
      
      if (url.includes('/api/course-search-sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sessionId: 'session-123',
            results: [
              {
                id: 'result-1',
                courseName: 'Computer Science BSc',
                courseUrl: 'https://test.ac.uk/cs',
                sourceDomain: 'test.ac.uk',
                snippet: 'Test course',
                confidenceLabel: 'Good match',
              },
            ],
            usage: {
              plan: 'free',
              courseSearchLimit: 3,
              courseSearchesUsed: 1,
              courseAddLimit: 5,
              coursesAdded: 0,
            },
          }),
        });
      }
      
      if (url.includes('/api/apply-shortlist/add-courses')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            error: 'Server error occurred',
          }),
        });
      }

      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<CourseSearchSessionModal {...defaultProps} />);

    // Wait for initial loading
    await waitFor(() => {
      expect(screen.getByText(/What course or subject are you interested in/i)).toBeInTheDocument();
    });

    // Fill in the form
    const subjectInput = screen.getByPlaceholderText(/e.g., Computer Science/i);
    fireEvent.change(subjectInput, { target: { value: 'Computer Science' } });

    // Submit search
    const searchButton = screen.getByText('Find course options');
    fireEvent.click(searchButton);

    // Wait for results to load
    await waitFor(() => {
      expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Select the course
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);

    // Click the add button
    const addButton = await screen.findByText(/Add 1 course to Apply/i);
    fireEvent.click(addButton);

    // Verify error is displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to Add Courses/i)).toBeInTheDocument();
      expect(screen.getByText(/Server error occurred/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
