'use client';

import { useMemo, useState } from 'react';
import { TID, testId } from '@/shared/lib/testids';
import { Modal } from '@/shared/ui';

export type ScholarshipUniversityOption = {
  id: number;
  name: string;
  country: string | null;
};

type Translate = (en: string, vars?: Record<string, string | number>) => string;

export function ScholarshipUniversityPicker({
  open,
  mode,
  options,
  loading,
  saving,
  error,
  onClose,
  onSave,
  t,
}: {
  open: boolean;
  mode: 'linked' | 'directory';
  options: ScholarshipUniversityOption[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (universityId: number) => void;
  t: Translate;
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.name} ${option.country ?? ''}`.toLocaleLowerCase().includes(needle),
    );
  }, [options, query]);

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      label={t('Choose a university for this scholarship')}
      className="max-w-[640px] p-gb-3xl sm:p-gb-5xl"
    >
      <form
        {...testId(TID.scholarshipUniversityPicker)}
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedId != null) onSave(selectedId);
        }}
      >
        <div className="flex items-start justify-between gap-gb-xl">
          <div>
            <h2 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
              {t('Choose a university for this scholarship')}
            </h2>
            <p className="mt-gb-md text-gb-sm leading-6 text-fg-secondary">
              {mode === 'linked'
                ? t('This scholarship is linked to more than one university. Choose the one you plan to apply to.')
                : t('This scholarship is not tied to a specific university in our data. Choose the university you plan to apply to, then check the official eligibility rules.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={t('Close')}
            className="shrink-0 rounded-gb-md border border-line bg-surface px-gb-lg py-gb-md text-gb-sm font-semibold text-fg-secondary hover:bg-surface-hover disabled:opacity-50"
          >
            {t('Close')}
          </button>
        </div>

        <label className="mt-gb-3xl block">
          <span className="sr-only">{t('Search universities')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search universities')}
            disabled={loading || saving}
            className="h-11 w-full rounded-gb-md border border-line-strong bg-surface px-gb-input-x text-gb-sm text-fg outline-none transition placeholder:text-fg-muted focus:border-brand focus:ring-2 focus:ring-brand-subtle disabled:bg-surface-muted"
          />
        </label>

        <fieldset
          className="mt-gb-xl max-h-[340px] space-y-gb-md overflow-y-auto pr-gb-xs"
          aria-busy={loading}
        >
          <legend className="sr-only">{t('University options')}</legend>
          {loading ? (
            <p className="rounded-gb-lg border border-line bg-surface-muted p-gb-xl text-gb-sm text-fg-secondary">
              {t('Loading universities...')}
            </p>
          ) : visibleOptions.length > 0 ? (
            visibleOptions.map((option) => {
              const checked = selectedId === option.id;
              return (
                <label
                  key={option.id}
                  {...testId(TID.scholarshipUniversityOption)}
                  className={`flex cursor-pointer items-center gap-gb-xl rounded-gb-lg border p-gb-xl transition ${
                    checked
                      ? 'border-brand bg-brand-subtle'
                      : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name="scholarship-university"
                    value={option.id}
                    checked={checked}
                    onChange={() => setSelectedId(option.id)}
                    disabled={saving}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-gb-sm font-semibold text-fg">
                      {option.name}
                    </span>
                    {option.country ? (
                      <span className="mt-gb-xs block text-gb-xs text-fg-tertiary">
                        {option.country}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })
          ) : (
            <p className="rounded-gb-lg border border-line bg-surface-muted p-gb-xl text-gb-sm text-fg-secondary">
              {query.trim()
                ? t('No universities match your search.')
                : t('No universities are available in the directory yet.')}
            </p>
          )}
        </fieldset>

        {error ? (
          <p role="alert" className="mt-gb-xl text-gb-sm font-medium text-fg-error">
            {error}
          </p>
        ) : null}

        <div className="mt-gb-3xl flex flex-col-reverse gap-gb-lg sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center rounded-gb-md border border-line-strong bg-surface px-gb-2xl text-gb-sm font-semibold text-fg-secondary hover:bg-surface-hover disabled:opacity-50"
          >
            {t('Cancel')}
          </button>
          <button
            type="submit"
            disabled={selectedId == null || loading || saving}
            {...testId(TID.scholarshipUniversitySave)}
            className="inline-flex h-11 items-center justify-center rounded-gb-md bg-brand px-gb-2xl text-gb-sm font-semibold text-on-brand shadow-gb-xs-skeuomorphic transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t('Saving...') : t('Save scholarship and university')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
