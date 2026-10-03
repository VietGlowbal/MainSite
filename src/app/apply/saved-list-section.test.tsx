import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/lib/i18n';
import { SavedListSection, type SavedRow, type ScholarshipOption } from './saved-list-section';

/**
 * The saved list keeps a local copy of its rows so a removal can be optimistic.
 * That copy has to follow the server, and for a long time it did not: every
 * `router.refresh()` on /apply — attaching an award here, planning an
 * application, or (since 18/08) changing scholarships in the tracker's drawer
 * above — hands this component fresh rows, but a refresh preserves client
 * state, so the list went on rendering what it was mounted with.
 */

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  from: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  upsert: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mocks.from, auth: { getUser: mocks.getUser } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ delete: mocks.delete, upsert: mocks.upsert });
  mocks.delete.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'student' } } });
});

function row(overrides: Partial<SavedRow> = {}): SavedRow {
  return {
    id: 1,
    universityId: 7,
    name: 'University College London (UCL)',
    country: 'United Kingdom',
    type: null,
    qsRank: null,
    theRank: null,
    deadline: null,
    summary: null,
    imageUrl: null,
    logoUrl: null,
    website: null,
    tuition: '—',
    tuitionRaw: null,
    program: 'Law',
    programUrl: null,
    attached: [],
    options: [],
    ...overrides,
  };
}

function scholarship(id: number, name: string): ScholarshipOption {
  return {
    id, name, amountLabel: null, deadlineLabel: null, coverage: null,
    fundingType: null, amountMin: null, amountMax: null, amountCurrency: null,
    scope: null, eligibility: null, conditions: null, insight: null,
    appliesToText: null, sourceUrl: null,
  };
}

const shared = scholarship(30, 'Government Scholarship');
const mit = row({ id: 1, universityId: 1, name: 'MIT', options: [scholarship(10, 'MIT Grant'), shared] });
const harvard = row({ id: 2, universityId: 2, name: 'Harvard', options: [scholarship(20, 'Harvard Grant'), shared] });

function renderList(rows = [mit, harvard], isPlus = true) {
  const onPlan = vi.fn();
  const result = render(<SavedListSection rows={rows} onPlan={onPlan} onGoToApplications={vi.fn()} isPlus={isPlus} />);
  return { ...result, onPlan, user: userEvent.setup() };
}

describe('SavedListSection', () => {
  it('links the university heading to the internal profile and keeps the official site', () => {
    renderList([row({ website: 'https://ucl.ac.uk' })]);
    const heading = screen.getByRole('heading', { level: 3, name: 'University College London (UCL)' });
    expect(within(heading).getByRole('link')).toHaveAttribute('href', '/universities/7');
    expect(screen.getByRole('link', { name: 'Official site' })).toHaveAttribute('href', 'https://ucl.ac.uk');
  });

  it('selects and clears all current rows and passes only the selection to planning', async () => {
    const { user, onPlan } = renderList();
    const all = screen.getByRole('checkbox', { name: 'Choose all' });
    expect(all).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Plan my application' })).toBeDisabled();
    await user.click(all);
    expect(screen.getByRole('checkbox', { name: 'Select MIT' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Harvard' })).toBeChecked();
    expect(all).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Plan my application' }));
    expect(onPlan).toHaveBeenCalledWith([mit, harvard]);
    await user.click(all);
    expect(screen.getByRole('checkbox', { name: 'Select MIT' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Harvard' })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Select MIT' }));
    await user.click(screen.getByRole('button', { name: 'Plan my application' }));
    expect(onPlan).toHaveBeenLastCalledWith([mit]);
  });

  it('exposes an indeterminate choose-all control for partial selection', async () => {
    const { user } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Select MIT' }));
    const all = screen.getByRole('checkbox', { name: 'Choose all' });
    expect(all).toBePartiallyChecked();
    expect(all).toHaveProperty('indeterminate', true);
    await user.click(all);
    expect(all).toBeChecked();
    expect(all).toHaveProperty('indeterminate', false);
  });

  it('prunes removed selections so re-added rows are not silently selected', async () => {
    const { user, rerender } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Choose all' }));
    rerender(<SavedListSection rows={[mit]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />);
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).toBeChecked();
    rerender(<SavedListSection rows={[harvard]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />);
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Scholarships here' })).toBeDisabled();
  });

  it.each(['delete', 'scholarship'] as const)('closes the %s dialog when its saved row is replaced during refresh', async (dialog) => {
    const { user, rerender } = renderList();
    await user.click(screen.getByRole('button', { name: dialog === 'delete' ? 'Delete MIT' : 'Choose a scholarship for MIT' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(<SavedListSection rows={[{ ...mit, id: 99 }, harvard]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it.each([false, true])('selects a delayed focus row without reticking it and respects reduced motion: %s', async (reduced) => {
    window.__setMediaQueryMatches('(prefers-reduced-motion: reduce)', reduced);
    const scroll = vi.fn();
    const prototype = HTMLElement.prototype as Partial<HTMLElement>;
    const originalScroll = prototype.scrollIntoView;
    prototype.scrollIntoView = scroll;
    const { rerender, user } = renderList([harvard]);
    const props = { onPlan: vi.fn(), onGoToApplications: vi.fn(), isPlus: true, focusUniversityId: 1 };
    rerender(<SavedListSection rows={[harvard]} {...props} />);
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).not.toBeChecked();
    rerender(<SavedListSection rows={[mit, harvard]} {...props} />);
    expect(screen.getByRole('checkbox', { name: 'Select MIT' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).toBePartiallyChecked();
    expect(scroll).toHaveBeenCalledWith({ behavior: reduced ? 'instant' : 'smooth', block: 'center' });
    await user.click(screen.getByRole('checkbox', { name: 'Select MIT' }));
    rerender(<SavedListSection rows={[{ ...mit }, harvard]} {...props} />);
    expect(screen.getByRole('checkbox', { name: 'Select MIT' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).not.toBeChecked();
    if (originalScroll) prototype.scrollIntoView = originalScroll;
    else delete prototype.scrollIntoView;
    window.__resetMediaQueryMatches();
  });

  it('does not resurrect a removed selection when focus and refreshed rows change together', () => {
    const { rerender } = renderList([mit]);
    const props = { onPlan: vi.fn(), onGoToApplications: vi.fn(), isPlus: true };
    rerender(<SavedListSection rows={[harvard]} focusUniversityId={1} {...props} />);
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).not.toBeChecked();
    rerender(<SavedListSection rows={[mit, harvard]} {...props} />);
    expect(screen.getByRole('checkbox', { name: 'Select MIT' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).not.toBePartiallyChecked();
  });

  it('disables scholarship actions with no selected universities', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'Scholarships here' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Apply scholarship' })).not.toBeInTheDocument();
    expect(screen.getByText('Select a university to browse scholarships or plan its application.')).toBeInTheDocument();
  });

  it('browses only MIT-linked awards when only MIT is selected', async () => {
    const { user } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Select MIT' }));
    await user.click(screen.getByRole('button', { name: 'Scholarships here' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('MIT Grant')).toBeInTheDocument();
    expect(dialog.getByText('Government Scholarship')).toBeInTheDocument();
    expect(dialog.queryByText('Harvard Grant')).not.toBeInTheDocument();
  });

  it('browses the union once per scholarship with applicable university chips', async () => {
    const { user } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Choose all' }));
    await user.click(screen.getByRole('button', { name: 'Scholarships here' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('MIT Grant')).toBeInTheDocument();
    expect(dialog.getByText('Harvard Grant')).toBeInTheDocument();
    expect(dialog.getAllByText('Government Scholarship')).toHaveLength(1);
    const applicable = dialog.getByText('Applicable universities').parentElement!;
    expect(within(applicable).getByText('MIT')).toBeInTheDocument();
    expect(within(applicable).getByText('Harvard')).toBeInTheDocument();
  });

  it('requires an explicit university for a shared award, then attaches it and refreshes', async () => {
    const { user } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Choose all' }));
    await user.click(screen.getByRole('button', { name: 'Apply scholarship' }));
    await user.click(screen.getByRole('radio', { name: 'Choose Government Scholarship' }));
    const submit = screen.getByRole('button', { name: 'Apply scholarship now' });
    expect(submit).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Attach to university' })).toHaveValue('');
    expect(mocks.upsert).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Attach to university' }), '2');
    await user.click(submit);
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: 'student', scholarship_id: 30, university_id: 2 },
      { onConflict: 'user_id,scholarship_id' },
    ));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Scholarship added' })).toBeInTheDocument();
  });

  it('uses the sole selected university directly for a shared scholarship', async () => {
    const { user } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Select MIT' }));
    await user.click(screen.getByRole('button', { name: 'Apply scholarship' }));
    await user.click(screen.getByRole('radio', { name: 'Choose Government Scholarship' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply scholarship now' }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: 'student', scholarship_id: 30, university_id: 1 },
      { onConflict: 'user_id,scholarship_id' },
    ));
  });

  it('opens the reused card picker with only that row in scope', async () => {
    const { user } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Select Harvard' }));
    await user.click(screen.getByRole('button', { name: 'Choose a scholarship for MIT' }));
    expect(screen.getByRole('radio', { name: 'Choose MIT Grant' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Choose Harvard Grant' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Choose Government Scholarship' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('never offers an award attached to MIT as a new Harvard attachment, even when MIT is unticked', async () => {
    const attachedMit = { ...mit, attached: [{ savedId: 100, id: shared.id, name: shared.name, amountLabel: null }] };
    const { user } = renderList([attachedMit, harvard]);
    await user.click(screen.getByRole('checkbox', { name: 'Select Harvard' }));
    await user.click(screen.getByRole('button', { name: 'Apply scholarship' }));
    expect(screen.queryByRole('radio', { name: 'Choose Government Scholarship' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Choose a scholarship for Harvard' }));
    expect(screen.queryByRole('radio', { name: 'Choose Government Scholarship' })).not.toBeInTheDocument();
    expect(mocks.upsert).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(shared.name)).toBeInTheDocument();
  });

  it('does not offer or discount an award already saved outside the current university list', async () => {
    const { user } = renderList([{ ...harvard, tuition: '$50,000', tuitionRaw: '50000', options: [{ ...shared, coverage: '50% tuition' }], attachedScholarshipIds: [shared.id] }]);
    expect(screen.queryByRole('button', { name: 'Choose a scholarship for Harvard' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select Harvard' }));
    expect(screen.queryByRole('button', { name: 'Apply scholarship' })).not.toBeInTheDocument();
    expect(screen.queryByText('$25,000')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Scholarships here' }));
    expect(screen.queryByText(shared.name)).not.toBeInTheDocument();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('scopes the exact MIT/Harvard/Stanford union and resets the target when selection becomes MIT alone', async () => {
    const stanford = row({ id: 3, universityId: 3, name: 'Stanford', options: [shared, scholarship(40, 'Stanford Grant')] });
    const { user, rerender, onPlan } = renderList([mit, harvard, stanford]);
    await user.click(screen.getByRole('checkbox', { name: 'Select MIT' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Harvard' }));
    await user.click(screen.getByRole('button', { name: 'Apply scholarship' }));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByText('Stanford Grant')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Choose Government Scholarship' }));
    expect(screen.getAllByRole('option').map((option) => (option as HTMLOptionElement).value)).toEqual(['', '1', '2']);
    expect(screen.getByRole('button', { name: 'Apply scholarship now' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox'), '2');
    // A server refresh removes Harvard while this picker is open.
    rerender(<SavedListSection rows={[mit, stanford]} onPlan={onPlan} onGoToApplications={vi.fn()} isPlus />);
    expect(screen.queryByText('Harvard Grant')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply scholarship now' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Choose Government Scholarship' }));
    await user.click(screen.getByRole('button', { name: 'Apply scholarship now' }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: 'student', scholarship_id: 30, university_id: 1 },
      { onConflict: 'user_id,scholarship_id' },
    ));
  });

  it('keeps keyboard focus inside each picker/detail panel and returns to the card on close', async () => {
    const { user } = renderList();
    const opener = screen.getByRole('button', { name: 'Choose a scholarship for MIT' });
    await user.click(opener);
    await user.click(screen.getAllByRole('button', { name: 'See details' })[0]!);
    expect(screen.getByRole('dialog', { name: 'MIT Grant' })).toContainElement(document.activeElement as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Apply a scholarship' })).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  it('degrades failed cover and picker/detail crests to placeholders, retrying a changed URL', async () => {
    const logoUrl = 'https://untrusted.example/failed.png';
    const { user, container, rerender } = renderList([{ ...mit, logoUrl, imageUrl: logoUrl }]);
    const cover = container.querySelector('img')!;
    fireEvent.error(cover);
    expect(cover).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MIT' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose a scholarship for MIT' }));
    const crest = screen.getByRole('dialog').querySelector('img')!;
    fireEvent.error(crest);
    expect(crest).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'See details' })[0]!);
    const detailCrest = screen.getByRole('dialog').querySelector('img')!;
    fireEvent.error(detailCrest);
    expect(detailCrest).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    const recovered = 'https://another.example/new.png';
    rerender(<SavedListSection rows={[{ ...mit, logoUrl: recovered, imageUrl: recovered }]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />);
    expect(container.querySelector('img')).toHaveAttribute('src', recovered);
  });

  it('renders arbitrary crest hosts in the picker and detail without optimizer rejection', async () => {
    const logoUrl = 'https://img.wikiwand.com/mit-crest.png';
    const { user } = renderList([{ ...mit, logoUrl }]);
    await user.click(screen.getByRole('button', { name: 'Choose a scholarship for MIT' }));
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', logoUrl);
    await user.click(screen.getAllByRole('button', { name: 'See details' })[0]!);
    expect(screen.getByRole('dialog', { name: 'MIT Grant' }).querySelector('img')).toHaveAttribute('src', logoUrl);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: 'Choose MIT Grant' })).toBeInTheDocument();
  });

  it('clears scholarship and university choices when the picker is reopened', async () => {
    const { user } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Choose all' }));
    await user.click(screen.getByRole('button', { name: 'Apply scholarship' }));
    await user.click(screen.getByRole('radio', { name: 'Choose Government Scholarship' }));
    await user.selectOptions(screen.getByRole('combobox'), '2');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Apply scholarship' }));
    expect(screen.getByRole('radio', { name: 'Choose Government Scholarship' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Apply scholarship now' })).toBeDisabled();
  });

  it('preserves Plus gating after grouping shared awards', async () => {
    const extras = [scholarship(40, 'Fourth Grant'), scholarship(50, 'Fifth Grant')];
    const { user } = renderList([{ ...mit, options: [...mit.options, ...extras] }, harvard], false);
    await user.click(screen.getByRole('checkbox', { name: 'Choose all' }));
    await user.click(screen.getByRole('button', { name: 'Apply scholarship' }));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'See details' })).toHaveLength(3);
    const gated = screen.getByRole('dialog').querySelector('[inert]');
    expect(gated).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: /See all scholarships/ })).toBeInTheDocument();
  });

  it('keeps tuition discounts on their own university before and after refreshed attachments', async () => {
    const award = { ...shared, coverage: '50% tuition' };
    const rows = [
      { ...mit, tuition: '$60,000', tuitionRaw: '60000', options: [award], attached: [{ savedId: 100, id: 30, name: award.name, amountLabel: null }] },
      { ...harvard, tuition: '$50,000', tuitionRaw: '50000', options: [award] },
    ];
    const { user, rerender } = renderList(rows);
    const mitCard = screen.getByRole('heading', { name: 'MIT' }).closest('article')!;
    const harvardCard = screen.getByRole('heading', { name: 'Harvard' }).closest('article')!;
    expect(within(mitCard).getByText('$30,000')).toBeInTheDocument();
    expect(within(mitCard).getByText('$60,000')).toHaveClass('line-through');
    expect(within(harvardCard).queryByText('$25,000')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Choose all' }));
    expect(within(harvardCard).queryByText('$25,000')).not.toBeInTheDocument();
    expect(mocks.upsert).not.toHaveBeenCalled();
    rerender(<SavedListSection rows={rows.map((row) => ({ ...row }))} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />);
    expect(within(mitCard).getByText(award.name)).toBeInTheDocument();
    expect(within(mitCard).getByText('$30,000')).toBeInTheDocument();
  });

  it('blocks repeat deletion while loading and reconciles select-all after success', async () => {
    let resolve!: (result: { error: null }) => void;
    mocks.eq.mockReturnValueOnce(new Promise<{ error: null }>((done) => { resolve = done; }));
    const { user } = renderList();
    await user.click(screen.getByRole('checkbox', { name: 'Choose all' }));
    await user.click(screen.getByRole('button', { name: 'Delete MIT' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(screen.getByRole('button', { name: 'Delete MIT' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete MIT' }));
    expect(mocks.delete).toHaveBeenCalledOnce();
    await act(async () => resolve({ error: null }));
    expect(screen.queryByRole('heading', { name: 'MIT' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Choose all' })).toHaveProperty('indeterminate', false);
  });

  it('does not delete until Yes is confirmed, and No cancels with focus returned', async () => {
    const { user } = renderList();
    const trash = screen.getByRole('button', { name: 'Delete MIT' });
    await user.click(trash);
    expect(mocks.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trash).toHaveFocus();
    expect(mocks.delete).not.toHaveBeenCalled();
    await user.click(trash);
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith('id', mit.id));
    expect(mocks.from).toHaveBeenCalledWith('user_universities');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'MIT' })).not.toBeInTheDocument());
  });

  it('cancels deletion with Escape and reports mutation errors without losing the row', async () => {
    const { user } = renderList();
    await user.click(screen.getByRole('button', { name: 'Delete MIT' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.delete).not.toHaveBeenCalled();
    mocks.eq.mockResolvedValueOnce({ error: { message: 'Failed' } });
    await user.click(screen.getByRole('button', { name: 'Delete MIT' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not remove that university. Please try again.');
    expect(screen.getByRole('heading', { name: 'MIT' })).toBeInTheDocument();
  });

  it('localizes new actions and dynamic accessible labels in Vietnamese', async () => {
    const user = userEvent.setup();
    render(<LanguageProvider defaultLang="vi"><SavedListSection rows={[mit]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus /></LanguageProvider>);
    expect(screen.getByRole('checkbox', { name: 'Chọn tất cả' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Chọn MIT' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xóa MIT' }));
    expect(screen.getByRole('dialog', { name: 'Bạn có chắc muốn xóa trường này không?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Không' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Có' })).toBeInTheDocument();
  });

  it('re-reads its rows when the server sends new ones', () => {
    const attached = [{ savedId: 5, id: 42, name: 'Chevening Scholarship', amountLabel: '£30,000' }];

    const { rerender } = render(
      <SavedListSection rows={[row()]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />,
    );
    expect(screen.queryByText('Chevening Scholarship')).not.toBeInTheDocument();

    // What a `router.refresh()` after attaching an award produces: same page,
    // same mounted component, a new array from the server.
    rerender(
      <SavedListSection
        rows={[row({ attached })]}
        onPlan={vi.fn()}
        onGoToApplications={vi.fn()}
        isPlus
      />,
    );

    expect(screen.getByText('Chevening Scholarship')).toBeInTheDocument();
  });

  it.each(['https://example.edu/courses/law', 'http://example.edu/courses/law'])('renders a valid programme URL as a safe link: %s', (programUrl) => {
    render(
      <SavedListSection rows={[row({ programUrl })]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />,
    );

    expect(screen.getByRole('link', { name: 'Course page' })).toHaveAttribute('href', programUrl);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.edu/id',
    'course/law',
    'https://example.edu/course page',
  ])('does not render an unsafe persisted programme URL as an anchor: %s', (programUrl) => {
    render(
      <SavedListSection rows={[row({ programUrl })]} onPlan={vi.fn()} onGoToApplications={vi.fn()} isPlus />,
    );

    expect(screen.queryByRole('link', { name: 'Course page' })).not.toBeInTheDocument();
    expect(screen.getByText('No link available')).toBeInTheDocument();
  });
});
