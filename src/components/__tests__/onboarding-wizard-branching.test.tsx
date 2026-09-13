import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/navigation-session', () => ({
  notifyNavigationOnboardingCompleted: vi.fn(),
}));

vi.mock('@/components/site-navigation', () => ({
  SiteNavigation: () => null,
}));

vi.mock('@/lib/i18n', () => ({
  useT: () => (label: string) => label,
}));

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null });

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => ({
      upsert: (...args: unknown[]) => {
        return mockUpsert(table, ...args);
      },
    }),
  }),
}));

vi.mock('@/shared/ui/loading-overlay', () => ({
  useLoadingIndicator: () => {},
}));

import { OnboardingWizard } from '@/app/onboarding/onboarding-wizard';

const DRAFT_KEY = 'glowbal-onboarding-draft';

describe('OnboardingWizard branching (UG, PG, PhD)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('renders UG controls on Step 6 and Step 7 for undergraduate applicants', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'undergraduate',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: {
            curriculum: ['Vietnamese National Curriculum'],
            scales: { 'Vietnamese National Curriculum': '10-point scale' },
            grades: { 'Vietnamese National Curriculum': '8.5' },
            graduation_year: '2026',
          },
          tests: {
            english: ['None yet'],
            englishScores: {},
            standardized: ['None yet'],
            standardizedScores: {},
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    render(<OnboardingWizard isSignedIn />);

    // Jump to Step 6
    const step6 = await screen.findByRole('button', { name: /Question 6/ });
    await waitFor(() => expect(step6).toBeEnabled());
    fireEvent.click(step6);

    // Assert UG academic fields are present
    expect(screen.getByPlaceholderText('Select a curriculum')).toBeInTheDocument();
    expect(screen.getByLabelText(/Graduation year/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Bachelor \/ Current degree/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Research experience/i)).not.toBeInTheDocument();

    // Jump to Step 7
    const step7 = screen.getByRole('button', { name: /Question 7/ });
    fireEvent.click(step7);

    // Assert UG standardized tests control is present
    expect(screen.getByPlaceholderText('English Proficiency')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Standardized Test')).toBeInTheDocument();
    expect(screen.getByText('SAT')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Graduate Admission Test')).not.toBeInTheDocument();
  });

  it('renders PG controls and hides UG tests (SAT/ACT) for postgraduate applicants', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'postgraduate',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: {
            curriculum: [],
            scales: {},
            grades: {},
          },
          pg_academic: {
            degree: 'Bachelor of Science',
            institution: 'National University of Singapore',
            field_of_study: 'Computer Science',
            gpa_scale: '4.0 scale',
            gpa: '3.8',
            completion_year: '2024',
          },
          tests: {
            english: ['None yet'],
            englishScores: {},
            standardized: ['None yet'],
            standardizedScores: {},
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    render(<OnboardingWizard isSignedIn />);

    // Step 6 for PG
    const step6 = await screen.findByRole('button', { name: /Question 6/ });
    await waitFor(() => expect(step6).toBeEnabled());
    fireEvent.click(step6);

    expect(screen.getByLabelText(/Bachelor \/ Current degree/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Institution name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Field of study \/ Major/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Graduation \/ Completion year/i)).toBeInTheDocument();
    // High-school curriculum is NOT rendered
    expect(screen.queryByPlaceholderText('Select a curriculum')).not.toBeInTheDocument();

    // Step 7 for PG
    const step7 = screen.getByRole('button', { name: /Question 7/ });
    fireEvent.click(step7);

    expect(screen.getByPlaceholderText('English Proficiency')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Graduate Admission Test')).toBeInTheDocument();
    expect(screen.getByText('GRE')).toBeInTheDocument();
    expect(screen.getByText('GMAT')).toBeInTheDocument();
    // UG Standardized test selector is NOT rendered
    expect(screen.queryByPlaceholderText('Standardized Test')).not.toBeInTheDocument();
    expect(screen.queryByText('SAT')).not.toBeInTheDocument();
    expect(screen.queryByText('AP Exams')).not.toBeInTheDocument();
  });

  it('renders PhD research controls and hides standardized test selectors', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'phd',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: {
            curriculum: [],
            scales: {},
            grades: {},
          },
          phd_academic: {
            bachelor_degree: 'BSc Computer Science, NUS',
            master_degree: 'MSc AI, NTU',
            institution: 'NTU',
            research_experience: 'Computer vision lab for 2 years',
            publications: '1 conference paper',
            research_direction: 'Generative models',
            supervisor_fit: 'Prof. John Doe',
          },
          tests: {
            english: ['None yet'],
            englishScores: {},
            standardized: [],
            standardizedScores: {},
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    render(<OnboardingWizard isSignedIn />);

    // Step 6 for PhD
    const step6 = await screen.findByRole('button', { name: /Question 6/ });
    await waitFor(() => expect(step6).toBeEnabled());
    fireEvent.click(step6);

    expect(screen.getByLabelText(/Bachelor's degree & institution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Master's degree & institution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Research experience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Publications & research outputs/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Intended research direction/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Supervisor \/ Research fit context/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Select a curriculum')).not.toBeInTheDocument();

    // Step 7 for PhD
    const step7 = screen.getByRole('button', { name: /Question 7/ });
    fireEvent.click(step7);

    expect(screen.getByPlaceholderText('English Proficiency')).toBeInTheDocument();
    // Neither UG nor PG standardized test selectors are rendered
    expect(screen.queryByPlaceholderText('Graduate Admission Test')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Standardized Test')).not.toBeInTheDocument();
    expect(screen.queryByText('GRE')).not.toBeInTheDocument();
    expect(screen.queryByText('SAT')).not.toBeInTheDocument();
  });

  it('saves PG profile with additive postgraduate_academic and without clearing existing UG columns', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'postgraduate',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: { curriculum: [], scales: {}, grades: {} },
          pg_academic: {
            degree: 'BSc Computer Science',
            institution: 'NUS',
            field_of_study: 'Software Engineering',
            gpa_scale: '4.0 scale',
            gpa: '3.8',
            completion_year: '2024',
          },
          tests: {
            english: ['None yet'],
            englishScores: {},
            standardized: ['GRE'],
            standardizedScores: { GRE: '325' },
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    render(<OnboardingWizard isSignedIn />);

    // Go to step 8 (last step) and save
    const step8 = await screen.findByRole('button', { name: /Question 8/ });
    await waitFor(() => expect(step8).toBeEnabled());
    fireEvent.click(step8);

    const saveBtn = screen.getByRole('button', { name: 'Save & see matches' });
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    // Check student_profiles upsert call
    const profileCall = mockUpsert.mock.calls.find((call) => call[0] === 'student_profiles');
    expect(profileCall).toBeDefined();
    const payload = profileCall![1] as Record<string, unknown>;

    expect(payload.study_level).toBe('postgraduate');
    expect(payload.postgraduate_academic).toEqual({
      degree: 'BSc Computer Science',
      institution: 'NUS',
      field_of_study: 'Software Engineering',
      gpa_scale: '4.0 scale',
      gpa: '3.8',
      classification: null,
      completion_year: '2024',
    });
    expect(payload.current_institution).toBe('NUS');
    expect(payload.current_qualification).toBe('BSc Computer Science');
    expect(payload.graduation_year).toBe(2024);
    expect(payload.gpa_value).toBe(3.8);

    // Unrelated level payloads must be omitted (NOT set to null)
    expect(payload).not.toHaveProperty('curriculum');
    expect(payload).not.toHaveProperty('curriculum_grades');
    expect(payload).not.toHaveProperty('phd_academic');

    // Standardized test scores should contain GRE
    const stdCall = mockUpsert.mock.calls.find((call) => call[0] === 'standardized_test_scores');
    expect(stdCall).toBeDefined();
    expect(stdCall![1]).toEqual([
      expect.objectContaining({
        user_id: 'test-user-id',
        test_type: 'GRE',
        score: '325',
      }),
    ]);
  });

  it('saves PhD profile with additive phd_academic and without clearing existing UG/PG columns', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'phd',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: { curriculum: [], scales: {}, grades: {} },
          phd_academic: {
            bachelor_degree: 'BSc CS, NUS',
            master_degree: 'MSc AI, NTU',
            institution: 'NTU',
            research_experience: 'Lab research 2 years',
            publications: '1 journal paper',
            research_direction: 'Generative AI',
            supervisor_fit: 'Prof. Smith',
          },
          tests: {
            english: ['IELTS Academic'],
            englishScores: { 'IELTS Academic': '8.0' },
            standardized: [],
            standardizedScores: {},
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    render(<OnboardingWizard isSignedIn />);

    const step8 = await screen.findByRole('button', { name: /Question 8/ });
    await waitFor(() => expect(step8).toBeEnabled());
    fireEvent.click(step8);

    const saveBtn = screen.getByRole('button', { name: 'Save & see matches' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    const profileCall = mockUpsert.mock.calls.find((call) => call[0] === 'student_profiles');
    expect(profileCall).toBeDefined();
    const payload = profileCall![1] as Record<string, unknown>;

    expect(payload.study_level).toBe('phd');
    expect(payload.phd_academic).toEqual({
      bachelor_degree: 'BSc CS, NUS',
      master_degree: 'MSc AI, NTU',
      institution: 'NTU',
      research_experience: 'Lab research 2 years',
      publications: '1 journal paper',
      research_direction: 'Generative AI',
      supervisor_fit: 'Prof. Smith',
    });
    expect(payload.current_institution).toBe('NTU');
    expect(payload.current_qualification).toBe('MSc AI, NTU');
    expect(payload.academic_background).toBe('Lab research 2 years\n\n1 journal paper');
    // Research direction remains inside phd_academic and must not overwrite
    // generic goals previously entered through Profile.
    expect(payload).not.toHaveProperty('goals');

    // Unrelated level payloads must be omitted (NOT set to null)
    expect(payload).not.toHaveProperty('curriculum');
    expect(payload).not.toHaveProperty('curriculum_grades');
    expect(payload).not.toHaveProperty('postgraduate_academic');

    // English score saved, standardized score empty for PhD
    const englishCall = mockUpsert.mock.calls.find((call) => call[0] === 'english_test_scores');
    expect(englishCall).toBeDefined();
    expect(englishCall![1]).toEqual([
      expect.objectContaining({
        user_id: 'test-user-id',
        test_type: 'IELTS Academic',
        overall_score: 8.0,
      }),
    ]);
    const stdCall = mockUpsert.mock.calls.find((call) => call[0] === 'standardized_test_scores');
    expect(stdCall).toBeUndefined();
  });

  it('saves UG profile without requiring or touching postgraduate_academic or phd_academic columns', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'undergraduate',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: {
            curriculum: ['Vietnamese National Curriculum'],
            scales: { 'Vietnamese National Curriculum': '10-point scale' },
            grades: { 'Vietnamese National Curriculum': '9.0' },
            graduation_year: '2025',
          },
          tests: {
            english: ['None yet'],
            englishScores: {},
            standardized: ['SAT'],
            standardizedScores: { SAT: '1450' },
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    render(<OnboardingWizard isSignedIn />);

    const step8 = await screen.findByRole('button', { name: /Question 8/ });
    await waitFor(() => expect(step8).toBeEnabled());
    fireEvent.click(step8);

    const saveBtn = screen.getByRole('button', { name: 'Save & see matches' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    const profileCall = mockUpsert.mock.calls.find((call) => call[0] === 'student_profiles');
    expect(profileCall).toBeDefined();
    const payload = profileCall![1] as Record<string, unknown>;

    expect(payload.study_level).toBe('undergraduate');
    expect(payload.curriculum).toEqual(['Vietnamese National Curriculum']);
    expect(payload.curriculum_grades).toEqual([
      { curriculum: 'Vietnamese National Curriculum', scale: '10-point scale', grade: '9.0', value: 9.0 },
    ]);
    expect(payload.graduation_year).toBe(2025);

    // Must NOT have postgraduate_academic or phd_academic
    expect(payload).not.toHaveProperty('postgraduate_academic');
    expect(payload).not.toHaveProperty('phd_academic');
  });

  it('does not persist hidden UG standardized tests when a PG draft contains stale values', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'postgraduate',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: { curriculum: [], scales: {}, grades: {} },
          pg_academic: {
            degree: 'BSc Computer Science',
            institution: 'NUS',
            field_of_study: 'Software Engineering',
            gpa_scale: '4.0 scale',
            gpa: '3.8',
            completion_year: '2024',
          },
          tests: {
            english: ['None yet'],
            englishScores: {},
            standardized: ['SAT'],
            standardizedScores: { SAT: '1450' },
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    render(<OnboardingWizard isSignedIn />);

    const step7 = await screen.findByRole('button', { name: /Question 7/ });
    await waitFor(() => expect(step7).toBeEnabled());
    fireEvent.click(step7);

    // The stale SAT answer is not a valid PG test selection, so the step remains
    // blocked until the student explicitly chooses GRE/GMAT/None yet.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.queryByText('SAT')).not.toBeInTheDocument();
  });

  it('falls back only when the additive academic columns are missing', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'postgraduate',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: { curriculum: [], scales: {}, grades: {} },
          pg_academic: {
            degree: 'BSc Computer Science',
            institution: 'NUS',
            field_of_study: 'Computer Science',
            gpa_scale: '4.0 scale',
            gpa: '3.8',
            completion_year: '2024',
          },
          tests: {
            english: ['None yet'],
            englishScores: {},
            standardized: ['GRE'],
            standardizedScores: { GRE: '320' },
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    let profileAttempts = 0;
    mockUpsert.mockImplementation((table: string) => {
      if (table === 'student_profiles' && profileAttempts++ === 0) {
        return Promise.resolve({
          error: { code: '42703', message: 'column postgraduate_academic does not exist' },
        });
      }
      return Promise.resolve({ error: null });
    });

    render(<OnboardingWizard isSignedIn />);
    const step8 = await screen.findByRole('button', { name: /Question 8/ });
    await waitFor(() => expect(step8).toBeEnabled());
    fireEvent.click(step8);
    fireEvent.click(screen.getByRole('button', { name: 'Save & see matches' }));

    await waitFor(() => {
      expect(mockUpsert.mock.calls.filter((call) => call[0] === 'student_profiles')).toHaveLength(2);
    });
    expect(mockPush).toHaveBeenCalledWith('/universities');
  });

  it('propagates non-schema profile errors instead of hiding them with a fallback write', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        answers: {
          study_level: 'phd',
          subjects: 'Technology',
          countries: 'Open to ideas',
          budget: 'Under $15k',
          campus: 'Flexible',
          academic: { curriculum: [], scales: {}, grades: {} },
          phd_academic: {
            bachelor_degree: 'BSc Computer Science, NUS',
            master_degree: '',
            institution: '',
            research_experience: 'NLP lab research',
            publications: '',
            research_direction: 'Multimodal models',
            supervisor_fit: 'Language systems group',
          },
          tests: {
            english: ['IELTS Academic'],
            englishScores: { 'IELTS Academic': '7.5' },
            standardized: [],
            standardizedScores: {},
          },
          support: 'Scholarships and funding',
        },
      }),
    );

    mockUpsert.mockImplementation((table: string) => {
      if (table === 'student_profiles') {
        return Promise.resolve({
          error: { code: '42501', message: 'new row violates row-level security policy' },
        });
      }
      return Promise.resolve({ error: null });
    });

    render(<OnboardingWizard isSignedIn />);
    const step8 = await screen.findByRole('button', { name: /Question 8/ });
    await waitFor(() => expect(step8).toBeEnabled());
    fireEvent.click(step8);
    fireEvent.click(screen.getByRole('button', { name: 'Save & see matches' }));

    await waitFor(() => expect(screen.getByText('new row violates row-level security policy')).toBeInTheDocument());
    expect(mockUpsert.mock.calls.filter((call) => call[0] === 'student_profiles')).toHaveLength(1);
    expect(mockPush).not.toHaveBeenCalledWith('/universities');
  });
});
