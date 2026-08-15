import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditEvidenceModal, type EvidenceDraft } from './edit-evidence-modal';

const t = (key: string, vars?: Record<string, string | number>) => {
  if (!vars) return key;
  return Object.entries(vars).reduce((acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)), key);
};

const achievement: EvidenceDraft = {
  kind: 'achievement',
  id: 'ach-1',
  category: 'research',
  title: 'Algowise 2026 AI research paper',
  competition: 'N/A',
  organisation: 'N/A',
  level: 'N/A',
  year: 2026,
  detail: 'Accepted onto the program.',
  reviewStatus: 'reviewed',
  sourceType: 'manual',
};

const activity: EvidenceDraft = {
  kind: 'activity',
  id: 'act-1',
  category: 'leadership',
  title: 'Robotics Club President',
  organisation: 'Greenfield International School',
  level: 'International',
  period: '2024 – Present',
  description: 'Led a 20-person robotics team.',
  reviewStatus: 'reviewed',
  sourceType: 'manual',
};

describe('EditEvidenceModal', () => {
  it('normalises literal "N/A" values to blank fields on open', () => {
    render(<EditEvidenceModal open draft={achievement} onClose={vi.fn()} onSave={vi.fn()} t={t} />);

    expect(screen.getByLabelText(/Competition or organisation name/)).toHaveValue('');
    expect(screen.getByLabelText(/Organising body/)).toHaveValue('');
    // The level Select falls back to its placeholder rather than showing "N/A".
    expect(screen.getByLabelText(/^Level$/)).toHaveValue('');
  });

  it('saves the achievement with the edited fields', async () => {
    const onSave = vi.fn();
    render(<EditEvidenceModal open draft={achievement} onClose={vi.fn()} onSave={onSave} t={t} />);

    await userEvent.clear(screen.getByLabelText(/Achievement name/));
    await userEvent.type(screen.getByLabelText(/Achievement name/), 'Updated title');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated title', year: 2026 }));
  });

  it('blocks save and shows inline errors when required fields are empty', async () => {
    const onSave = vi.fn();
    render(<EditEvidenceModal open draft={achievement} onClose={vi.fn()} onSave={onSave} t={t} />);

    await userEvent.clear(screen.getByLabelText(/Achievement name/));
    await userEvent.clear(screen.getByLabelText(/^Description/));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Enter an achievement name.')).toBeInTheDocument();
    expect(screen.getByText('Add a short description.')).toBeInTheDocument();
  });

  it('closes immediately when nothing changed', async () => {
    const onClose = vi.fn();
    render(<EditEvidenceModal open draft={achievement} onClose={onClose} onSave={vi.fn()} t={t} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('asks to discard unsaved changes before closing, and only closes on confirmation', async () => {
    const onClose = vi.fn();
    render(<EditEvidenceModal open draft={achievement} onClose={onClose} onSave={vi.fn()} t={t} />);

    await userEvent.type(screen.getByLabelText(/Achievement name/), ' v2');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Achievement name/)).toHaveValue('Algowise 2026 AI research paper v2');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders activity-specific fields for an activity draft', () => {
    render(<EditEvidenceModal open draft={activity} onClose={vi.fn()} onSave={vi.fn()} t={t} />);

    expect(screen.getByText('Edit extracurricular activity')).toBeInTheDocument();
    expect(screen.getByLabelText(/Activity title/)).toHaveValue('Robotics Club President');
    expect(screen.getByLabelText(/^Period$/)).toHaveValue('2024 – Present');
    expect(screen.queryByLabelText(/Award year/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Competition or organisation name/)).not.toBeInTheDocument();
  });

  it('labels the primary action "Add achievement" for a brand-new draft', () => {
    const draft: EvidenceDraft = {
      kind: 'achievement',
      id: 'new-1',
      category: 'academic_award',
      title: '',
    };
    render(<EditEvidenceModal open draft={draft} onClose={vi.fn()} onSave={vi.fn()} t={t} />);

    expect(screen.getByText('Add academic achievement')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add achievement' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <EditEvidenceModal open={false} draft={null} onClose={vi.fn()} onSave={vi.fn()} t={t} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
