import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminAiReportReview } from '@/features/ai-strategy-dashboard/api';
import { AdminAiReportReviewClient } from './admin-ai-report-review-client';

const review: AdminAiReportReview = {
  application: {
    applicationId: '11111111-1111-4111-8111-111111111111',
    courseName: 'Computer Science',
    universityName: 'Example University',
    subject: 'Engineering',
    lastGeneratedAt: '2026-09-12T00:00:00.000Z',
    availableReports: ['personal', 'matching', 'strategy'],
  },
  nodes: [
    { id: 'personal', kind: 'personal' as const, title: 'Personal Report', available: true, generatedAt: '2026-09-10T00:00:00.000Z', modelName: 'gpt-test', promptVersion: 'personal-v1', inputHash: 'personal-hash', sources: [{ label: 'Candidate snapshot', value: 'snapshot-1' }], outputFormat: 'personal_report_v2', output: { overallEvidenceConfidence: 'high', coreIdentity: { headline: 'Builder', recurringRole: 'Builder', recurringBehaviours: ['Builds'] }, drivingForce: { headline: 'Curiosity', repeatedMotivations: ['Curiosity'] }, signaturePattern: { headline: 'Learn by doing', steps: [] }, emergingThemes: { themes: [] }, personalPositioning: { statement: 'Builder', whyThisFits: [] }, proofOfMe: { cards: [] } }, rawOutput: { overallEvidenceConfidence: 'high' }, inputs: { sections: [] }, metadata: {} },
    { id: 'matching', kind: 'matching' as const, title: 'Matching Report', available: true, generatedAt: '2026-09-11T00:00:00.000Z', modelName: 'gpt-test', promptVersion: 'matching-v1', inputHash: 'matching-hash', sources: [{ label: 'Personal Report version', value: 'personal-1' }], outputFormat: 'unknown', output: { report: 'matching output' }, rawOutput: { report: 'matching output' }, inputs: { sections: [] }, metadata: {} },
    { id: 'strategy', kind: 'strategy' as const, title: 'Strategy Report', available: true, generatedAt: '2026-09-12T00:00:00.000Z', modelName: 'gpt-test', promptVersion: 'strategy-v1', inputHash: 'strategy-hash', sources: [{ label: 'Matching Report', value: 'matching-1' }], outputFormat: 'unknown', output: { report: 'strategy output' }, rawOutput: { report: 'strategy output' }, inputs: { sections: [] }, metadata: {} },
  ],
};

describe('AdminAiReportReviewClient', () => {
  it('renders Personal Report in the same six readable chapters shown to students', () => {
    const personalReview: AdminAiReportReview = {
      application: review.application,
      nodes: [
        {
          ...review.nodes[0],
          output: {
            overallEvidenceConfidence: 'high',
            coreIdentity: {
              available: true,
              confidence: 'high',
              headline: 'Evidence-led builder',
              interpretation: 'Turns ambiguous problems into practical systems.',
              recurringRole: 'Builder',
              valueOrientation: 'Useful impact',
              recurringBehaviours: ['Builds prototypes', 'Tests assumptions'],
              observations: ['Repeatedly moves from research to a working prototype.'],
              stillDeveloping: ['Needs more externally verified outcomes.'],
              evidenceRefs: ['internal-evidence-id'],
              insufficientData: null,
            },
            drivingForce: {
              available: true,
              confidence: 'medium',
              headline: 'Curiosity directed at useful outcomes',
              explanation: 'The same motivation appears across research and community work.',
              repeatedMotivations: ['Understanding complex systems', 'Helping other learners'],
              evidenceRefs: [],
              isHypothesis: true,
              missingPersonalGrounding: null,
              reflectionPrompt: null,
              insufficientData: null,
            },
            signaturePattern: {
              available: true,
              confidence: 'high',
              patternStrength: 'established',
              supportingExperienceCount: 3,
              steps: [
                { key: 'trigger', label: 'Trigger', description: 'Finds an unclear problem', examples: ['Robotics club'] },
                { key: 'response', label: 'Response', description: 'Takes ownership', examples: [] },
              ],
              distinctiveness: 'Combines technical depth with practical ownership.',
              evidenceRefs: [],
              insufficientData: null,
            },
            emergingThemes: {
              available: true,
              narrative: 'Technology and education recur across the profile.',
              themes: [
                {
                  theme: 'Technology for learning',
                  statusLabel: 'Established theme',
                  explanation: 'Appears in three separate experiences.',
                  supportingExperiences: ['Robotics club', 'Peer tutoring'],
                  limitation: 'Impact evidence is still mostly self-reported.',
                  confidence: 'high',
                  evidenceRefs: [],
                },
              ],
              insufficientData: null,
            },
            personalPositioning: {
              available: true,
              confidence: 'high',
              statement: 'A builder who makes complex technology useful for learners.',
              authentic: true,
              differentiated: true,
              coherent: true,
              directionAligned: true,
              credible: false,
              positioningStatus: 'emerging',
              whyThisFits: ['Supported by repeated building and teaching experiences.'],
              whatPreventsStrongerPositioning: ['Needs one externally verified impact result.'],
              evidenceRefs: [],
              insufficientData: null,
            },
            proofOfMe: {
              available: true,
              narrative: 'The strongest proof comes from sustained technical leadership.',
              cards: [
                {
                  activityId: 'internal-activity-id',
                  title: 'Robotics Club',
                  role: 'Team lead',
                  organisation: 'Example Lab',
                  period: '2024–2026',
                  evidenceSource: 'Mentor confirmation',
                  sources: [{ fileName: 'mentor-letter.pdf' }],
                  personalContribution: 'Designed the control system and mentored four members.',
                  outcome: 'Reached the national final.',
                  competenciesDemonstrated: ['Systems thinking', 'Leadership'],
                  supports: ['Builder positioning'],
                  evidenceStrength: 'strong',
                  verificationStatus: 'verified',
                  evidenceRefs: [],
                },
              ],
              insufficientData: null,
            },
            analytics: {
              competencyEvidenceProfile: [],
              narrativeIdentitySignals: [{ key: 'patternConsistency', label: 'Pattern consistency', score: 72, confidence: 'high' }],
              signaturePatternSupport: [],
              themeMaturity: [],
              positioningDimensions: [],
              evidenceSummary: {
                totalItems: 1,
                verification: { verified: 1, attributable: 0, stated: 0 },
                strength: { strong: 1, moderate: 0, limited: 0 },
                competencyClaims: { hard: 1, soft: 0, meta: 0 },
              },
            },
            canvasDetails: {
              capabilities: [{ name: 'Systems thinking', score: 78, stars: 4, band: 'strong', confidence: 'medium', evidenceCount: 2, strongEvidenceCount: 1, verifiedEvidenceCount: 1, why: 'Demonstrated across two projects.', supportingEvidence: [{ activityId: 'internal-activity-id', title: 'Prototype pilot', outcome: 'Used by peers.', evidenceStrength: 'strong', verificationStatus: 'verified' }] }],
              motivations: [{ label: 'Making technology useful', score: 67, evidenceCount: 2, confidence: 'medium' }],
              socialProof: [{ key: 'activities', label: 'Experiences analysed', value: 1, caption: 'Activities contributing evidence to this report', evidenceIds: [] }],
              growthPriorities: [],
              futurePathways: [],
            },
            overallSummary: {
              paragraphs: ['The profile is coherent, evidence-led and ready for targeted development.'],
            },
          },
        },
      ],
    };

    render(<AdminAiReportReviewClient items={[personalReview.application]} initialReview={personalReview} />);

    for (const chapter of ['Core Identity', 'Driving Forces', 'Proven Capabilities', 'Social Proof', 'Areas for Growth', 'Long-Term Vision']) {
      expect(screen.getByRole('heading', { level: 2, name: chapter })).toBeInTheDocument();
    }
    expect(screen.getByText('Who they consistently are')).toBeInTheDocument();
    expect(screen.getAllByText('Evidence-led builder').length).toBeGreaterThan(0);
    expect(screen.getAllByText('A builder who makes complex technology useful for learners.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Robotics Club').length).toBeGreaterThan(0);
    expect(screen.getByText('Reached the national final.')).toBeInTheDocument();
    expect(screen.getByText('Identity evidence profile')).toBeInTheDocument();
    expect(screen.getByText('Making technology useful')).toBeInTheDocument();
    expect(screen.getByText('Prototype pilot')).toBeInTheDocument();
    expect(screen.getByText(/Example Lab/)).toBeInTheDocument();
    expect(screen.getByText(/2024–2026/)).toBeInTheDocument();
    expect(screen.getByText('Mentor confirmation')).toBeInTheDocument();
    expect(screen.getAllByText('The profile is coherent, evidence-led and ready for targeted development.').length).toBeGreaterThan(0);
    expect(screen.queryByText('internal-evidence-id')).not.toBeInTheDocument();
    expect(screen.queryByText('internal-activity-id')).not.toBeInTheDocument();
  });

  it('renders Matching Report as student-facing fit chapters instead of nested field tiles', () => {
    const matchingReview: AdminAiReportReview = {
      application: review.application,
      nodes: [{
        ...review.nodes[1],
        outputFormat: 'matching_report_v3',
        output: {
          overall: { summary: 'The student has a credible academic fit with one evidence gap.', overallAlignmentScore: 78, evidenceCoverage: 72, confidence: 0.82 },
          universityFit: { score: 80, status: 'assessed', confidence: 0.84, coverage: 76, summary: 'Strong values and academic alignment.', metrics: { academicReadiness: { id: 'academicReadiness', score: 82, status: 'assessed', confidence: 0.85, coverage: 80, summary: 'Academic preparation is strong.', submetrics: [] } } },
          programmeFit: { score: 75, status: 'assessed', confidence: 0.8, coverage: 70, summary: 'Good programme fit with limited direct exposure.', metrics: { capability: { id: 'capability', score: 79, status: 'assessed', confidence: 0.8, coverage: 74, summary: 'Relevant capabilities are visible.', submetrics: [] } }, strongestAlignment: ['capability'], potentialGap: 'Limited formal computing coursework.', strategicInterpretation: 'Lead with applied systems work.' },
          keyTakeaways: { strongestFit: { title: 'Strongest fit', body: 'Applied problem solving is the clearest match.' }, competitiveAdvantage: { title: 'Competitive advantage', body: 'Combines technical building with peer teaching.' }, criticalGap: { title: 'Critical gap', body: 'Needs stronger academic computing evidence.' }, strategicDirection: { title: 'Strategic direction', body: 'Connect projects to programme outcomes.' } },
          strengths: [{ title: 'Applied builder', description: 'Repeatedly converts ideas into working systems.' }],
          gaps: [{ title: 'Academic depth', description: 'Formal computing evidence is still limited.' }],
          positioningOpportunities: [{ title: 'Technology for learning', description: 'Use the teaching thread as a differentiator.' }],
          hardRequirements: [{ label: 'English language requirement', status: 'unknown', applicantValue: null, requiredValue: 'IELTS 7.0', explanation: 'No valid score was found.' }],
          scholarshipAlignment: null,
          evidenceIndex: [],
          targetSourceIndex: [],
        },
      }],
    };

    render(<AdminAiReportReviewClient items={[matchingReview.application]} initialReview={matchingReview} />);

    for (const heading of ['University Fit', 'Programme Fit', 'Key Takeaways & Strategic Direction', 'Hard Requirements & Eligibility']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Strong values and academic alignment.')).toBeInTheDocument();
    expect(screen.getByText('Applied builder')).toBeInTheDocument();
    expect(screen.getByText('IELTS 7.0')).toBeInTheDocument();
    expect(screen.queryByText('Academic Readiness', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('renders Strategy Report as overview, development, narrative, and roadmap chapters', () => {
    const strategyReview: AdminAiReportReview = {
      application: review.application,
      nodes: [{
        ...review.nodes[2],
        outputFormat: 'strategy_report_v3',
        output: {
          strategicOverview: {
            currentPosition: { summary: 'A coherent builder profile with uneven evidence.', profileStrength: { statement: 'Technical ownership is clear.' }, keyChallenge: { statement: 'External impact proof is limited.' } },
            strategicOpportunity: { statement: 'Connect technical work to education outcomes.' },
            strategicGoal: { directionOfImprovement: 'Deepen verified impact.', communicationGoal: 'Present one coherent builder narrative.' },
            expectedOutcome: 'A credible and differentiated application story.',
            topPriorities: [{ rank: 1, title: 'Verify project impact', why: 'Current outcomes are self-reported.', suggestedDirection: 'Collect usage and mentor evidence.', interventionKind: 'add_evidence', factors: { impact: 4, relevance: 4, evidenceGap: 4, feasibility: 3, urgency: 4, rawPriority: 768 } }],
          },
          profileDevelopmentStrategy: {
            areas: [{ label: 'Evidence', category: 'evidence', status: 'develop', diagnosis: 'Good claims, limited verification.', whyItMatters: 'Admissions readers need proof.', suggestedDirection: 'Verify the strongest two outcomes.' }],
            activityAnalyses: [{ title: 'Robotics Club', classification: 'maintain', diagnosis: 'Strong sustained leadership.', recommendedMove: 'Quantify team and competition outcomes.', dimensions: { impact: { status: 'developing', statement: 'Outcome exists but is not quantified.' } } }],
          },
          narrativeStrategy: { coreNarrativeDirection: { originTrigger: 'Curiosity about automation.', recurringMotivation: 'Making systems useful.', actions: ['Built prototypes'], capabilitiesDeveloped: ['Systems thinking'], emergingDirection: 'Technology for learning', insight: 'The thread is strongest when linked to users.' }, supportingThemes: [{ title: 'Useful technology', significance: 'Connects building and teaching.' }], narrativeTension: { observedGap: 'Impact is claimed more than demonstrated.', whyItMatters: 'It weakens credibility.', possibleDirection: 'Add external proof.' }, narrativeOptions: [{ title: 'Builder for learners', centralIdea: 'Make complex systems useful.', whyItEmerges: 'Repeated building and teaching.', whatCouldStrengthenIt: 'Verified adoption data.', strategicFit: 'high' }] },
          strategicRoadmap: [{ name: 'Strengthen Foundation', phaseKey: 'strengthen_foundation', goal: 'Verify the evidence base.', estimatedTimeline: 'Weeks 1–2', keyActions: ['Collect mentor confirmation'], deliverables: [{ label: 'Evidence pack', kind: 'evidence' }], successCriteria: ['Two outcomes independently verified'] }],
          evidenceIndex: [],
          targetSourceIndex: [],
        },
      }],
    };

    render(<AdminAiReportReviewClient items={[strategyReview.application]} initialReview={strategyReview} />);

    for (const heading of ['Strategic Overview', 'Profile Development Strategy', 'Narrative Strategy', 'Strategic Roadmap']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Verify project impact')).toBeInTheDocument();
    expect(screen.getByText('Good claims, limited verification.')).toBeInTheDocument();
    expect(screen.getByText('Robotics Club')).toBeInTheDocument();
    expect(screen.getByText('Strengthen Foundation')).toBeInTheDocument();
    expect(screen.queryByText('Raw Priority')).not.toBeInTheDocument();
  });

  it('shows the selected report output when an admin follows the graph', () => {
    render(<AdminAiReportReviewClient items={[review.application]} initialReview={review} />);

    expect(screen.getAllByText('Builder').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Output' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Inputs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Technical' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Matching Report' }));

    expect(screen.getByText(/Legacy or partially validated output/)).toBeInTheDocument();
    expect(screen.getByText('matching output')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }));
    expect(screen.getByText('matching-hash')).toBeInTheDocument();
  });

  it('keeps raw JSON secondary and exposes it from Technical', () => {
    render(<AdminAiReportReviewClient items={[review.application]} initialReview={review} />);
    expect(screen.queryByText('"overallEvidenceConfidence"')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }));
    expect(screen.getByText(/overallEvidenceConfidence/)).toBeInTheDocument();
  });

  it('formats legacy report sections, KPI badges, summaries, and theme cards clearly', () => {
    const legacyReview: AdminAiReportReview = {
      application: review.application,
      nodes: [
        {
          id: 'strategy',
          kind: 'strategy',
          title: 'Strategy Report',
          available: true,
          generatedAt: '2026-09-12T00:00:00.000Z',
          modelName: 'gpt-test',
          promptVersion: 'strategy-v1',
          inputHash: 'strategy-hash',
          sources: [],
          outputFormat: 'unknown',
          output: {
            report: {
              overview: {
                summary:
                  'Strong academic foundation in Economics and Mathematics from top Vietnamese institutions, combined with impactful leadership in student research.',
                status: 'possible_theme',
              },
              snapshot: {
                confidence: 0.85,
                coverage: 'comprehensive',
                fitRating: 'high',
              },
              analytics: {
                evidenceRefs: ['ev-1', 'ev-2', 'ev-3', 'ev-4', 'ev-5'],
                themeMaturity: [
                  {
                    name: 'Empirical Economic Research',
                    status: 'emerging',
                    confidence: 0.82,
                    evidenceCount: 7,
                  },
                  {
                    name: 'Sustainability & Climate Policy',
                    status: 'established',
                    confidence: 0.88,
                    evidenceCount: 9,
                  },
                ],
              },
            },
          },
          rawOutput: {},
          inputs: { sections: [] },
          metadata: {},
        },
      ],
    };

    render(<AdminAiReportReviewClient items={[legacyReview.application]} initialReview={legacyReview} />);

    // Top-level sections unwrapped from 'report'
    expect(screen.getByRole('heading', { level: 3, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Snapshot' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Analytics' })).toBeInTheDocument();

    // Summary callout
    expect(screen.getByText(/Strong academic foundation in Economics and Mathematics/)).toBeInTheDocument();

    // KPI & Metric badges
    expect(screen.getByText('Possible Theme')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Comprehensive')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();

    // Theme maturity object cards
    expect(screen.getByText('Empirical Economic Research')).toBeInTheDocument();
    expect(screen.getByText('Sustainability & Climate Policy')).toBeInTheDocument();
    expect(screen.getByText('82% conf')).toBeInTheDocument();
    expect(screen.getByText('88% conf')).toBeInTheDocument();
    expect(screen.getByText('7 evidence')).toBeInTheDocument();
    expect(screen.getByText('9 evidence')).toBeInTheDocument();

    // Collapsible references
    expect(screen.getByText('5 items')).toBeInTheDocument();
  });

  it('partitions candidate snapshot into distinct sections and separates achievements from reflections', () => {
    const candidateSnapshotReview: AdminAiReportReview = {
      application: review.application,
      nodes: [
        {
          id: 'personal',
          kind: 'personal',
          title: 'Personal Report',
          available: true,
          generatedAt: '2026-09-12T00:00:00.000Z',
          modelName: 'gpt-test',
          promptVersion: 'personal-v1',
          inputHash: 'personal-hash',
          sources: [],
          outputFormat: 'personal_report_v2',
          output: { overallEvidenceConfidence: 'high' },
          rawOutput: {},
          inputs: {
            sections: [
              {
                label: 'Confirmed candidate snapshot',
                persisted: true,
                value: {
                  payload: {
                    reflection: {
                      educationLevel: 'High school',
                      gpa: 3.9,
                      achievements: [
                        {
                          id: 'ach-1',
                          title: 'National Mathematics Olympiad',
                          category: 'competition',
                          level: 'national',
                          year: 2024,
                          sources: [
                            {
                              fileName: 'CV - Dương Hoàng Yến (2).pdf',
                              page: 3,
                              quote: '90% Scholarship for High School (A levels) for 2 consecutive years',
                              documentId: 'doc-uuid-a07ac8f4',
                            },
                          ],
                          reflection: {
                            context: 'Entered a high-stakes national contest.',
                            learning: 'Developed rigorous analytical problem-solving skills.',
                          },
                          reflectionCard: {
                            story: 'Trained intensively for 6 months.',
                            status: 'confirmed',
                          },
                        },
                      ],
                      activities: [
                        {
                          id: 'act-1',
                          title: 'Robotics Club Leader',
                          category: 'leadership',
                          period: '2023 - 2024',
                        },
                      ],
                      personalReflection: {
                        q1: 'I genuinely enjoy building automated systems and exploring machine learning algorithms.',
                      },
                    },
                    documents: [
                      { id: 'doc-1', fileName: 'Academic Transcript.pdf' },
                    ],
                  },
                },
              },
            ],
          },
          metadata: {},
        },
      ],
    };

    render(
      <AdminAiReportReviewClient
        items={[candidateSnapshotReview.application]}
        initialReview={candidateSnapshotReview}
      />
    );

    // Switch to Inputs tab
    fireEvent.click(screen.getByRole('tab', { name: 'Inputs' }));

    // Verify distinct section headers
    expect(screen.getByText('Academic & Profile Baseline')).toBeInTheDocument();
    expect(screen.getByText('Achievements (Thành tích)')).toBeInTheDocument();
    expect(screen.getByText(/1 verified achievement/)).toBeInTheDocument();
    expect(screen.getByText('Activities & Extracurriculars (Hoạt động)')).toBeInTheDocument();
    expect(screen.getByText('Personal Reflection (Suy ngẫm cá nhân)')).toBeInTheDocument();

    // Verify achievement facts
    expect(screen.getByText('National Mathematics Olympiad')).toBeInTheDocument();
    expect(screen.getByText('Competition')).toBeInTheDocument();
    expect(screen.getByText('National')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();

    // Verify sources citation format (not squished, documentId omitted)
    expect(screen.getByText('Verified Sources (1)')).toBeInTheDocument();
    expect(screen.getByText('CV - Dương Hoàng Yến (2).pdf')).toBeInTheDocument();
    expect(screen.getByText('Page 3')).toBeInTheDocument();
    expect(
      screen.getByText(/90% Scholarship for High School \(A levels\) for 2 consecutive years/)
    ).toBeInTheDocument();
    expect(screen.queryByText('doc-uuid-a07ac8f4')).not.toBeInTheDocument();

    // Verify distinct Student Reflection callout inside achievement card
    expect(screen.getByText('Student Reflection (Góc suy ngẫm)')).toBeInTheDocument();
    expect(screen.getByText('Entered a high-stakes national contest.')).toBeInTheDocument();
    expect(screen.getByText('Developed rigorous analytical problem-solving skills.')).toBeInTheDocument();
    expect(screen.getByText('Trained intensively for 6 months.')).toBeInTheDocument();

    // Verify Personal Reflection Q&A section
    expect(
      screen.getByText(/What topics, activities, or problems do you genuinely enjoy exploring\?/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/I genuinely enjoy building automated systems and exploring machine learning algorithms\./)
    ).toBeInTheDocument();
  });

  it('renders executive pipeline step badges, unwraps root report with companion keys, and formats string confidence as badge', () => {
    const reportWithLowConfidence: AdminAiReportReview = {
      application: review.application,
      nodes: [
        {
          id: 'personal',
          kind: 'personal',
          title: 'Personal Report',
          available: true,
          generatedAt: '2026-09-13T09:06:00.000Z',
          modelName: 'gpt-test',
          promptVersion: 'personal-v1',
          inputHash: 'personal-hash',
          sources: [],
          outputFormat: 'unknown',
          output: {
            schemaVersion: '1.0',
            generatedAt: '2026-09-13T09:06:00.000Z',
            report: {
              overallEvidenceConfidence: 'low',
              coreThemes: {
                headline: 'Self-directed technologist',
                status: 'emerging',
              },
            },
          },
          rawOutput: {},
          inputs: { sections: [] },
          metadata: {},
        },
      ],
    };

    render(
      <AdminAiReportReviewClient
        items={[reportWithLowConfidence.application]}
        initialReview={reportWithLowConfidence}
      />
    );

    // Verify pipeline step badge
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Viewing')).toBeInTheDocument();

    // Verify root report unwrapped and companion schemaVersion omitted
    expect(screen.queryByRole('heading', { level: 3, name: 'Report' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Report Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Core Themes' })).toBeInTheDocument();

    // Verify overallEvidenceConfidence is rendered as a badge tile rather than a narrative
    expect(screen.getByText('Overall Evidence Confidence')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('formats evidence reference cards cleanly without internal UUIDs, duplicated label tiles, or overflowing badges', () => {
    const evidenceRefReview: AdminAiReportReview = {
      application: review.application,
      nodes: [
        {
          id: 'strategy',
          kind: 'strategy',
          title: 'Strategy Report',
          available: true,
          generatedAt: '2026-09-12T00:00:00.000Z',
          modelName: 'gpt-test',
          promptVersion: 'strategy-v1',
          inputHash: 'strategy-hash',
          sources: [],
          outputFormat: 'unknown',
          output: {
            report: {
              evidenceRefs: [
                {
                  id: 'achievement:5706aa95-09f2-4567-b340-4b83a38ab567',
                  kind: 'structured_achievement',
                  label: 'Runner-Up – The Global Futures Challenge',
                },
                {
                  id: 'achievement:a9c68f73-d10d-4d50-9dab-ad8debcb4e3',
                  kind: 'structured_achievement',
                  label: 'Top 20 of the IEO Essay Challenge',
                },
              ],
            },
          },
          rawOutput: {},
          inputs: { sections: [] },
          metadata: {},
        },
      ],
    };

    render(
      <AdminAiReportReviewClient
        items={[evidenceRefReview.application]}
        initialReview={evidenceRefReview}
      />
    );

    // Verify Evidence Refs section heading
    expect(screen.getByText('Evidence Refs')).toBeInTheDocument();

    // Verify titles are rendered in the card header
    expect(screen.getByText('Runner Up – The Global Futures Challenge')).toBeInTheDocument();
    expect(screen.getByText('Top 20 Of The IEO Essay Challenge')).toBeInTheDocument();

    // Verify kind is extracted into a badge in the header
    const kindBadges = screen.getAllByText('Structured Achievement');
    expect(kindBadges.length).toBe(2);

    // Verify internal UUIDs are omitted
    expect(screen.queryByText(/5706aa95-09f2-4567-b340-4b83a38ab567/)).not.toBeInTheDocument();
    expect(screen.queryByText(/a9c68f73-d10d-4d50-9dab-ad8debcb4e3/)).not.toBeInTheDocument();

    // Verify label is not duplicated inside the card as a separate dl/dd tile
    expect(screen.queryByText('LABEL')).not.toBeInTheDocument();
  });
});
