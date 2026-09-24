import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersonalReportV2 } from '../../domain';
import {
  PersonalCanvasView,
  type PersonalCanvasSectionKey,
} from './personal-canvas';
import { PersonalCanvasWorkspace } from './personal-canvas-workspace';

const NOT_AVAILABLE = {
  reason: 'Not enough evidence yet.',
  actions: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function report(): PersonalReportV2 {
  return {
    generatedAt: '2026-08-15T00:00:00.000Z',
    overallEvidenceConfidence: 'medium',
    coreIdentity: {
      available: true,
      headline: 'Someone who builds practical solutions',
      interpretation: 'A recurring builder pattern.',
      recurringRole: 'Builder',
      recurringBehaviours: ['Builds practical solutions'],
      valueOrientation: 'Impact',
      observations: ['Takes an active role in shaping practical responses.'],
      evidenceRefs: [],
      confidence: 'medium',
      stillDeveloping: [],
      insufficientData: null,
    },
    drivingForce: {
      available: true,
      headline: 'Motivation clearly confirmed',
      explanation: 'Impact and learning recur.',
      repeatedMotivations: ['Impact', 'Learning'],
      evidenceRefs: [],
      confidence: 'medium',
      isHypothesis: false,
      missingPersonalGrounding: null,
      reflectionPrompt: null,
      insufficientData: null,
    },
    signaturePattern: {
      available: false,
      steps: [],
      patternStrength: 'insufficient',
      supportingExperienceCount: 1,
      confidence: 'low',
      distinctiveness: null,
      evidenceRefs: [],
      insufficientData: NOT_AVAILABLE,
    },
    emergingThemes: {
      available: true,
      themes: [
        {
          theme: 'Education',
          status: 'strong_emerging_theme',
          statusLabel: 'Strong emerging theme',
          explanation: 'Education recurs.',
          supportingExperiences: ['Tutoring'],
          confidence: 'medium',
          limitation: 'Needs more contexts.',
          evidenceRefs: [],
        },
      ],
      insufficientData: null,
    },
    personalPositioning: {
      available: true,
      statement: 'An impact-oriented builder.',
      positioningStatus: 'emerging_positioning',
      authentic: true,
      differentiated: false,
      coherent: true,
      directionAligned: true,
      credible: true,
      whyThisFits: [],
      whatPreventsStrongerPositioning: ['Needs broader evidence.'],
      confidence: 'medium',
      evidenceRefs: [],
      insufficientData: null,
    },
    proofOfMe: {
      available: true,
      cards: [
        {
          activityId: 'activity-1',
          title: 'Birmingham Project Award',
          role: 'Team lead',
          personalContribution: 'Led a team to complete the project.',
          outcome: 'Won the Birmingham Project Award.',
          competenciesDemonstrated: ['Team Leadership'],
          supports: ['Core Identity'],
          evidenceStrength: 'strong',
          verificationStatus: 'attributable',
          evidenceSource: 'Birmingham Project Award',
          evidenceRefs: [],
        },
      ],
      insufficientData: null,
    },
    analytics: {
      competencyEvidenceProfile: [
        {
          key: 'hard',
          label: 'Hard-skill specificity',
          score: 80,
          confidence: 'medium',
          evidenceRefs: [],
        },
        {
          key: 'soft',
          label: 'Soft-skill specificity',
          score: 70,
          confidence: 'medium',
          evidenceRefs: [],
        },
      ],
      narrativeIdentitySignals: [
        {
          key: 'patternConsistency',
          label: 'Pattern consistency',
          score: 62,
          confidence: 'medium',
          evidenceRefs: [],
        },
      ],
      signaturePatternSupport: [],
      themeMaturity: [],
      positioningDimensions: [],
      evidenceSummary: {
        totalItems: 6,
        verification: { verified: 1, attributable: 2, stated: 3 },
        strength: { strong: 2, moderate: 3, limited: 1 },
        competencyClaims: { hard: 2, soft: 2, meta: 1 },
      },
    },
  };
}

describe('PersonalCanvasView', () => {
  it('renders all six Personal Canvas areas as interactive controls without the old intro block', () => {
    const onSelect = vi.fn();

    render(
      <PersonalCanvasView
        report={report()}
        activeSection={null}
        onSelect={onSelect}
      />,
    );

    expect(
      screen.queryByText('Your applicant profile, in six connected parts'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Start with the whole picture/i),
    ).not.toBeInTheDocument();

    const labels = [
      'Core Identity',
      'Driving Forces',
      'Proven Capabilities',
      'Social Proof',
      'Areas for Growth',
      'Long-Term Vision',
    ];

    for (const label of labels) {
      expect(
        screen.getAllByRole('button', { name: new RegExp(label, 'i') }).length,
      ).toBeGreaterThan(0);
    }

    fireEvent.click(screen.getAllByRole('button', { name: /social proof/i })[0]!);
    expect(onSelect).toHaveBeenCalledWith('socialProof' satisfies PersonalCanvasSectionKey);
  });

  it('marks the selected Canvas section as active', () => {
    render(
      <PersonalCanvasView
        report={report()}
        activeSection="coreIdentity"
        onSelect={() => undefined}
      />,
    );

    expect(screen.getAllByRole('button', { name: /core identity/i })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('keeps verbose generated findings in the detail modal instead of overflowing the canvas', () => {
    const verbose =
      'I genuinely enjoy exploring artificial intelligence, especially how machine learning systems learn, make decisions, and sometimes fail. What interests me most is understanding what happens underneath them from model architecture to real-world deployment.';
    const candidate = report();
    candidate.coreIdentity.headline = null;
    candidate.coreIdentity.recurringRole = verbose;

    render(
      <PersonalCanvasView
        report={candidate}
        activeSection={null}
        onSelect={() => undefined}
      />,
    );

    const previews = document.querySelectorAll(
      '[data-canvas-section="coreIdentity"] [data-no-auto-translate]',
    );
    expect(previews.length).toBe(2);
    for (const preview of previews) {
      expect(preview.textContent).toContain('…');
      expect(preview.textContent).not.toContain('real-world deployment');
    }
  });
});

describe('PersonalCanvasWorkspace', () => {
  it('opens a contextual detail modal and has no sound toggle', async () => {
    render(
      <PersonalCanvasWorkspace
        report={report()}
        returnTo={undefined}
        onRegenerate={undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: /sounds/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /social proof/i })[0]!);

    expect(
      screen.getByRole('dialog', { name: /social proof details/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /close section/i }));
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /social proof details/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('captures new supporting evidence inside an insufficient Canvas section and regenerates', async () => {
    const withGap = report();
    withGap.coreIdentity = {
      ...withGap.coreIdentity,
      available: false,
      headline: null,
      interpretation: null,
      recurringRole: null,
      recurringBehaviours: [],
      valueOrientation: null,
      insufficientData: {
        reason: 'A second experience is needed to establish a recurring pattern.',
        actions: [
          {
            kind: 'add_activity',
            label: 'Add another activity or achievement',
            href: '/ai-strategy/reflection/achievements',
          },
        ],
      },
    };

    const onRegenerate = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PersonalCanvasWorkspace
        report={withGap}
        returnTo={undefined}
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /core identity/i })[0]!);
    expect(screen.getByText('More evidence needed')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add another activity or achievement' }),
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'I organised a peer mentoring programme and matched 18 students with mentors.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save & update report' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai-strategy/personal-report/evidence',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(onRegenerate).toHaveBeenCalledWith('supplement_answer');
    });
  });
});

/**
 * Keyboard shortcut regressions.
 *
 * The canvas binds bare 1-6, Escape and F on `window`. Before these tests it
 * did so without checking modifier keys, so browser and OS chords collided with
 * it — most damagingly Cmd/Ctrl+F, which toggled focus mode AND called
 * preventDefault(), disabling find-in-page across the whole report.
 */
describe('PersonalCanvasWorkspace keyboard shortcuts', () => {
  function renderWorkspace() {
    return render(
      <PersonalCanvasWorkspace report={report()} returnTo={undefined} onRegenerate={undefined} />,
    );
  }

  function panel() {
    return screen.queryByRole('dialog', { name: /details$/i });
  }

  it('opens a section on a bare number key', () => {
    renderWorkspace();
    fireEvent.keyDown(window, { key: '1' });
    expect(panel()).toBeInTheDocument();
  });

  it('does not hijack Cmd+F or Ctrl+F, so find-in-page still works', () => {
    renderWorkspace();

    const meta = new KeyboardEvent('keydown', { key: 'f', metaKey: true, cancelable: true });
    const ctrl = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, cancelable: true });
    window.dispatchEvent(meta);
    window.dispatchEvent(ctrl);

    expect(meta.defaultPrevented).toBe(false);
    expect(ctrl.defaultPrevented).toBe(false);
  });

  it('does not open a section on Cmd+1 or Ctrl+2, which switch browser tabs', () => {
    renderWorkspace();
    fireEvent.keyDown(window, { key: '1', metaKey: true });
    expect(panel()).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: '2', ctrlKey: true });
    expect(panel()).not.toBeInTheDocument();
  });

  it('ignores Alt chords', () => {
    renderWorkspace();
    fireEvent.keyDown(window, { key: '3', altKey: true });
    expect(panel()).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    renderWorkspace();
    fireEvent.keyDown(window, { key: '1' });
    expect(panel()).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
  });

  it('does not fire while the user is typing in a contenteditable field', () => {
    renderWorkspace();
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    document.body.appendChild(editable);

    fireEvent.keyDown(editable, { key: '1' });
    expect(panel()).not.toBeInTheDocument();

    document.body.removeChild(editable);
  });

  it('moves focus to the close button when the modal opens', () => {
    renderWorkspace();
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByRole('button', { name: /close section/i })).toHaveFocus();
  });

  it('hands focus back to the control that opened the panel when it closes', async () => {
    renderWorkspace();
    const trigger = screen.getAllByRole('button', { name: /core identity/i })[0]!;
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: /close section/i })).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('leaves focus alone if the user moved on before the panel closed', async () => {
    renderWorkspace();
    const trigger = screen.getAllByRole('button', { name: /core identity/i })[0]!;
    fireEvent.click(trigger);

    const elsewhere = screen.getAllByRole('button', { name: /driving forces/i })[0]!;
    elsewhere.focus();
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(elsewhere).toHaveFocus();
  });
});
