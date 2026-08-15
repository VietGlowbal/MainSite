'use client';

import { useMemo } from 'react';
import { flagEmoji } from '@/lib/nationality-catalog';
import { RangeHistogram, Select } from '@/shared/ui';
import {
  ALL_CURRENCIES,
  PRIMARY_CURRENCIES,
  convertBudget,
  currencyMeta,
  defaultBudget,
  formatAmount,
  formatBudgetRange,
  reBase,
  type CurrencyCode,
  type TuitionBudget,
} from '../domain';

/**
 * Q12 — annual tuition budget, in the student's own currency.
 *
 * ─── THE CURRENCY IS THE FIRST QUESTION, NOT A UNIT LABEL ────────────────────
 *
 * The previous version asked for a VND range and a USD band. A student who
 * budgets in pounds had to convert their own number into đồng to answer, and
 * whatever they picked came back to them in a currency they do not think in.
 * Picking the currency first means the numbers on the track are numbers they
 * recognise, and the answer they set is the answer they see.
 *
 * ─── CHANGING CURRENCY RE-EXPRESSES, IT DOES NOT RESET ───────────────────────
 *
 * `reBase` carries the amount across (£15,000–£40,000 becomes roughly
 * $19,000–$50,600, snapped to the dollar scale). Someone switching currency
 * has not changed their mind about the money, and resetting the handles would
 * make them set it twice.
 *
 * ─── THE CONVERSIONS ARE LABELLED APPROXIMATE, AND NEVER STORED ──────────────
 *
 * Only `{ currency, min, max }` is saved. The other-currency line under the
 * slider exists so a student can sanity-check an unfamiliar figure, and the
 * rate behind it is a reviewed constant rather than a feed — see
 * `tuition-budget.ts` for why.
 */

/**
 * The bars behind the slider.
 *
 * FLAT, AND THAT IS THE POINT — the same call `RangeHistogram`'s own source
 * makes: real distribution data or none, because a curve here is a claim about
 * what other students budget, and we have no cohort data to support one.
 */
const FLAT_BINS = Array.from({ length: 48 }, () => 1);

/** Which currencies the conversion line shows, given the one being edited. */
function comparisonCurrencies(active: CurrencyCode): CurrencyCode[] {
  const preferred: CurrencyCode[] = ['USD', 'GBP', 'EUR', 'VND'];
  return preferred.filter((code) => code !== active).slice(0, 3);
}

export function BudgetQuestion({
  value,
  onChange,
  t,
}: {
  value: TuitionBudget | undefined;
  onChange: (next: TuitionBudget) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  /*
   * An unanswered budget still needs handles somewhere. `defaultBudget` puts
   * them inside the scale rather than pinned to the ends — but it is NOT
   * written to `value`, so an untouched question stays unanswered rather than
   * silently acquiring a budget the student never chose.
   */
  const budget = value ?? defaultBudget('USD');
  const meta = useMemo(() => currencyMeta(budget.currency), [budget.currency]);

  // `max: null` is the open-ended top band, which on the track is the upper
  // handle at the end. The two representations have to agree in both
  // directions or the handle jumps back a step the moment it is released.
  const high = budget.max ?? meta.max;
  const openEnded = budget.max === null;

  const others = comparisonCurrencies(budget.currency);

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="flex flex-col gap-gb-md">
        <p className="text-gb-sm font-semibold text-fg-secondary">
          {t('Which currency do you think in?')}
        </p>

        <div
          role="radiogroup"
          aria-label={t('Which currency do you think in?')}
          className="flex flex-wrap items-center gap-gb-md"
        >
          {PRIMARY_CURRENCIES.map((code) => {
            const option = currencyMeta(code);
            const selected = code === budget.currency;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(reBase(budget, code))}
                className={`inline-flex items-center gap-gb-sm rounded-gb-full border px-gb-lg py-gb-sm text-gb-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  selected
                    ? 'border-brand bg-brand-subtle text-fg'
                    : 'border-line bg-surface text-fg-tertiary hover:border-line-strong'
                }`}
              >
                <span aria-hidden="true">{flagEmoji(option.region)}</span>
                {option.symbol.trim()} {code}
              </button>
            );
          })}

          {/*
            The remaining currencies as a select rather than nine more pills.
            It shows the current currency when that currency is not one of the
            four — otherwise a student who picked đồng would see the control
            reading "Other" with no sign of what they chose.
          */}
          <div className="min-w-48">
            <Select
              name="budgetCurrencyOther"
              aria-label={t('Other currency')}
              placeholder={t('Other currency')}
              value={PRIMARY_CURRENCIES.includes(budget.currency) ? '' : budget.currency}
              onChange={(e) => {
                const code = e.target.value as CurrencyCode | '';
                if (code) onChange(reBase(budget, code));
              }}
            >
              {ALL_CURRENCIES.filter((code) => !PRIMARY_CURRENCIES.includes(code)).map((code) => {
                const option = currencyMeta(code);
                return (
                  <option key={code} value={code}>
                    {`${option.name} (${code})`}
                  </option>
                );
              })}
            </Select>
          </div>
        </div>
      </div>

      <RangeHistogram
        min={meta.min}
        max={meta.max}
        step={meta.step}
        low={Math.min(budget.min, meta.max)}
        high={Math.min(high, meta.max)}
        onChange={({ low, high: nextHigh }) =>
          onChange({
            currency: budget.currency,
            min: low,
            // At the end of the track the answer is "and above" rather than
            // "exactly the top of the scale" — a student whose budget is
            // larger than the widest programme has no other way to say so.
            max: nextHigh >= meta.max ? null : nextHigh,
          })
        }
        distribution={FLAT_BINS}
        label={t('Annual tuition budget')}
        formatValue={(low, formattedHigh) =>
          formatBudgetRange({
            currency: budget.currency,
            min: low,
            max: formattedHigh >= meta.max ? null : formattedHigh,
          })
        }
      />

      <div className="flex flex-col gap-gb-sm rounded-gb-lg border border-line bg-surface-muted p-gb-lg">
        <p className="text-gb-sm font-semibold text-fg">
          {openEnded
            ? t('{amount} and above per year', {
                amount: formatAmount(budget.min, budget.currency),
              })
            : t('{range} per year', {
                range: formatBudgetRange(budget),
              })}
        </p>

        <p className="text-gb-sm text-fg-tertiary">
          {t('Roughly {conversions}', {
            conversions: others
              .map((code) => formatBudgetRange(convertBudget(budget, code)))
              .join(' · '),
          })}
        </p>

        <p className="text-gb-xs text-fg-muted">
          {t(
            'Conversions are approximate and are not saved — we store the range in your own currency.',
          )}
        </p>
      </div>

      <p className="text-gb-sm text-fg-tertiary">
        {t(
          'This is tuition only. Living costs, flights and visa fees are not included — we show those separately on each course.',
        )}
      </p>
    </div>
  );
}
