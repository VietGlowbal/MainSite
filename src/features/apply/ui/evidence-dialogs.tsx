'use client';

import { ICONS, KitIcon } from '@/shared/ui';
import { Button, Modal } from '@/shared/ui';

/** "+ Add achievement" → which kind, before the edit modal opens. */
export function AddTypeChooser({
  open,
  onClose,
  onChooseAcademic,
  onChooseExtracurricular,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onChooseAcademic: () => void;
  onChooseExtracurricular: () => void;
  t: (key: string) => string;
}) {
  return (
    <Modal open={open} onClose={onClose} label={t('What would you like to add?')}>
      <div className="flex flex-col gap-gb-xl">
        <h2 className="text-gb-lg font-semibold text-fg">{t('What would you like to add?')}</h2>
        <div className="flex flex-col gap-gb-md">
          {[
            {
              icon: ICONS.graduationCap,
              label: t('Academic achievement'),
              onClick: onChooseAcademic,
            },
            {
              icon: ICONS.usersTwo,
              label: t('Extracurricular activity'),
              onClick: onChooseExtracurricular,
            },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={option.onClick}
              className="flex items-center gap-gb-lg rounded-gb-xl border border-line p-gb-xl text-left transition-colors hover:border-brand hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-gb-lg bg-brand-subtle text-fg-brand"
              >
                <KitIcon art={option.icon} frame={20} />
              </span>
              <span className="text-gb-sm font-semibold text-fg">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** "Remove this achievement?" — the one confirmation every delete goes through. */
export function RemoveConfirmDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  t,
}: {
  open: boolean;
  title: string;
  /** e.g. "Remove this achievement?" */
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}) {
  return (
    <Modal open={open} onClose={onCancel} label={title}>
      <div className="flex flex-col gap-gb-xl">
        <div className="flex flex-col gap-gb-xs">
          <h2 className="text-gb-lg font-semibold text-fg">{title}</h2>
          <p className="text-gb-sm text-fg-tertiary">{description}</p>
        </div>
        <div className="flex justify-end gap-gb-md">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button type="button" variant="secondary-destructive" onClick={onConfirm}>
            {t('Remove')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
