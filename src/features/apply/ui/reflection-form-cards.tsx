'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useT } from '@/lib/i18n';

// ── MultiSelect Combobox ──────────────────────────────────────────────────

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

export function MultiSelectCombobox({
  label,
  value,
  options,
  placeholder,
  onChange,
  warningNote,
  required,
}: {
  label: string;
  value: string;
  options: ComboboxOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  warningNote?: string;
  required?: boolean;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase())),
  );

  const selectedOption = options.find((opt) => opt.value === value || opt.label === value);
  const displayLabel = selectedOption ? selectedOption.label : value;

  return (
    <div className="flex flex-col gap-1.5 w-full relative" ref={containerRef}>
      <label className="text-sm font-medium text-neutral-800 flex items-center justify-between">
        <span>
          {t(label)} {required && <span className="text-gb-brand-600">*</span>}
        </span>
      </label>

      {/* Trigger Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between bg-white border rounded-xl px-4 py-3 cursor-pointer text-sm transition-all duration-150 ${
          isOpen ? 'border-gb-brand-600 ring-1 ring-gb-brand-600' : 'border-neutral-200 hover:border-neutral-300'
        }`}
      >
        <span className={`truncate mr-2 ${displayLabel ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>
          {displayLabel || t(placeholder || 'Search or select...')}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {displayLabel ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="text-neutral-400 hover:text-neutral-600 p-0.5 rounded-full hover:bg-neutral-100 transition-colors"
              title={t('Clear')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-gb-brand-600' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 p-2 max-h-80 flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Search bar inside dropdown */}
          <div className="px-2 pb-2 pt-1 border-b border-neutral-100">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search or select...')}
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-gb-brand-600 focus:bg-white"
                autoFocus
              />
              <svg
                className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* List of Options */}
          <div className="overflow-y-auto flex-1 py-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-neutral-400">
                {t('No matching options')}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value || opt.label === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.label);
                      setIsOpen(false);
                    }}
                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-xs transition-colors ${
                      isSelected ? 'bg-rose-50 text-gb-brand-600 font-medium' : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-gb-brand-600 border-gb-brand-600 text-white' : 'border-neutral-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="leading-tight">{t(opt.label)}</span>
                      {opt.sublabel && <span className="text-[11px] text-neutral-400 mt-0.5">{t(opt.sublabel)}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {warningNote && (
            <div className="p-2 border-t border-neutral-100 bg-rose-50/50 rounded-lg mt-1">
              <p className="text-[11px] text-rose-600 leading-relaxed">{t(warningNote)}</p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 px-2 border-t border-neutral-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="text-neutral-500 hover:text-neutral-800 font-medium py-1 px-2 rounded hover:bg-neutral-100 transition-colors"
            >
              {t('Clear')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (options[0]) {
                  onChange(options[0].label);
                }
                setIsOpen(false);
              }}
              className="text-gb-brand-600 hover:text-gb-brand-700 font-semibold py-1 px-2 rounded hover:bg-rose-50 transition-colors"
            >
              {t('Select all')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Clearable Input ───────────────────────────────────────────────────────

export function ClearableInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  icon,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  icon?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium text-neutral-800 flex items-center gap-1">
        <span>{t(label)}</span>
        {required && <span className="text-gb-brand-600">*</span>}
      </label>
      <div className="relative flex items-center">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ? t(placeholder) : undefined}
          required={required}
          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-gb-brand-600 focus:ring-1 focus:ring-gb-brand-600 transition-all"
        />
        <div className="absolute right-3 flex items-center gap-1.5">
          {value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-neutral-400 hover:text-neutral-600 p-1 rounded-full hover:bg-neutral-100 transition-colors"
              title={t('Clear')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Clearable Select ──────────────────────────────────────────────────────

export function ClearableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
  required?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium text-neutral-800 flex items-center gap-1">
        <span>{t(label)}</span>
        {required && <span className="text-gb-brand-600">*</span>}
      </label>
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 appearance-none focus:outline-none focus:border-gb-brand-600 focus:ring-1 focus:ring-gb-brand-600 transition-all pr-10 cursor-pointer"
        >
          {placeholder && <option value="">{t(placeholder)}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 pointer-events-none text-neutral-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
// ── Hero CV Upload Dropzone ───────────────────────────────────────────────

export interface UploadedFileItem {
  id: string;
  name: string;
  size: string;
  status: 'completed' | 'uploading' | 'error';
  progress?: number;
}

export function CVHeroUpload({
  uploadedFiles,
  onUpload,
  onRemove,
  isAnalyzing,
}: {
  uploadedFiles: UploadedFileItem[];
  onUpload: (files: File[]) => void;
  onRemove: (id: string) => void;
  isAnalyzing?: boolean;
}) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="flex flex-col gap-3 w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUpload(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
      />

      {/* Drag & Drop Hero Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onUpload(Array.from(e.dataTransfer.files));
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-white shadow-sm ${
          isDragging
            ? 'border-gb-brand-600 bg-rose-50/50 scale-[1.005]'
            : 'border-neutral-200 hover:border-gb-brand-600 hover:bg-neutral-50/50'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-neutral-200 flex items-center justify-center mb-3">
          <svg className="w-7 h-7 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <p className="text-base font-bold text-neutral-900 mb-1">
          {t('Tải lên CV của bạn')}{' '}
          <span className="font-normal text-neutral-600">{t('hoặc kéo thả vào đây (PDF, DOCX, tối đa 10MB)')}</span>
        </p>
        {isAnalyzing && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gb-brand-600 font-medium animate-pulse">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{t('Đang phân tích và tự động trích xuất thành tích...')}</span>
          </div>
        )}
      </div>

      {/* Uploaded File Cards */}
      {uploadedFiles.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3.5 flex-1 min-w-0 mr-4">
            {/* File Icon Badge */}
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              PDF
            </div>
            {/* Details */}
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-sm font-semibold text-neutral-900 truncate">{file.name}</span>
                  <span className="text-xs text-neutral-400 shrink-0">{file.size}</span>
                </div>
                <span className="text-xs font-semibold text-green-600 flex items-center gap-1 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  {t('Hoàn tất')}
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gb-brand-600 rounded-full transition-all duration-500"
                  style={{ width: `${file.progress ?? 100}%` }}
                />
              </div>
            </div>
          </div>
          {/* Delete action */}
          <button
            type="button"
            onClick={() => onRemove(file.id)}
            className="text-neutral-400 hover:text-red-500 p-2 rounded-xl hover:bg-neutral-50 transition-colors shrink-0"
            title={t('Xóa tệp')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ))}

      {/* Helper text */}
      <p className="text-center text-xs sm:text-sm text-neutral-500 my-1">
        {t('Nếu chưa có CV có thể tự nhập thông tin ở dưới')}
      </p>
    </div>
  );
}

// ── Action Buttons ────────────────────────────────────────────────────────

export function AddCircularButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center my-6">
      <button
        type="button"
        onClick={onClick}
        className="w-10 h-10 rounded-full border-2 border-gb-brand-600 text-gb-brand-600 flex items-center justify-center hover:bg-rose-50 hover:scale-105 active:scale-95 transition-all shadow-sm group"
        title={label ? t(label) : t('Add')}
      >
        <svg className="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      {label && <span className="text-xs font-semibold text-gb-brand-600 mt-1.5">{t(label)}</span>}
    </div>
  );
}

export function RemoveCircularButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <div className="flex justify-center mt-6">
      <button
        type="button"
        onClick={onClick}
        className="w-8 h-8 rounded-full border border-neutral-300 text-neutral-500 hover:border-gb-brand-600 hover:text-gb-brand-600 hover:bg-rose-50 flex items-center justify-center transition-all shadow-sm"
        title={t('Remove this card')}
      >
        <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      </button>
    </div>
  );
}

export function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useT();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gb-brand-600 text-white shadow-xl flex items-center justify-center font-bold text-lg hover:bg-gb-brand-700 hover:scale-105 active:scale-95 transition-all z-50 focus:outline-none focus:ring-4 focus:ring-rose-200"
        title={t('Help / Hướng dẫn')}
      >
        ?
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-6 max-w-sm bg-white rounded-2xl shadow-2xl border border-neutral-200 p-5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-neutral-900">{t('Hướng dẫn điền thông tin')}</h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 p-1 rounded-full"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed mb-2">
            {t(
              'Bạn có thể tải lên tệp CV (PDF, DOCX) để hệ thống tự động nhận diện và điền nhanh các giải thưởng, dự án và hoạt động của bạn. Hoặc bạn có thể tự nhập tay từng thành tích vào các ô bên dưới.',
            )}
          </p>
          <p className="text-xs text-neutral-600 leading-relaxed">
            {t(
              'Các minh chứng đính kèm (giấy khen, chứng chỉ, bài báo) sẽ giúp tăng độ tin cậy khi GlowBal xây dựng chiến lược ứng tuyển.',
            )}
          </p>
        </div>
      )}
    </>
  );
}
