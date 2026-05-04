# Implementation Plan: University Explorer

## Overview

Replace the placeholder `/universities` page with a full university browsing, detail viewing, shortlisting, and application tracking experience. The implementation follows a bottom-up approach: data layer first, then state management, then page shell and views, then individual UI components, and finally animations and polish. All code is TypeScript/React with Tailwind styling, reusing existing project patterns from `design-cosmos.tsx` and `landing-globe.tsx`.

## Tasks

- [x] 1. Create static data module and types
  - [x] 1.1 Create `src/lib/university-data.ts` with TypeScript interfaces and static data
    - Define `UniversityReview`, `University`, `ApplicationStage`, and `FilterCategory` types
    - Export `APPLICATION_STAGES` constant array with 6 stage definitions (Submitted, Preparing Documents, Entry Assessment, Interview Stage, Awaiting Decision, Offer Received) each with label, icon emoji, and description
    - Export `FILTER_CATEGORIES` constant tuple: All, Russell Group, STEM, Arts & Humanities, Global Top 50
    - Export `UNIVERSITIES` array with 12 UK university records (Oxford, Cambridge, Imperial, Birmingham, Edinburgh, Manchester, LSE, Bath, King's College London, Leeds, Royal College of Art, Warwick) — each with id, name, location, emoji, color, rating, reviews, acceptance, tags, rank, founded, description, stats, requirements, and reviewsData
    - Source university data from the HTML demo files (`uni-shop.html`, `unishop.html`) in the project root
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create Explorer context provider for state management
  - [x] 2.1 Create `src/lib/explorer-context.tsx` with React context and provider
    - Define `ApplicationEntry` interface with universityId, currentStage (0–5 index), and submittedAt
    - Define `ExplorerState` interface with activeView, selectedUniversityId, activeFilter, shortlist (number[]), applications (ApplicationEntry[]), and toast state
    - Define `ExplorerActions` interface with setView, setFilter, addToShortlist, removeFromShortlist, isShortlisted, proceedToApplications, advanceApplication, and showToast
    - Implement `UniversityExplorerProvider` component using `useState` for all state
    - Implement filter logic: 'All' returns all universities; 'Arts & Humanities' matches the 'Arts' tag; others match by tag name
    - Implement shortlist management: add (no duplicates), remove, and isShortlisted check
    - Implement proceedToApplications: convert shortlisted IDs to ApplicationEntry objects at stage 0, skip IDs already in applications, clear shortlist
    - Implement advanceApplication: increment currentStage up to max index (5)
    - Implement toast with auto-dismiss after 3 seconds via setTimeout, replacing any existing toast
    - Export `useExplorer` convenience hook
    - _Requirements: 2.4, 3.2, 3.3, 5.2, 5.3, 5.6, 6.2, 6.5, 7.6, 8.2, 10.2, 10.4_

- [x] 3. Checkpoint — Ensure data layer and context compile correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create page shell and client component with view switching
  - [x] 4.1 Update `src/app/universities/page.tsx` server component shell
    - Replace placeholder content with import and render of `UniversityExplorerClient`
    - _Requirements: 2.1, 8.5_

  - [x] 4.2 Create `src/app/universities/university-explorer-client.tsx` client component
    - Mark as `'use client'`
    - Wrap content in `UniversityExplorerProvider`
    - Apply cosmos theme background: dark navy gradient (`linear-gradient(180deg,#040b17 0%,#061325 55%,#091c36 100%)`), star field overlay (reuse pattern from `design-cosmos.tsx`)
    - Render `TabBar` component at top
    - Conditionally render active view: BrowseView (with HeroSection, FilterBar, UniversityGrid), DetailView, ShortlistView, or ApplicationTrackerView based on `activeView` state
    - Render `ToastNotification` component
    - Ensure full-height layout with bottom padding for mobile nav bar on viewports below 640px
    - _Requirements: 2.5, 8.1, 8.2, 8.5, 11.4_

- [x] 5. Implement TabBar and HeroSection components
  - [x] 5.1 Create `TabBar` component
    - Render three tabs: Browse, Shortlist (with badge showing shortlist count), My Applications
    - Highlight active tab with cyan accent color (#00b4d8)
    - Call `setView` on tab click to switch between 'browse', 'shortlist', 'applications'
    - Apply cosmos glassmorphism styling (semi-transparent bg, border-white/[.07], backdrop-blur)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.2 Create `HeroSection` component
    - Render `LandingGlobe` component with cosmos theme, 500px size, 0.4 rotation speed
    - Position globe behind heading text using absolute positioning and reduced opacity
    - Add gradient overlay for text contrast
    - Display heading with gradient text style (pink #ff4d8c to cyan #00b4d8) on a keyword
    - Display subtitle text below heading
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 6. Implement FilterBar and UniversityGrid with UniversityCard
  - [x] 6.1 Create `FilterBar` component
    - Render filter chips for: All, Russell Group, STEM, Arts & Humanities, Global Top 50
    - Highlight active filter chip with cyan accent background
    - Call `setFilter` on chip click
    - Display count label showing number of currently displayed universities
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.2 Create `UniversityCard` component
    - Display emoji banner with university's banner color as background
    - Display rank badge (e.g., "#1 UK") in top-right corner of banner area
    - Display university name, location, star rating, review count, tag chips, and acceptance rate
    - Show "Shortlisted" badge when university is in shortlist (read from context)
    - Apply glassmorphism card styling: border-white/[.07], bg-white/[.04], backdrop-blur
    - Apply hover effect: translateY(-4px) and enhanced glow shadow
    - On click, call `setView('detail', university.id)`
    - _Requirements: 2.3, 2.4, 2.6, 2.7_

  - [x] 6.3 Create `UniversityGrid` component
    - Render CSS Grid with `auto-fill, minmax(280px, 1fr)` columns
    - Accept filtered universities array and render `UniversityCard` for each
    - Single-column layout on viewports below 768px
    - _Requirements: 2.2, 11.1_

- [x] 7. Checkpoint — Ensure browse view renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement DetailView with ShortlistSidebar
  - [x] 8.1 Create `DetailView` component
    - Read selected university from context using `selectedUniversityId`
    - Two-column layout: main content + sidebar (stacked vertically below 768px)
    - Main content: large emoji banner, university name, location, star rating with review count, full description
    - Stats grid: student count, staff/campus info, acceptance rate in individual stat boxes
    - Entry requirements list with visual icons
    - Alumni review cards: reviewer name, star rating, review text
    - "Back to Browse" button that calls `setView('browse')`
    - Apply cosmos theme styling consistent with browse view
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 11.2_

  - [x] 8.2 Create `ShortlistSidebar` component
    - Display university name, key stats (acceptance rate, rank, founded year)
    - "Add to Shortlist" button: calls `addToShortlist` and `showToast` on click
    - When already shortlisted: button shows "Shortlisted" text with green/success styling
    - "Save for Later" secondary action button
    - Sticky positioning so sidebar remains visible on scroll
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Implement ShortlistView (Cart page)
  - [x] 9.1 Create `ShortlistView` component
    - Display shortlisted universities as list items with emoji, name, location, tags, and remove button
    - Remove button calls `removeFromShortlist` and `showToast`
    - Order summary panel showing count of shortlisted universities and "Proceed to Applications" button
    - "Proceed to Applications" button calls `proceedToApplications` and switches view to 'applications'
    - Empty state: illustration, "Your shortlist is empty" message, "Browse Universities" button that navigates to browse view
    - Apply cosmos theme styling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 10. Implement ApplicationTrackerView with ProgressTimeline
  - [x] 10.1 Create `ProgressTimeline` component
    - Render six horizontal steps from APPLICATION_STAGES
    - Completed stages: green dot with checkmark icon
    - Active (current) stage: cyan dot (#00b4d8) with glow shadow
    - Pending stages: muted/grey dot
    - Labels below each dot
    - Reduced font size for step labels on viewports below 768px
    - _Requirements: 7.2, 7.3, 7.4, 11.3_

  - [x] 10.2 Create `ApplicationTrackerView` component
    - Display each application as a card with university emoji, name, location, and `ProgressTimeline`
    - Show status message below timeline describing current stage meaning
    - "Advance Stage" button calls `advanceApplication`
    - When application reaches final stage (Offer Received): display celebratory banner ("Congratulations! Offer Received 🎉") and disable advance button
    - Empty state: message and "Browse Universities" navigation button
    - Apply cosmos theme styling
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 7.8, 7.9_

- [x] 11. Checkpoint — Ensure all views and interactions work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement ToastNotification component
  - [x] 12.1 Create `ToastNotification` component
    - Fixed position at bottom-right of viewport
    - Slide-up entrance animation
    - Auto-dismiss after 3 seconds (driven by context toast state)
    - Dark background, light text, coloured left border accent
    - Replace any currently visible toast when a new one is triggered
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 13. Add GSAP animations and view transitions
  - [x] 13.1 Add GSAP staggered entrance animations to UniversityGrid cards
    - Use `useGSAP` hook (already available via `@gsap/react`) for staggered fade-up on card mount
    - Follow animation patterns from `design-cosmos.tsx` (gsap.from with opacity, y, stagger)
    - _Requirements: 12.1_

  - [x] 13.2 Add view transition animations
    - Animate incoming views with fade and slight vertical translation when switching tabs
    - Animate "Shortlisted" badge appearance/disappearance with scale transition
    - Animate LandingGlobe in hero with scale-up and fade-in on initial load
    - _Requirements: 12.2, 12.3, 12.4_

- [x] 14. Final checkpoint — Ensure all features work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- No property-based tests are included because the design does not define Correctness Properties (this is a UI-focused feature)
- The design uses TypeScript throughout, so all implementation uses TypeScript/React with Tailwind
- All components should follow existing codebase patterns from `design-cosmos.tsx` for cosmos theme styling
- The `LandingGlobe` component is reused as-is from `src/components/landing-globe.tsx`
- GSAP and `@gsap/react` are already project dependencies — no new packages needed
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
