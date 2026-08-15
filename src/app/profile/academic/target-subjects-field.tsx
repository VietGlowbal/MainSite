'use client';

import { useState } from 'react';
import {
  FIELD_OF_STUDY_GROUPS,
  FIELD_OF_STUDY_SET,
  FIELD_OF_STUDY_VALUES,
} from '@/lib/fields-of-study';
import { useT } from '@/lib/i18n';
import { Badge, Button, Input, Select } from '@/shared/ui';

const OTHER_VALUE = '__other__';

function sameSubject(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

function canonicalSubject(raw: string): string {
  const value = raw.trim();
  return FIELD_OF_STUDY_VALUES.find((subject) => sameSubject(subject, value)) ?? value;
}

/**
 * A multi-value field backed by a native, grouped dropdown.
 *
 * The database continues to receive a plain string array. Known options are
 * saved in canonical English while `Others` reveals a free-text escape hatch.
 * This preserves legacy/custom values without letting the primary control
 * quietly become another unrestricted text input.
 */
export function TargetSubjectsField({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useT();
  const [choice, setChoice] = useState('');
  const [custom, setCustom] = useState('');
  const addingOther = choice === OTHER_VALUE;

  const add = (raw: string) => {
    const subject = canonicalSubject(raw);
    if (subject && !values.some((value) => sameSubject(value, subject))) {
      onChange([...values, subject]);
    }
    setChoice('');
    setCustom('');
  };

  return (
    <div className="flex flex-col gap-gb-lg">
      <div className="flex items-end gap-gb-md">
        <Select
          name="target_subjects_choice"
          label={t('Target subjects / fields of study')}
          placeholder={t('Select a subject or field…')}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          fieldClassName="min-w-0 flex-1"
        >
          <option value={OTHER_VALUE}>{t('Others')}</option>
          {FIELD_OF_STUDY_GROUPS.map((group) => (
            <optgroup key={group.label} label={t(group.label)}>
              {group.subjects.map(([subject]) => (
                <option
                  key={subject}
                  value={subject}
                  disabled={values.some((value) => sameSubject(value, subject))}
                >
                  {t(subject)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>

        {addingOther ? null : (
          <Button
            onClick={() => add(choice)}
            variant="secondary"
            size="lg"
            disabled={!choice}
            className="shrink-0"
          >
            {t('Add')}
          </Button>
        )}
      </div>

      <p className="text-gb-sm text-fg-muted">
        {t('Choose from the list. You can add more than one.')}
      </p>

      {addingOther ? (
        <div className="flex items-end gap-gb-md">
          <Input
            name="target_subject_other"
            label={t('Other subject / field of study')}
            placeholder={t('Enter another subject or field…')}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && custom.trim()) {
                event.preventDefault();
                add(custom);
              }
            }}
            fieldClassName="min-w-0 flex-1"
          />
          <Button
            onClick={() => add(custom)}
            variant="secondary"
            size="lg"
            disabled={!custom.trim()}
            className="shrink-0"
          >
            {t('Add')}
          </Button>
        </div>
      ) : null}

      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-gb-md">
          {values.map((value) => {
            const known = FIELD_OF_STUDY_SET.has(value);
            const label = known ? t(value) : value;
            return (
              <li key={value} className="max-w-full">
                <Badge variant="brand-chip" className="max-w-full gap-gb-xs">
                  <span className="truncate" data-no-auto-translate={known ? undefined : ''}>
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(values.filter((subject) => subject !== value))}
                    aria-label={t('Remove {subject}', { subject: label })}
                    data-no-auto-translate={known ? undefined : ''}
                    className="shrink-0 leading-none transition-colors hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    ×
                  </button>
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
