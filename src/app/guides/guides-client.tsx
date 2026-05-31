'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { GeoGuide } from '@/lib/geo-content';

// Icon components
const BookmarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

interface GuidesClientProps {
  allGuides: GeoGuide[];
  topics: string[];
}

export function GuidesClient({ allGuides, topics }: GuidesClientProps) {
  const [selectedTopic, setSelectedTopic] = useState('All topics');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest'>('latest');

  // Filter and sort guides
  const filteredGuides = useMemo(() => {
    let filtered = allGuides;

    // Filter by topic
    if (selectedTopic !== 'All topics') {
      filtered = filtered.filter(guide => guide.topic === selectedTopic);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(guide => 
        guide.title.toLowerCase().includes(query) ||
        guide.excerpt.toLowerCase().includes(query) ||
        guide.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    if (sortBy === 'oldest') {
      filtered = [...filtered].reverse();
    }

    return filtered;
  }, [allGuides, selectedTopic, searchQuery, sortBy]);

  // Calculate topic counts
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allGuides.forEach(guide => {
      counts[guide.topic] = (counts[guide.topic] || 0) + 1;
    });
    return counts;
  }, [allGuides]);

  // Get popular tags
  const popularTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    allGuides.forEach(guide => {
      guide.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [allGuides]);

  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [subscribeMessage, setSubscribeMessage] = useState('');

  const handleSubscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setSubscribeStatus('error');
      setSubscribeMessage('Please enter a valid email address');
      return;
    }

    setSubscribeStatus('loading');
    setSubscribeMessage('');

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'guides_page' }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubscribeStatus('success');
        setSubscribeMessage(data.alreadySubscribed ? 'You\'re already subscribed!' : 'Successfully subscribed! Check your email.');
        setEmail('');
      } else {
        setSubscribeStatus('error');
        setSubscribeMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setSubscribeStatus('error');
      setSubscribeMessage('Failed to subscribe. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-600">GLOWBAL GUIDES</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            Study-abroad guides & insights
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Expert insights, real student stories, and practical guides to help you plan, apply and succeed.
          </p>

          {/* Search and Sort */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search articles, topics or universities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'latest' | 'oldest')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            >
              <option value="latest">Sort: Latest</option>
              <option value="oldest">Sort: Oldest</option>
            </select>
          </div>

          {/* Topic Filters */}
          <div className="mt-6 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  selectedTopic === topic
                    ? 'bg-pink-600 text-white shadow-md'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          {/* Articles List */}
          <div className="space-y-6">
            {filteredGuides.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                <p className="text-lg text-slate-600">No guides found matching your criteria.</p>
              </div>
            ) : (
              filteredGuides.map((guide, index) => (
                <article
                  key={guide.slug}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    <Link href={`/guides/${guide.slug}`} className="relative h-48 w-full overflow-hidden sm:h-auto sm:w-64">
                      <Image
                        src={guide.heroImage}
                        alt={guide.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {index === 0 && (
                        <div className="absolute left-4 top-4 rounded-full bg-pink-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                          Featured
                        </div>
                      )}
                    </Link>

                    {/* Content */}
                    <div className="flex flex-1 flex-col p-6">
                      {/* Metadata */}
                      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {new Date(guide.publishedAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {guide.readingTimeMinutes} min read
                        </span>
                        <span>•</span>
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                          {guide.topic}
                        </span>
                      </div>

                      {/* Title */}
                      <h2 className="mb-3 text-xl font-bold text-slate-900 group-hover:text-pink-600">
                        <Link href={`/guides/${guide.slug}`}>
                          {guide.title}
                        </Link>
                      </h2>

                      {/* Excerpt */}
                      <p className="mb-4 line-clamp-2 text-slate-600">
                        {guide.excerpt}
                      </p>

                      {/* Footer */}
                      <div className="mt-auto flex items-center justify-between">
                        <Link
                          href={`/guides/${guide.slug}`}
                          className="text-sm font-semibold text-cyan-600 hover:text-cyan-700"
                        >
                          Read more →
                        </Link>
                        <button
                          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-pink-600"
                          aria-label="Bookmark"
                        >
                          <BookmarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Explore by Topic */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Explore by topic</h3>
              <div className="space-y-2">
                {topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setSelectedTopic(topic)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      selectedTopic === topic
                        ? 'bg-pink-50 font-semibold text-pink-600'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        selectedTopic === topic ? 'bg-pink-600' : 'bg-slate-300'
                      }`} />
                      {topic}
                    </span>
                    <span className="text-slate-500">{topicCounts[topic] || allGuides.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Popular Tags */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Popular tags</h3>
              <div className="flex flex-wrap gap-2">
                {popularTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSearchQuery(tag)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {tag}
                  </button>
                ))}
                <Link
                  href="#"
                  className="rounded-full px-3 py-1 text-xs font-semibold text-pink-600 hover:text-pink-700"
                >
                  View all tags →
                </Link>
              </div>
            </div>

            {/* Newsletter Signup */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-pink-50 to-cyan-50 p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-bold text-slate-900">Stay updated</h3>
              <p className="mb-4 text-sm text-slate-600">
                Get the latest study abroad tips, guides and opportunities straight to your inbox.
              </p>
              <form onSubmit={handleSubscribe} className="space-y-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={subscribeStatus === 'loading' || subscribeStatus === 'success'}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 disabled:opacity-50"
                  required
                />
                <button
                  type="submit"
                  disabled={subscribeStatus === 'loading' || subscribeStatus === 'success'}
                  className="w-full rounded-lg bg-gradient-to-r from-pink-600 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-pink-700 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {subscribeStatus === 'loading' ? 'Subscribing...' : subscribeStatus === 'success' ? '✓ Subscribed' : 'Subscribe'}
                </button>
                {subscribeMessage && (
                  <p className={`text-xs ${subscribeStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                    {subscribeMessage}
                  </p>
                )}
              </form>
            </div>

            {/* Mentor CTA */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-bold text-slate-900">Need personalized advice?</h3>
              <p className="mb-4 text-sm text-slate-600">
                Chat with a mentor who has studied in the UK.
              </p>
              <div className="mb-4 flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-10 rounded-full border-2 border-white bg-gradient-to-br from-pink-400 to-cyan-400"
                  />
                ))}
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-bold text-slate-600">
                  +42
                </div>
              </div>
              <Link
                href="/mentors"
                className="block w-full rounded-lg bg-cyan-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-cyan-700"
              >
                Ask a mentor →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
