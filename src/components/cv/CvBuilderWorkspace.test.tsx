import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CvBuilderWorkspace } from './CvBuilderWorkspace';
import type {
  CvBuilderFormV1,
  CvTargetProfileV1,
  GeneratedCvV1,
} from '@/lib/ai/cv-builder';

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

describe('CvBuilderWorkspace', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows target evidence requirements without scoring a CV that does not exist yet', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
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
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
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
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
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

  it('offers only Harvard and AACC layouts and switches the CV preview', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
        form: prefill,
        generatedCv,
        selectedTemplate: 'technical',
      }),
    );
    render(
      <CvBuilderWorkspace
        applicationId="app-1"
        userId="user-1"
        universityName="Example University"
        programmeName="Computer Science"
        prefill={prefill}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /CV Draft/ }));
    await userEvent.click(screen.getByRole('button', { name: /Choose layout/ }));

    const harvard = screen.getByRole('button', { name: /Harvard/ });
    const aacc = screen.getByRole('button', { name: /AACC/ });
    expect(aacc).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Leadership/ })).not.toBeInTheDocument();
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

    await userEvent.click(harvard);
    expect(screen.getByRole('article', { name: 'CV Harvard' })).toHaveClass(
      'cv-harvard',
    );

    await userEvent.click(aacc);
    expect(aacc).toHaveAttribute('aria-pressed', 'true');
  });

  it('reorders CV sections with accessible buttons and drag and drop', async () => {
    localStorage.setItem(
      'glowbal:cv-builder:v1:user-1:app-1',
      JSON.stringify({
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
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
        schemaVersion: 'cv-builder-v1',
        applicationId: 'app-1',
        targetProfile,
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
});
