import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { HomeContact, type ContactState } from './home-contact';
import { HomeConsultationProvider, useHomeConsultation } from './home-consultation';

beforeAll(() => {
  // jsdom implements no scrolling; the Pricing CTA scrolls to the form.
  Element.prototype.scrollIntoView = vi.fn();
});

function action(result: ContactState = { status: 'ok', email: 'khoa@example.com', emailed: true }) {
  return vi.fn<(state: ContactState, formData: FormData) => Promise<ContactState>>(async () => result);
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Full name/), 'Trần Minh Khoa');
  await user.type(screen.getByLabelText(/Date of birth/), '14032008');
  await user.type(screen.getByLabelText(/Email address/), 'khoa@example.com');
  await user.type(screen.getByLabelText(/Phone number/), '912 345 678');
  // Named: the dial-code and budget <select>s are comboboxes too.
  await user.type(screen.getByRole('combobox', { name: /Where would you like to study/ }), 'United Kingdom');
  await user.click(screen.getByRole('checkbox'));
}

describe('HomeContact', () => {
  it('shows inline errors and never calls the server when required fields are empty', async () => {
    const user = userEvent.setup();
    const submit = action();
    render(<HomeContact action={submit} />);

    await user.click(screen.getByRole('button', { name: 'Request Consultation' }));

    expect(submit).not.toHaveBeenCalled();
    expect(screen.getAllByText('This field is required.')).toHaveLength(5);
    expect(screen.getByText('Please agree to the privacy policy to continue.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute('aria-invalid', 'true');
    // Focus lands on the first invalid field, so a keyboard user is not lost.
    expect(screen.getByLabelText(/Full name/)).toHaveFocus();
  });

  it('clears a field’s error as soon as it is edited', async () => {
    const user = userEvent.setup();
    render(<HomeContact action={action()} />);

    await user.click(screen.getByRole('button', { name: 'Request Consultation' }));
    await user.type(screen.getByLabelText(/Full name/), 'K');

    expect(screen.getByLabelText(/Full name/)).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getAllByText('This field is required.')).toHaveLength(4);
  });

  it('formats the date of birth as it is typed', async () => {
    const user = userEvent.setup();
    render(<HomeContact action={action()} />);

    await user.type(screen.getByLabelText(/Date of birth/), '14032008');

    expect(screen.getByLabelText(/Date of birth/)).toHaveValue('14/03/2008');
  });

  it('submits every field and confirms with the email it was sent to', async () => {
    const user = userEvent.setup();
    const submit = action();
    render(<HomeContact action={submit} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Request Consultation' }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const data = submit.mock.calls[0]![1];
    expect(Object.fromEntries(data.entries())).toMatchObject({
      name: 'Trần Minh Khoa',
      dob: '14/03/2008',
      email: 'khoa@example.com',
      dialCode: 'VN',
      phone: '912 345 678',
      destination: 'United Kingdom',
      budget: '',
      consent: 'on',
    });

    expect(await screen.findByRole('heading', { name: "You're registered!" })).toBeInTheDocument();
    expect(screen.getByText(/We've emailed khoa@example.com\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up free' })).toHaveAttribute('href', '/auth?mode=signup');
  });

  it('does not claim an email went out when none did', async () => {
    const user = userEvent.setup();
    render(<HomeContact action={action({ status: 'ok', email: 'khoa@example.com', emailed: false })} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Request Consultation' }));

    expect(await screen.findByText(/We've received your details for khoa@example.com\./)).toBeInTheDocument();
    expect(screen.queryByText(/We've emailed/)).toBeNull();
  });

  it('shows the rate-limit banner the server returns', async () => {
    const user = userEvent.setup();
    render(<HomeContact action={action({ status: 'rate-limited' })} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Request Consultation' }));

    expect(await screen.findByText('Too many requests, try again in a minute.')).toBeInTheDocument();
  });

  it('pre-fills and locks the account name and email for a signed-in student', () => {
    render(<HomeContact action={action()} account={{ fullName: 'Trần Minh Khoa', email: 'khoa@example.com' }} />);

    expect(screen.getByLabelText(/Full name/)).toHaveValue('Trần Minh Khoa');
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/Email address/)).toHaveValue('khoa@example.com');
    expect(screen.getByLabelText(/Email address/)).toHaveAttribute('readonly');
    expect(screen.getAllByText('From your account')).toHaveLength(2);
  });

  it('pre-selects the package a Pricing CTA picked', async () => {
    const user = userEvent.setup();
    function PickYearly() {
      const { choosePackage } = useHomeConsultation();
      return (
        <button type="button" onClick={() => choosePackage('yearly')}>
          Get Yearly Plan
        </button>
      );
    }

    const { container } = render(
      <HomeConsultationProvider>
        <PickYearly />
        <HomeContact action={action()} />
      </HomeConsultationProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Get Yearly Plan' }));

    expect(container.querySelector('input[value="yearly"]')).toBeChecked();
    expect(screen.getByText('You picked GlowBal Yearly — change anytime')).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
