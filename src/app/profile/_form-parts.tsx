'use client';

import { useMemo, useState } from 'react';
import { intakeDisplayLabel } from '@/features/apply/domain';
import { currentMonthValue, parseMonthValue, toMonthValue } from '@/shared/lib';
import { Badge, Button, FormField, MonthPicker, Select, controlClasses } from '@/shared/ui';

/**
 * The two shapes every /profile editor repeats.
 *
 * Both were previously copy-pasted per form — the save row five times, the tag
 * field five times (academic subjects, goals careers, and three fields on
 * preferences), each with its own pink and its own chip colour. Pulled up here
 * rather than into shared/ui because nothing outside /profile uses them; if the
 * admin console or onboarding ever needs one, that is the moment to promote it.
 */

export type SaveMessage = { text: string; ok: boolean } | null;

/**
 * The options for a <Select>, plus the stored value when it is not one of them.
 *
 * ⚠️ THIS IS NOT DEFENSIVE PADDING — it fixes a way the page lies. Several of
 * these lists were rewritten after onboarding shipped, so real rows hold
 * strings the current list does not contain: the E2E account's `budget_range`
 * is "Up to $25k", which is not in BUDGET_OPTIONS. A native <select> whose
 * value matches no option falls back to displaying the FIRST one, so that
 * student's budget page rendered "Under $10,000 / year" — a number they never
 * chose, sitting in a field that would overwrite the real one on the next save.
 *
 * Appending the stored value makes the control show what is actually in the
 * database. Picking from the list still replaces it, which is the only way a
 * legacy value ever gets cleaned up.
 */
export function SelectOptions({ options, value }: { options: string[]; value: string }) {
  const stored = value && !options.includes(value) ? value : null;
  return (
    <>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      {stored ? <option value={stored}>{stored}</option> : null}
    </>
  );
}

/**
 * Save control plus the result of the last attempt.
 *
 * `role="status"` on the message, not on the wrapper: a live region that also
 * contains the button announces the button label every time the region
 * re-renders. Screen-reader users get "Saved successfully." and nothing else.
 */
export function SaveBar({
  onSave,
  saving,
  message,
  label = 'Save changes',
}: {
  onSave: () => void;
  saving: boolean;
  message: SaveMessage;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-gb-xl">
      <Button onClick={onSave} disabled={saving} size="lg">
        {saving ? 'Saving…' : label}
      </Button>
      <p
        role="status"
        className={`text-gb-sm ${message?.ok === false ? 'text-fg-error' : 'text-on-tier-safe'}`}
      >
        {message?.text ?? ''}
      </p>
    </div>
  );
}

/**
 * "When do you plan to start?" — the pair of fields /profile/goals and
 * /profile/preferences both ask.
 *
 * ─── WHY IT IS NOT TWO TEXT BOXES ANY MORE ──────────────────────────────────
 *
 * Both were free text ("e.g. Sep 2027", "e.g. 2027"). Typing a date is slower
 * than picking one, it reads as unfinished next to the selects around it, and
 * — the part that actually costs something — it let two students describe the
 * same intake four different ways, in a column the matching engine wants to
 * compare against. The month picker writes one canonical `YYYY-MM` token and
 * the cycle year is a list, so neither field can hold a typo again.
 *
 * ─── AN ANSWER THE PICKER CANNOT DRAW IS NOT DISCARDED ──────────────────────
 *
 * `target_intake` is shared with the reflection flow, which writes season
 * tokens and can write "undecided" — none of which is a month. Rather than
 * showing an empty field over a non-empty column (where the next save would
 * quietly erase a real answer), `intake` stays exactly as stored until the
 * student picks a month, and what is stored is named underneath the control.
 *
 * Renders the two fields bare rather than in a wrapper, because /preferences
 * places them in a six-field grid alongside budget and study mode while /goals
 * gives them a row of their own. The caller owns the layout.
 */
export function IntakeFields({
  intake,
  onIntakeChange,
  cycleYear,
  onCycleYearChange,
}: {
  /** The stored `target_intake` — a month token, or an older answer. */
  intake: string;
  onIntakeChange: (next: string) => void;
  cycleYear: string;
  onCycleYearChange: (next: string) => void;
}) {
  const monthValue = toMonthValue(intake);
  const unrepresented = intake !== '' && monthValue === '';

  // UTC, matching `currentMonthValue` — see the note there on hydration.
  const firstYear = parseMonthValue(currentMonthValue())?.year ?? new Date().getUTCFullYear();
  const yearOptions = Array.from({ length: 9 }, (_, offset) => String(firstYear + offset));

  return (
    <>
      <MonthPicker
        name="target_intake"
        label="Target intake"
        value={monthValue}
        onChange={onIntakeChange}
        dialogLabel="Choose your target intake"
        {...(unrepresented
          ? {
              // The saved answer stands in for the placeholder rather than
              // being spliced into the hint: it is the student's own words (or
              // a label built from them), so it must not go through a
              // dictionary, and the sentence beside it must.
              placeholder: intakeDisplayLabel(intake) ?? undefined,
              hint: 'Your saved answer is not a month. Pick one to replace it.',
            }
          : { hint: 'The month you want to start studying.' })}
      />
      <Select
        name="application_cycle_year"
        label="Application cycle year"
        placeholder="Select a year…"
        hint="The admissions round you plan to apply in."
        value={cycleYear}
        onChange={(e) => onCycleYearChange(e.target.value)}
      >
        <SelectOptions options={yearOptions} value={cycleYear} />
      </Select>
    </>
  );
}

/**
 * A searchable multi-select that commits values into a list of chips.
 *
 * Suggestions are filtered locally as the student types. Enter chooses the
 * active suggestion (or commits a custom value), while the Add button always
 * preserves the established custom-entry behavior.
 */
export function TagInput({
  name,
  label,
  values,
  onChange,
  placeholder,
  hint,
  suggestions,
  exclusiveValue,
}: {
  /** Doubles as the input id, the same rule the shared form primitives use. */
  name: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  hint?: string | undefined;
  suggestions?: string[] | undefined;
  /** Selecting this sentinel replaces every other value, and vice versa. */
  exclusiveValue?: string | undefined;
}) {
  const [draft, setDraft] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);

  const availableSuggestions = useMemo(() => {
    const query = draft.trim().toLocaleLowerCase();
    const selected = new Set(values.map((value) => value.trim().toLocaleLowerCase()));

    return (suggestions ?? [])
      .filter((suggestion) => !selected.has(suggestion.trim().toLocaleLowerCase()))
      .filter((suggestion) => !query || suggestion.toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        if (!query) return left.localeCompare(right);

        const leftStartsWithQuery = left.toLocaleLowerCase().startsWith(query);
        const rightStartsWithQuery = right.toLocaleLowerCase().startsWith(query);
        if (leftStartsWithQuery !== rightStartsWithQuery) return leftStartsWithQuery ? -1 : 1;

        return left.localeCompare(right);
      });
  }, [draft, suggestions, values]);

  const listboxId = `${name}-suggestions`;

  const add = (raw: string) => {
    const value = raw.trim();
    if (!value) return;

    const canonicalValue = (suggestions ?? []).find(
      (suggestion) => suggestion.trim().toLocaleLowerCase() === value.toLocaleLowerCase(),
    ) ?? value;
    const normalizedValue = canonicalValue.toLocaleLowerCase();
    const normalizedExclusiveValue = exclusiveValue?.trim().toLocaleLowerCase();
    if (normalizedExclusiveValue && normalizedValue === normalizedExclusiveValue) {
      onChange([exclusiveValue!]);
    } else if (!values.some((existing) => existing.trim().toLocaleLowerCase() === normalizedValue)) {
      const withoutExclusiveValue = normalizedExclusiveValue
        ? values.filter((existing) => existing.trim().toLocaleLowerCase() !== normalizedExclusiveValue)
        : values;
      onChange([...withoutExclusiveValue, canonicalValue]);
    }
    setDraft('');
    setIsOpen(false);
    setActiveOptionIndex(-1);
  };

  const selectActiveOption = () => {
    const activeOption = availableSuggestions[activeOptionIndex];
    if (activeOption) add(activeOption);
    else add(draft);
  };

  return (
    <FormField id={name} label={label} hint={hint}>
      {/* One child, not three: FormField stacks its children on a 6px gap, and
          the chip rows need more air than the gap between a label and its
          control. The inner column owns its own rhythm. */}
      <div className="flex flex-col gap-gb-lg">
        <div className="flex gap-gb-md">
          <div className="relative flex-1">
            <input
              id={name}
              name={name}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={isOpen && availableSuggestions.length > 0}
              aria-activedescendant={activeOptionIndex >= 0 ? `${name}-option-${activeOptionIndex}` : undefined}
              value={draft}
              placeholder={placeholder}
              onFocus={() => setIsOpen(true)}
              onBlur={() => {
                setIsOpen(false);
                setActiveOptionIndex(-1);
              }}
              onChange={(e) => {
                setDraft(e.target.value);
                setIsOpen(true);
                setActiveOptionIndex(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && availableSuggestions.length > 0) {
                  e.preventDefault();
                  setIsOpen(true);
                  setActiveOptionIndex((current) => (current + 1) % availableSuggestions.length);
                } else if (e.key === 'ArrowUp' && availableSuggestions.length > 0) {
                  e.preventDefault();
                  setIsOpen(true);
                  setActiveOptionIndex((current) => (
                    current <= 0 ? availableSuggestions.length - 1 : current - 1
                  ));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  selectActiveOption();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                  setActiveOptionIndex(-1);
                }
              }}
              className={controlClasses(false)}
            />

            {isOpen && availableSuggestions.length > 0 ? (
              <ul
                id={listboxId}
                role="listbox"
                aria-label={`${label} suggestions`}
                className="absolute z-10 mt-gb-xs max-h-64 w-full overflow-y-auto rounded-gb-md border border-line bg-surface py-gb-xs shadow-gb-lg"
              >
                {availableSuggestions.map((suggestion, index) => {
                  const active = activeOptionIndex === index;
                  return (
                    <li key={suggestion} role="presentation">
                      <button
                        id={`${name}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => add(suggestion)}
                        className={`flex w-full px-gb-lg py-gb-md text-left text-gb-sm transition-colors ${
                          active ? 'bg-surface-hover text-fg-brand' : 'text-fg-secondary hover:bg-surface-hover'
                        }`}
                      >
                        {suggestion}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <Button onClick={() => add(draft)} variant="secondary" size="lg" className="shrink-0">
            Add
          </Button>
        </div>

        {values.length > 0 ? (
          <ul className="flex flex-wrap gap-gb-md">
            {values.map((value) => (
              <li key={value} className="max-w-full">
                {/* Badge bakes in whitespace-nowrap, so the chip cannot wrap a
                    long real value — a university name, or "Flexible /
                    Scholarship dependent". The truncate lives on a span inside
                    it, which is what the primitive's own note asks for. */}
                <Badge variant="brand-chip" className="max-w-full gap-gb-xs">
                  <span className="truncate">{value}</span>
                  <button
                    type="button"
                    onClick={() => onChange(values.filter((v) => v !== value))}
                    aria-label={`Remove ${value}`}
                    className="shrink-0 leading-none transition-colors hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    ×
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </FormField>
  );
}
