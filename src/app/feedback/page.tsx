'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const feedbackSchema = z.object({
  pageUrl: z.string().url('Please enter a valid URL'),
  steps: z.string().min(10, 'Please describe the steps in at least 10 characters'),
  expected: z.string().min(5, 'Please describe what you expected'),
  actual: z.string().min(5, 'Please describe what actually happened'),
});

type FeedbackForm = z.infer<typeof feedbackSchema>;

export default function FeedbackPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackForm>();

  const onSubmit = async (data: FeedbackForm) => {
    setStatus('submitting');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('pageUrl', data.pageUrl);
      formData.append('steps', data.steps);
      formData.append('expected', data.expected);
      formData.append('actual', data.actual);
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Something went wrong');
      }

      setStatus('success');
      reset();
      setScreenshot(null);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit feedback');
    }
  };

  if (status === 'success') {
    return (
      <main className="min-h-screen bg-transparent px-4 py-12 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="rounded-2xl border border-slate-100 bg-white p-10 shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Bug report sent!</h1>
            <p className="mt-2 text-slate-500">
              Thanks for helping us improve Glowbal. We&apos;ll look into it.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-pink-600"
            >
              Submit another report
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-12 md:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            UAT Feedback
          </h1>
          <p className="mt-2 text-base text-slate-500">
            Found a bug? Let us know so we can fix it.
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8"
        >
          {/* Page URL */}
          <div>
            <label htmlFor="pageUrl" className="mb-1.5 block text-sm font-medium text-slate-700">
              Page URL
            </label>
            <input
              id="pageUrl"
              type="url"
              placeholder="https://glowbal-education.com/..."
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100"
              {...register('pageUrl', { required: 'Page URL is required' })}
            />
            {errors.pageUrl && (
              <p className="mt-1 text-xs text-red-500">{errors.pageUrl.message}</p>
            )}
          </div>

          {/* Steps to reproduce */}
          <div>
            <label htmlFor="steps" className="mb-1.5 block text-sm font-medium text-slate-700">
              Steps to reproduce
            </label>
            <textarea
              id="steps"
              rows={3}
              placeholder="1. Go to ...&#10;2. Click on ...&#10;3. ..."
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100"
              {...register('steps', { required: 'Steps are required', minLength: { value: 10, message: 'Please be more specific' } })}
            />
            {errors.steps && (
              <p className="mt-1 text-xs text-red-500">{errors.steps.message}</p>
            )}
          </div>

          {/* Expected result */}
          <div>
            <label htmlFor="expected" className="mb-1.5 block text-sm font-medium text-slate-700">
              Expected result
            </label>
            <textarea
              id="expected"
              rows={2}
              placeholder="What should have happened?"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100"
              {...register('expected', { required: 'Expected result is required', minLength: { value: 5, message: 'Please be more specific' } })}
            />
            {errors.expected && (
              <p className="mt-1 text-xs text-red-500">{errors.expected.message}</p>
            )}
          </div>

          {/* Actual result */}
          <div>
            <label htmlFor="actual" className="mb-1.5 block text-sm font-medium text-slate-700">
              Actual result
            </label>
            <textarea
              id="actual"
              rows={2}
              placeholder="What happened instead?"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100"
              {...register('actual', { required: 'Actual result is required', minLength: { value: 5, message: 'Please be more specific' } })}
            />
            {errors.actual && (
              <p className="mt-1 text-xs text-red-500">{errors.actual.message}</p>
            )}
          </div>

          {/* Screenshot */}
          <div>
            <label htmlFor="screenshot" className="mb-1.5 block text-sm font-medium text-slate-700">
              Screenshot <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="screenshot"
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-pink-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-pink-600 hover:file:bg-pink-100"
            />
            {screenshot && (
              <p className="mt-1 text-xs text-slate-400">
                {screenshot.name} ({(screenshot.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          {/* Error message */}
          {status === 'error' && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage || 'Something went wrong. Please try again.'}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-full bg-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? 'Sending…' : 'Submit Bug Report'}
          </button>
        </form>
      </div>
    </main>
  );
}
