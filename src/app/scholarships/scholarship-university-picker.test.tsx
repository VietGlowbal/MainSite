import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TID } from '@/shared/lib/testids';
import { ScholarshipUniversityPicker } from './scholarship-university-picker';

const options = [
  { id: 1, name: 'Alpha University', country: 'Canada' },
  { id: 2, name: 'Beta University', country: 'United Kingdom' },
];

const t = (value: string) => value;

describe('ScholarshipUniversityPicker', () => {
  it('requires one of the linked universities before saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ScholarshipUniversityPicker
        open
        mode="linked"
        options={options}
        loading={false}
        saving={false}
        error={null}
        onClose={vi.fn()}
        onSave={onSave}
        t={t}
      />,
    );

    expect(screen.getByText(/linked to more than one university/i)).toBeInTheDocument();
    const submit = screen.getByTestId(TID.scholarshipUniversitySave);
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /Beta University/i }));
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(onSave).toHaveBeenCalledWith(2);
  });

  it('explains that an unlinked award needs official eligibility verification', () => {
    render(
      <ScholarshipUniversityPicker
        open
        mode="directory"
        options={options}
        loading={false}
        saving={false}
        error={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        t={t}
      />,
    );

    expect(screen.getByText(/not tied to a specific university/i)).toBeInTheDocument();
    expect(screen.getAllByTestId(TID.scholarshipUniversityOption)).toHaveLength(2);
  });
});
