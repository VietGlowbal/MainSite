# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary Users**: Vietnamese and international high school students, university students, and young professionals planning and preparing study-abroad applications.
- **Secondary Users**: Parents, academic advisors, and mentors reviewing student portfolios, matching profiles, and strategy roadmaps.

## Product Purpose

GlowBal is an intelligent study-abroad and university admissions platform that empowers applicants to discover courses, evaluate multidimensional institutional fit, build authentic personal branding profiles, and execute step-by-step admissions strategies with evidence-backed AI insights.

## Positioning

Unlike generic AI chatbots or probabilistic admission estimators that hallucinate acceptance percentages, GlowBal delivers **evidence-backed, zero-fabrication matching analyses** and **admissions-reader perspective evaluations** grounded strictly in published university requirements and verified student capabilities.

## Operating Context

- **Multi-lingual Application Environment**: Dual-language support (Vietnamese `vi` and English `en`) via next-intl and dedicated i18n dictionaries.
- **Student Workspaces & Dashboards**: Central hub for managing university shortlists, matching reports, personal brand canvas, and application tasks.
- **Admissions Review Architecture**: Systematic assessment across five core dimensions: Academic Competitiveness, Programme and Values Fit, Career Vision Fit, Financial Feasibility, and Application Readiness.

## Capabilities and Constraints

- **Zero Data Fabrication**: Never invent fake scores, synthetic odds, or speculative timelines. Unassessed metrics must gracefully render as "Not assessed" / "N/A".
- **Evidence-Based Categorization**: Transparent Reach / Match / Strong Match / Safety tiering based strictly on verified requirements.
- **Modern Web Technology Stack**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI Primitives, Supabase PostgreSQL, and Vitest test harness.
- **Full-featured Application Lifecycle**: End-to-end support covering course discovery, document locker, personal statement brainstorming, and timeline execution.

## Brand Commitments

- **Primary Brand Palette**: GlowBal Rose (`#e11d48`, brand tokens `brand`, `brand-600`), deep burgundy/neutral text (`#171717`, `text-fg`), pale rose surface layers (`bg-rose-50/50`, `bg-brand/5`), and clean white cards.
- **Typography Hierarchy**: Display font Bricolage Grotesque / Cabinet Grotesk (`font-display`) paired with crisp body Inter / Plus Jakarta Sans (`font-sans`).
- **Visual Aesthetic**: Premium analytical admissions report aesthetic — rounded containers, subtle shadows, clean SVG data visualizations, and high contrast WCAG accessibility.

## Evidence on Hand

- Verified university course catalog and admission criteria (`data.course`, `catalog_programmes`).
- Real student application profiles, personal statements, achievements, and document lockers.
- Production Figma design system ("GLOWBAL - Edtech", authoritative canvas `375:9842`).

## Product Principles

1. **Admissions Grounding Over AI Magic**: Recommendations reflect the discernment of real admissions committees rather than speculative probability scoring.
2. **Empowerment Through Clarity**: Complex entry requirements and multi-stage application milestones are simplified into actionable, digestible roadmaps.
3. **Uncompromising Data Fidelity**: Every claim, strength, and gap surfaced to the user is traceable to verified facts.
4. **Delight in the Details**: Micro-interactions, visual charts, and feedback states feel polished, responsive, and respectful of the applicant's journey.

## Accessibility & Inclusion

- Adherence to WCAG 2.1 AA contrast ratios across light and dark tones.
- Semantic HTML landmarks, accessible SVGs with ARIA labels, and responsive keyboard navigation.
