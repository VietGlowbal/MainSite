import { StrictMode, useEffect, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CvBuilderWorkspace } from './CvBuilderWorkspace';
import type {
  CvBuilderFormV1,
  CvTargetProfileV1,
  GeneratedCvV1,
} from '@/lib/ai/cv-builder';
import type { CvStrategySnapshot } from '@/lib/ai/cv-builder-strategy';
import { LanguageProvider, useLanguage } from '@/lib/i18n';

const { routerRefreshMock } = vi.hoisted(() => ({
  routerRefreshMock: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

const prefill: CvBuilderFormV1 = {
  personal: {
    fullName: 'Alex Nguyen',
    email: 'alex@example.com',
    phone: '+84 90 123 4567',
    location: 'Hanoi',
    links: ['alex.dev'],
  },
  education: [
    {
      id: 'edu-1',
      institution: 'Example School',
      qualification: 'A-levels',
      fieldOfStudy: 'Mathematics',
      details: ['Predicted A*A*A.'],
    },
  ],
  entries: [
    {
      id: 'entry-1',
      category: 'project',
      title: 'Robotics project',
      contributions: Array.from({ length: 5 }, (_, index) => ({
        id: `K00${index + 1}`,
        framework: 'built' as const,
        text: `Built project component ${index + 1}`,
      })),
    },
  ],
  awards: [{ id: 'award-1', title: 'Robotics Prize', issuer: 'Example School' }],
  skillGroups: [{ id: 'skill-1', label: 'Core skills', skills: ['Python', 'C++'] }],
};

const generatedCv: GeneratedCvV1 = {
  aboutMe: 'Applicant focused on accessible robotics.',
  education: [
    {
      sourceId: 'edu-1',
      institution: 'Example School',
      qualification: 'A-levels',
      fieldOfStudy: 'Mathematics',
      details: ['Predicted A*A*A.'],
    },
  ],
  experience: [],
  projects: [
    {
      sourceId: 'entry-1',
      title: 'Robotics project',
      organization: 'Robotics Club',
      dates: '2025',
      bullets: [
        {
          text: 'Built project component 1.',
          evidenceIds: ['K001'],
        },
      ],
    },
  ],
  activities: [],
  awards: [
    {
      sourceId: 'award-1',
      title: 'Robotics Prize',
      issuer: 'Example School',
    },
  ],
  skillGroups: [
    {
      sourceId: 'skill-1',
      label: 'Core skills',
      skills: ['Python', 'C++'],
    },
  ],
  assessment: {
    strengths: ['Builder', 'Analytical', 'Collaborative'],
    missingSignals: ['Missing a concrete result.'],
    improvementActions: ['Add impact.'],
    followUpQuestions: [
      {
        id: 'Q001',
        evidenceId: 'K001',
        targetSection: 'projects',
        question: 'How many people did the project help?',
        reason: 'The bullet currently has no clear impact.',
      },
      {
        id: 'Q002',
        evidenceId: 'K002',
        targetSection: 'projects',
        question: 'Which part of the project did you build yourself?',
        reason: 'The individual role is unclear.',
      },
    ],
  },
  layout: { templateId: 'technical', rationale: 'Project-led profile.' },
  plainText: '',
};

const unavailable = {
  text: 'Not enough data',
  status: 'unavailable' as const,
  sourceRefs: [],
};
const targetProfile: CvTargetProfileV1 = {
  universityName: 'Example University',
  programmeName: 'Computer Science',
  universityDna: {
    positioning: unavailable,
    educationalPhilosophy: unavailable,
    environment: unavailable,
    studentSignals: [unavailable],
  },
  programmeDna: {
    objectives: [unavailable],
    modules: [unavailable],
    learningOutcomes: [unavailable],
    competencies: [unavailable],
    entrySignals: [unavailable],
  },
  careerAlignment: [unavailable],
  evidenceSignals: [
    {
      id: 'S001',
      label: 'Problem solving',
      description: 'The CV needs to prove how you solve a specific problem.',
      evidenceExamples: ['A project describing the approach and the outcome'],
      sourceRefs: ['course:subject'],
    },
    {
      id: 'S002',
      label: 'Programming',
      description: 'The CV needs evidence of real programming ability.',
      evidenceExamples: ['A product or tool you built'],
      sourceRefs: ['course:subject'],
    },
    {
      id: 'S003',
      label: 'Collaboration',
      description: 'The CV needs to prove you can work with others.',
      evidenceExamples: ['A specific role within a team'],
      sourceRefs: ['university:best_for'],
    },
    {
      id: 'S004',
      label: 'Academic readiness',
      description: 'The CV needs to show a suitable academic foundation.',
      evidenceExamples: ['A relevant subject or academic project'],
      sourceRefs: ['course:entry_requirements_summary'],
    },
    {
      id: 'S005',
      label: 'Career direction',
      description: 'The CV needs to connect experience to the career direction.',
      evidenceExamples: ['Experience relevant to the intended career field'],
      sourceRefs: ['profile:career_interests'],
    },
  ],
  keywords: ['Problem solving', 'Programming', 'Collaboration'],
  confidence: 'low',
  limitations: [],
};

const strategy = {
  version: 1,
  recommendationId: 'rec-1',
  id: 'rec-1',
  applicationId: 'app-1',
  createdAt: '2026-08-15T00:00:00.000Z',
  sourceAnalysisId: 'analysis-1',
  sourceMatchAnalysisId: 'match-1',
  pdfStoragePath: null,
  directionOptions: [
    {
      name: 'Accessible systems builder',
      identityFit: 9,
      evidenceStrength: 8,
      consistency: 9,
      differentiation: 8,
      futureAlignment: 9,
      scalability: 8,
      overall: 8.5,
    },
    {
      name: 'Research-led technologist',
      identityFit: 7,
      evidenceStrength: 6,
      consistency: 7,
      differentiation: 7,
      futureAlignment: 8,
      scalability: 7,
      overall: 7,
    },
  ],
  chosenDirection: 'Accessible systems builder',
  chosenDirectionWhy: 'It is the strongest evidence-backed direction.',
  narrative: 'Build accessible systems with measurable impact.',
  positioningBefore: 'Student interested in technology.',
  positioningAfter: 'Accessible systems builder with evidence of impact.',
  positioningRationale: 'This connects the profile to the programme.',
  portfolioEvaluations: [
    {
      name: 'Robotics project',
      source: 'existing_activity',
      strategicContribution: 'Shows practical building.',
      recommendation: 'highly_recommended',
    },
    {
      name: 'Open-source contribution',
      source: 'ai_proposed',
      strategicContribution: 'Adds public evidence.',
      recommendation: 'recommended',
    },
  ],
  differentiationInsight: 'Few applicants connect accessibility and systems.',
  differentiationProposal: 'Lead with accessible systems outcomes.',
  roadmap: {
    chosenStrategy: 'Accessible systems builder',
    why: 'It fits the evidence.',
    prioritize: ['Impact evidence'],
    avoid: ['Generic claims'],
    expectedPositioning: 'Builder with impact.',
    longTermNarrative: 'Build systems people can use.',
  },
  frameworks: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
  positioning: {
    before: 'Student interested in technology.',
    after: 'Accessible systems builder with evidence of impact.',
    rationale: 'This connects the profile to the programme.',
  },
  differentiation: {
    insight: 'Few applicants connect accessibility and systems.',
    proposal: 'Lead with accessible systems outcomes.',
  },
} as CvStrategySnapshot;

const strategyTargetProfile: CvTargetProfileV1 = {
  ...targetProfile,
  strategyProvenance: {
    version: 1,
    recommendationId: strategy.recommendationId,
    createdAt: strategy.createdAt,
    selectedDirection: strategy.chosenDirection,
  },
};

function boundDraft(generated = false) {
  return {
    schemaVersion: 'cv-builder-v3',
    applicationId: 'app-1',
    sourceRecommendationId: strategy.recommendationId,
    targetProfile: strategyTargetProfile,
    selectedDirection: strategy.chosenDirection,
    form: prefill,
    ...(generated ? { generatedCv } : {}),
    selectedTemplate: 'academic',
  };
}

function Vietnamese({ children }: { children: ReactNode }) {
  const { setLang } = useLanguage();
  useEffect(() => setLang('vi'), [setLang]);
  return <>{children}</>;
}

function targetProfileResponse() {
  return new Response(
    JSON.stringify({
      type: 'complete',
      targetProfile: strategyTargetProfile,
    }) + '\n',
    { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
  );
}

describe('CvBuilderWorkspace', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify(boundDraft(false)),
    );
    routerRefreshMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows target evidence requirements without scoring a CV that does not exist yet', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v3',
        sourceRecommendationId: strategy.recommendationId,
        selectedDirection: strategy.chosenDirection,
        applicationId: 'app-1',
        targetProfile: strategyTargetProfile,
        form: prefill,
        selectedTemplate: 'academic',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'What the CV needs to prove' })).toBeVisible();
    expect(screen.getAllByText('Problem solving')).toHaveLength(2);
    expect(screen.queryByText(/has evidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/missing signal/i)).not.toBeInTheDocument();
  });

  it('opens the content step and enforces five contributions per entry', async () => {
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Content/ }));
    expect(screen.getByRole('button', { name: '+ Contribution (5/5)' })).toBeDisabled();
    expect(screen.getAllByLabelText(/Contribution \d/)).toHaveLength(5);
  });

  it('removes a skill group from the CV form', async () => {
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Content/ }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove skill group 1' }),
    );

    expect(screen.queryByDisplayValue('Core skills')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ Add skill group' }),
    ).toBeVisible();
  });

  it('uses a Harvard paper, edits on click, and locks review until every answer is applied', async () => {
    const improvedCv: GeneratedCvV1 = {
      ...generatedCv,
      projects: generatedCv.projects.map((project) => ({
        ...project,
        bullets: [
          {
            text: 'Built a robotics project used by 20 students.',
            evidenceIds: ['K001'],
          },
        ],
      })),
      assessment: { ...generatedCv.assessment, followUpQuestions: [] },
      layout: { templateId: 'academic', rationale: 'Harvard-style ATS layout.' },
    };
    let resolveGenerate!: (response: Response) => void;
    const generateResponse = new Promise<Response>((resolve) => {
      resolveGenerate = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => generateResponse),
    );
    const finishGenerate = () =>
      resolveGenerate(
        new Response(
          [
            {
              type: 'section',
              section: 'about_me',
              data: { text: improvedCv.aboutMe },
            },
            {
              type: 'section',
              section: 'projects',
              data: { items: improvedCv.projects },
            },
            {
              type: 'section',
              section: 'assessment',
              data: generatedCv.assessment,
            },
          ]
            .map((event) => JSON.stringify(event))
            .join('\n') + '\n',
          { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      );
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v3',
        sourceRecommendationId: strategy.recommendationId,
        selectedDirection: strategy.chosenDirection,
        applicationId: 'app-1',
        targetProfile: strategyTargetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'academic',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /CV Draft/ }));
    expect(
      await screen.findByRole('heading', { name: 'AI needs more from you' }),
    ).toBeVisible();
    expect(
      screen.getByLabelText('How many people did the project help?'),
    ).toBeVisible();
    expect(screen.getByRole('article', { name: 'CV Harvard' })).toHaveClass(
      'cv-harvard',
    );
    const harvardPaper = screen.getByRole('article', { name: 'CV Harvard' });
    expect(harvardPaper.querySelector('.cv-harvard-header')).not.toBeNull();
    expect(harvardPaper.querySelector('.cv-harvard-contact')).toHaveTextContent(
      'alex@example.com | +84 90 123 4567 | Hanoi | alex.dev',
    );
    expect(
      harvardPaper.querySelectorAll('.cv-harvard-entry-row').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('textbox', {
        name: 'Edit University Projects heading',
      }),
    ).toHaveTextContent('University Projects');
    const educationHeader = screen
      .getByRole('textbox', { name: 'Edit Education heading' })
      .closest('h2');
    const educationSection = educationHeader?.closest('section');
    const educationEntryHeader = educationSection?.querySelector('h3');
    expect(getComputedStyle(educationHeader!)).toHaveProperty('fontWeight', '400');
    expect(getComputedStyle(educationEntryHeader!)).toHaveProperty(
      'fontWeight',
      '400',
    );
    expect(getComputedStyle(educationSection!)).toHaveProperty(
      'marginTop',
      '12px',
    );
    expect(
      screen.queryByRole('button', { name: 'Edit directly on the CV' }),
    ).not.toBeInTheDocument();
    [
      'Edit full name',
      'Edit email',
      'Edit phone number',
      'Edit location',
      'Edit link 1',
      'Edit Profile heading',
      'Edit the introduction',
      'Edit Education heading',
      'Edit qualification 1',
      'Edit school 1',
      'Edit field of study 1',
      'Edit education detail 1.1',
      'Edit University Projects heading',
      'Edit project 1 title',
      'Edit project 1 organization',
      'Edit project 1 dates',
      'Edit Robotics project — bullet 1',
      'Edit Awards heading',
      'Edit award 1',
      'Edit award issuer 1',
      'Edit Skills heading',
      'Edit skill group name 1',
      'Edit skills in group 1',
    ].forEach((name) =>
      expect(screen.getByRole('textbox', { name })).toBeVisible(),
    );

    const aboutMe = screen.getByRole('textbox', {
      name: 'Edit the introduction',
    });
    fireEvent.input(aboutMe, {
      currentTarget: { textContent: 'Applicant building accessible robotics.' },
      target: { textContent: 'Applicant building accessible robotics.' },
    });
    fireEvent.blur(aboutMe);
    expect(aboutMe).toHaveTextContent('Applicant building accessible robotics.');
    const educationHeading = screen.getByRole('textbox', {
      name: 'Edit Education heading',
    });
    fireEvent.input(educationHeading, {
      target: { textContent: 'ACADEMIC BACKGROUND' },
    });
    fireEvent.blur(educationHeading);
    expect(educationHeading).toHaveTextContent('ACADEMIC BACKGROUND');

    const reviewButton = screen.getByRole('button', { name: 'Run CV Review' });
    const submitButton = screen.getByRole('button', {
      name: 'Use these answers to improve the CV',
    });
    expect(reviewButton).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Answered 0/2 questions')).toBeVisible();

    await userEvent.type(
      screen.getByLabelText('How many people did the project help?'),
      '20 students.',
    );
    expect(submitButton).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText('Which part of the project did you build yourself?'),
      'I designed and programmed the controller.',
    );
    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)),
    ).toEqual(expect.objectContaining({ mode: 'clarification' }));
    expect(
      screen.getByRole('button', { name: 'AI is improving the CV…' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('AI is normalizing and arranging the CV…'),
    ).not.toBeInTheDocument();
    finishGenerate();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'AI needs more from you' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Run CV Review' })).toBeEnabled(),
    );
    expect(screen.getByRole('article', { name: 'CV Harvard' })).toHaveTextContent(
      '20 students',
    );

    vi.mocked(fetch).mockImplementationOnce(
      () => new Promise<Response>(() => {}),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Run CV Review' }),
    );
    expect(
      screen.getByRole('button', { name: 'AI is reviewing…' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('AI is reading and evaluating the CV…'),
    ).not.toBeInTheDocument();
  }, 10_000);

  it('keeps clarification mode when retrying a missing revised section', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            `${JSON.stringify({
              type: 'error',
              code: 'STREAM_FAILED',
              missingSections: ['projects'],
              message: 'CV generation incomplete.',
              retryable: true,
            })}\n`,
            { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
          ),
        )
        .mockImplementationOnce(() => new Promise<Response>(() => {})),
    );
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v3',
        sourceRecommendationId: strategy.recommendationId,
        selectedDirection: strategy.chosenDirection,
        applicationId: 'app-1',
        targetProfile: strategyTargetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'academic',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /CV Draft/ }));
    await userEvent.type(
      screen.getByLabelText('How many people did the project help?'),
      '20 students.',
    );
    await userEvent.type(
      screen.getByLabelText('Which part of the project did you build yourself?'),
      'I designed and programmed the controller.',
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Use these answers to improve the CV',
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Retry the missing sections' }),
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)),
    ).toEqual(expect.objectContaining({ mode: 'clarification' }));
  });

  it('locks the selected starting format and finishes on the CV Draft step', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v3',
        sourceRecommendationId: strategy.recommendationId,
        selectedDirection: strategy.chosenDirection,
        applicationId: 'app-1',
        targetProfile: strategyTargetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'academic',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        initialTemplate="technical"
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /CV Draft/ }));

    expect(screen.queryByRole('button', { name: /Layout & PDF/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Choose layout/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF / Print CV' })).toBeVisible();
    expect(screen.getByRole('article', { name: 'CV AACC' })).toHaveClass(
      'cv-aacc',
      'cv-harvard',
    );
    for (const section of ['Ability', 'Aspiration', 'Creativity', 'Commitment']) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument();
    }
    expect(screen.queryByText(/What are you good at/)).not.toBeInTheDocument();
    expect(screen.queryByText(/What do you hope to achieve/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Do you think outside the box/)).not.toBeInTheDocument();
    expect(screen.queryByText(/stick-to-it-ive/)).not.toBeInTheDocument();

  });

  it('reorders CV sections with accessible buttons and drag and drop', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v3',
        sourceRecommendationId: strategy.recommendationId,
        selectedDirection: strategy.chosenDirection,
        applicationId: 'app-1',
        targetProfile: strategyTargetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'academic',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /CV Draft/ }));
    const profile = screen.getByRole('region', { name: 'Section Profile' });
    const education = screen.getByRole('region', { name: 'Section Education' });
    expect(profile).toHaveStyle({ order: '0' });
    expect(education).toHaveStyle({ order: '1' });

    await userEvent.click(screen.getByRole('button', { name: 'Move Profile down' }));
    expect(education).toHaveStyle({ order: '0' });
    expect(profile).toHaveStyle({ order: '1' });

    const projects = screen.getByRole('region', {
      name: 'Section University Projects',
    });
    fireEvent.dragStart(screen.getByRole('button', { name: 'Drag Profile' }));
    fireEvent.dragOver(projects);
    expect(profile).toHaveClass('cv-section-dragging');
    expect(projects).toHaveClass('cv-section-drop-target');
    expect(getComputedStyle(projects)).toHaveProperty(
      'backgroundColor',
      'rgb(255, 228, 230)',
    );
    fireEvent.drop(projects);
    expect(projects).not.toHaveClass('cv-section-drop-target');
    expect(profile).toHaveStyle({ order: '2' });

    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem('glowbal:cv-builder:v1:user-1:app-1') ?? '{}',
      );
      expect(saved.generatedCv.sectionOrder.slice(0, 3)).toEqual([
        'education',
        'projects',
        'profile',
      ]);
    });
  });

  it('uses the compact four-button toolbar and confirms before hiding a section', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v3',
        sourceRecommendationId: strategy.recommendationId,
        selectedDirection: strategy.chosenDirection,
        applicationId: 'app-1',
        targetProfile: strategyTargetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'academic',
      }),
    );
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /CV Draft/ }));
    expect(
      screen.getByRole('toolbar', { name: 'Reorder Education' }),
    ).toBeInTheDocument();
    const deleteButton = screen.getByRole('button', { name: 'Remove Education' });
    expect(deleteButton).toHaveTextContent('Remove');

    await userEvent.click(deleteButton);
    expect(confirm).toHaveBeenCalledWith('Remove the Education section from the CV?');
    expect(
      screen.queryByRole('region', { name: 'Section Education' }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem('glowbal:cv-builder:v1:user-1:app-1') ?? '{}',
      );
      expect(saved.generatedCv.hiddenSections).toContain('education');
    });
  });

  it('auto-generates a strategy-bound target profile once in StrictMode and renders selectable direction cards', async () => {
    localStorage.removeItem('glowbal:cv-builder:v1:user-1:app-1');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'complete',
          targetProfile: {
            ...targetProfile,
            strategyProvenance: {
              version: 1,
              recommendationId: strategy.recommendationId,
              createdAt: strategy.createdAt,
              selectedDirection: strategy.chosenDirection,
            },
          },
        }) + '\n',
        { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <StrictMode>
        <CvBuilderWorkspace
          applicationId="app-1"
          userId="user-1"
          universityName="Example University"
          programmeName="Computer Science"
          prefill={prefill}
          strategy={strategy}
        />
      </StrictMode>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      expectedRecommendationId: strategy.recommendationId,
      selectedDirection: strategy.chosenDirection,
    });
    expect(await screen.findByRole('heading', { name: 'Strategic directions' })).toBeVisible();
    expect(screen.getAllByRole('article', { name: /Direction / })).toHaveLength(2);
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Strategy alignment' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Accessible systems builder/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('blocks CV builder when the strategy snapshot is missing and links to the strategy report', () => {
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={null}
      />,
    );

    expect(
      screen.getByText('Complete your Personalized Strategy before building a CV.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Personalized Strategy' })).toHaveAttribute(
      'href',
      '/ai-strategy/app-1/strategy-report',
    );
  });

  it('exposes an aria-live status and retries a failed auto-generated target profile', async () => {
    localStorage.removeItem('glowbal:cv-builder:v1:user-1:app-1');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Temporary failure' }), { status: 500 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'complete',
            targetProfile: {
              ...targetProfile,
              strategyProvenance: {
                version: 1,
                recommendationId: strategy.recommendationId,
                createdAt: strategy.createdAt,
                selectedDirection: strategy.chosenDirection,
              },
            },
          }) + '\n',
          { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    expect(await screen.findByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(await screen.findByRole('button', { name: 'Retry Target Profile' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Retry Target Profile' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { name: 'Strategic directions' })).toBeVisible();
  });

  it('clears a bound draft and starts a fresh strategy-bound Target Profile request', async () => {
    let resolveResponse!: (response: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(responsePromise);
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify(boundDraft(true)),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear the draft on this device' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      expectedRecommendationId: strategy.recommendationId,
      selectedDirection: strategy.chosenDirection,
    });
    expect(screen.queryByRole('article', { name: 'CV Harvard' })).not.toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('glowbal:cv-builder:v1:user-1:app-1') ?? '{}');
      expect(saved.form).toEqual(prefill);
      expect(saved.targetProfile).toBeUndefined();
      expect(saved.generatedCv).toBeUndefined();
      expect(saved.sourceRecommendationId).toBeUndefined();
    });
    resolveResponse(targetProfileResponse());
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Strategic directions' })).toBeVisible(),
    );
  });

  it('aborts an in-flight request and ignores its late AI response after clearing', async () => {
    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);
    vi.stubGlobal('fetch', fetchMock);
    localStorage.removeItem('glowbal:cv-builder:v1:user-1:app-1');

    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'Clear the draft on this device' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // The first request ignores AbortController in this mock and resolves late.
    // Its response must not repopulate the cleared AI state.
    resolveFirst(targetProfileResponse());
    await Promise.resolve();
    expect(screen.queryByRole('heading', { name: 'What the CV needs to prove' })).not.toBeInTheDocument();

    resolveSecond(targetProfileResponse());
    expect(await screen.findByRole('heading', { name: 'What the CV needs to prove' })).toBeVisible();
  });

  it('clears AI state, persists the safe form draft, and refreshes after a stale strategy response', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'STRATEGY_STALE',
            error: 'Your Personalized Strategy changed. Refresh the CV Builder and try again.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify(boundDraft(true)),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear the draft on this device' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your Personalized Strategy changed.');
    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('glowbal:cv-builder:v1:user-1:app-1') ?? '{}');
      expect(saved.form).toEqual(prefill);
      expect(saved.targetProfile).toBeUndefined();
      expect(saved.generatedCv).toBeUndefined();
      expect(saved.sourceRecommendationId).toBeUndefined();
    });
  });

  it('renders stale strategy errors in Vietnamese', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'STRATEGY_STALE',
            error: 'Your Personalized Strategy changed. Refresh the CV Builder and try again.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <LanguageProvider>
        <Vietnamese>
          <CvBuilderWorkspace
            applicationId="app-1"
            userId="user-1"
            universityName="Example University"
            programmeName="Computer Science"
            prefill={prefill}
            strategy={strategy}
          />
        </Vietnamese>
      </LanguageProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Xóa bản nháp trên thiết bị' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chiến lược cá nhân hóa của bạn đã thay đổi. Hãy làm mới trình tạo CV rồi thử lại.',
    );
  });

  it('keeps the selected alternative direction in the safe draft after a stale response', async () => {
    localStorage.removeItem('glowbal:cv-builder:v1:user-1:app-1');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'STRATEGY_STALE',
            error: 'Your Personalized Strategy changed. Refresh the CV Builder and try again.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const alternative = await screen.findByRole('button', {
      name: /Research-led technologist/,
    });
    await userEvent.click(alternative);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('glowbal:cv-builder:v1:user-1:app-1') ?? '{}');
      expect(saved.selectedDirection).toBe('Research-led technologist');
    });
  });

  it('does not allow Content or CV Draft navigation while F7 or Target Profile is unavailable', () => {
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={null}
      />,
    );

    expect(screen.getByRole('button', { name: 'Content' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'CV Draft' })).toBeDisabled();
  });

  it('shows all read-only strategy directions and the source report before Target Profile completes', async () => {
    localStorage.removeItem('glowbal:cv-builder:v1:user-1:app-1');
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Choose your CV direction' })).toBeVisible();
    expect(screen.getAllByRole('article', { name: /Direction / })).toHaveLength(2);
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Open Personalized Strategy' })).toHaveAttribute(
      'href',
      '/ai-strategy/app-1/strategy-report',
    );
    expect(screen.getByRole('status')).toBeVisible();
  });

  it('lets the student choose an alternative direction and sends it to Target Profile once', async () => {
    localStorage.removeItem('glowbal:cv-builder:v1:user-1:app-1');
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => targetProfileResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
        strategy={strategy}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const alternative = await screen.findByRole('button', {
      name: /Research-led technologist/,
    });
    expect(alternative).toHaveAttribute('aria-pressed', 'false');
    expect(alternative).not.toBeDisabled();
    await userEvent.click(alternative);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      expectedRecommendationId: strategy.recommendationId,
      selectedDirection: 'Research-led technologist',
    });
    expect(
      await screen.findByRole('button', { name: /Research-led technologist/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('translates the strategy block in Vietnamese', async () => {
    render(
      <LanguageProvider>
        <Vietnamese>
          <CvBuilderWorkspace
            applicationId="app-1"
            userId="user-1"
            universityName="Example University"
            programmeName="Computer Science"
            prefill={prefill}
            strategy={null}
          />
        </Vietnamese>
      </LanguageProvider>,
    );

    expect(await screen.findByText('Hoàn tất Chiến lược cá nhân hóa trước khi tạo CV.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Mở Chiến lược cá nhân hóa' })).toBeVisible();
  });

  it('translates the valid strategy direction and alignment UI in Vietnamese', async () => {
    render(
      <LanguageProvider>
        <Vietnamese>
          <CvBuilderWorkspace
            applicationId="app-1"
            userId="user-1"
            universityName="Example University"
            programmeName="Computer Science"
            prefill={prefill}
            strategy={strategy}
          />
        </Vietnamese>
      </LanguageProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Chọn định hướng CV' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Các định hướng chiến lược' })).toBeVisible();
    expect(screen.getAllByText('Đề xuất')).toHaveLength(1);
    expect(screen.getByText('Định hướng CV:')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Căn chỉnh chiến lược' })).toBeVisible();
    expect(screen.getAllByText(strategy.chosenDirection).length).toBeGreaterThan(0);
  });
});
