---
name: GlowBal
description: Intelligent study-abroad & university admissions strategy platform
colors:
  primary: "#e11d48"
  primary-hover: "#be123c"
  primary-subtle: "#ffe4e6"
  surface: "#ffffff"
  surface-muted: "#f8fafc"
  surface-inverse: "#0f172a"
  text-primary: "#0f172a"
  text-secondary: "#334155"
  text-tertiary: "#64748b"
  text-muted: "#94a3b8"
  border-line: "#e2e8f0"
  border-line-strong: "#cbd5e1"
  tier-safe: "#059669"
  tier-recommend: "#2563eb"
  tier-reach: "#e11d48"
typography:
  display:
    fontFamily: "Cabinet Grotesk, Bricolage Grotesque, sans-serif"
    fontWeight: 700
  body:
    fontFamily: "Plus Jakarta Sans, Inter, sans-serif"
    fontWeight: 400
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  "2xl": "16px"
  full: "9999px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "20px"
  "3xl": "24px"
  "4xl": "32px"
  "5xl": "40px"
  "6xl": "48px"
  "7xl": "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "10px 18px"
---

# Design System

<!-- impeccable:design-schema 1 -->

## Overview

GlowBal's design language combines the rigorous authority of an elite academic admissions consultancy with the modern agility of a high-end SaaS product. Interfaces prioritize cognitive clarity, analytical rigor, visual hierarchy, and optical balance.

## Colors

- **Brand Crimson / Rose**: `#e11d48` (`brand`, `brand-600`) — Primary actions, active indicator arcs, key standout highlights.
- **Surfaces**:
  - `bg-surface`: `#ffffff` — Core card & canvas backgrounds.
  - `bg-surface-muted`: `#f8fafc` / `#f5f5f5` — Secondary tracks, subtle panel backgrounds.
  - `bg-rose-50/50`: Tonal warm tint for primary highlight cards.
- **Typography & Text**:
  - `text-fg`: `#0f172a` — Headings and primary emphasis.
  - `text-fg-secondary`: `#334155` — Descriptive body copy.
  - `text-fg-tertiary`: `#64748b` — Subtitles, captions, and context lines.
  - `text-fg-muted`: `#94a3b8` — Metric labels and minor metadata.
- **Admission Tiers**:
  - `tier-safe`: `#059669` (Green / Emerald)
  - `tier-recommend`: `#2563eb` (Blue)
  - `tier-reach`: `#e11d48` (Rose / Crimson)

## Typography

- **Display Headings**: `Cabinet Grotesk` / `Bricolage Grotesque` (`font-display`) for section titles, metric numbers, and hero statements.
- **Body & Interface**: `Plus Jakarta Sans` / `Inter` (`font-sans`) for high-legibility UI text, tables, criteria lists, and tooltips.
- **Hierarchy Scale**:
  - `text-gb-display-xs` (24px/32px) / `text-gb-display-sm` (30px/38px)
  - `text-gb-xl` (20px/30px), `text-gb-lg` (18px/28px), `text-gb-md` (16px/24px), `text-gb-sm` (14px/20px), `text-gb-xs` (12px/18px), `text-gb-xxs` (10px/14px)

## Layout & Grid

- **Container**: Max width `1280px` (`max-w-gb-desktop`) with 16px/32px responsive gutters. TopNav uses wider measure `1728px`.
- **Spacing Steps**: `gb-*` tokens (2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96px).
- **Rhythm**: Generous vertical whitespace between analytical sections (24px to 48px), compact internal card grouping (8px to 16px).

## Elevation & Depth

- **Subtle Layering**: Flat bordered cards (`border border-line`) over light neutral canvas (`#f8fafc`).
- **Shadows**: Soft, diffused shadows (`shadow-xs`, `shadow-sm`), avoiding heavy dark dropshadows.
- **Ambient Glow**: Low-opacity radial glows (`bg-brand/10 blur-md`) for primary circular score gauges.

## Shapes

- **Corner Radii**: Standard rounded-xl (`12px`), rounded-2xl (`16px`), rounded-full (`9999px`) for badges and pills.
- **Visual Tracks**: Pill-shaped progress bars and clean SVG circular rings.

## Components

- **Score Gauges**: SVG progress rings with smooth stroke dashoffset animations and centered metric percentages.
- **Analytical Column Charts**: SVG-rendered vertical bar graphs with clean Y-axis ticks, baseline gridlines, and rounded bar tops.
- **Reasoning Chains**: Horizontal multi-step connected flow cards (`Assessment` → `Evidence` → `Why it matters` → `Admissions perspective`).
- **Status Tracks**: Multi-stage requirement indicators with risk badges and status tracks.

## Do's and Don'ts

### Do's
- Ground every visualization in verified facts.
- Display "Not assessed" / "N/A" with dashed outlines for missing data.
- Maintain consistent 4px/8px alignment and WCAG AA contrast.
- Use modular components under `src/features/apply/ui/matching-report/`.

### Don'ts
- Never invent synthetic acceptance probabilities or speculative odds.
- Do not overload screens into busy BI dashboard widgets.
- Avoid raw un-tokenized hex codes in component code.
