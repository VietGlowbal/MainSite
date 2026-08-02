import { notFound } from 'next/navigation';
import { FormPrimitivesDemo } from './form-primitives-demo';
import { LoaderDemo } from './loader-demo';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/ui';
import {
  Avatar,
  Badge,
  Button,
  CheckItem,
  CheckList,
  Checkbox,
  CheckboxGroup,
  FeatureCard,
  Footer,
  GlobeLoader,
  ICONS,
  Input,
  KitIcon,
  Metric,
  Radio,
  RadioGroup,
  ScoreRing,
  Select,
  Stepper,
  Textarea,
  TopNav,
} from '@/shared/ui';

/**
 * Design-system reference page. Development only.
 *
 * Renders every design token in the app's real CSS environment — which is the
 * whole point. A Storybook would give a *different* environment (its own CSS
 * pipeline, without the 5,600-line legacy stylesheet), so a component could
 * look right there and wrong in the product. This page cannot lie about that.
 *
 * It also backs the visual-regression spec in tests/e2e/kitchen-sink.spec.ts:
 * one screenshot here catches an accidental token change across the whole
 * system.
 *
 * Track B: add each `src/shared/ui` primitive below as you build it, in every
 * variant and size.
 */
export default function KitchenSinkPage() {
  // Hidden in production. ENABLE_DEV_ROUTES exists so the E2E suite — which
  // runs a production build on purpose — can still reach it. Real deploys must
  // never set it.
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  return (
    <main className="mx-auto max-w-gb-desktop bg-surface p-gb-4xl text-fg">
      <h1 className="font-display text-gb-display-md">GLOWBAL design tokens</h1>
      <p className="mt-gb-md text-gb-md text-fg-tertiary">
        Extracted from Figma. Neutrals, spacing, radius, type and the tier palette are
        confirmed; only the brand steps either side of 600 are inferred from the rose ramp.
      </p>

      <Section title="Neutral ramp">
        <div className="flex flex-wrap gap-gb-md">
          {NEUTRALS.map((n) => (
            <Swatch key={n.name} name={n.name} className={n.className} />
          ))}
        </div>
      </Section>

      <Section title="Brand ramp (rose — 600 confirmed from Figma)">
        <div className="flex flex-wrap gap-gb-md">
          <Swatch name="50" className="bg-gb-brand-50 border border-line" />
          <Swatch name="100" className="bg-gb-brand-100" />
          <Swatch name="300" className="bg-gb-brand-300" />
          <Swatch name="500" className="bg-gb-brand-500" />
          <Swatch name="600" className="bg-gb-brand-600" />
          <Swatch name="700" className="bg-gb-brand-700" />
        </div>
      </Section>

      <Section title="Admission tiers">
        <p className="mb-gb-lg text-gb-sm text-fg-tertiary">
          Encodes the reach / recommend / safe classification from admission-fit.ts.
        </p>
        <div className="flex flex-wrap items-center gap-gb-md">
          <Badge variant="reach">Reach Universities</Badge>
          <Badge variant="recommend">Recommend Universities</Badge>
          <Badge variant="safe">Safe Universities</Badge>
          <Badge>New</Badge>
        </div>
      </Section>

      <Section title="Semantic colours">
        <div className="flex flex-wrap gap-gb-md">
          <Swatch name="surface" className="bg-surface border border-line" />
          <Swatch name="surface-hover" className="bg-surface-hover" />
          <Swatch name="surface-muted" className="bg-surface-muted" />
          <Swatch name="surface-inverse" className="bg-surface-inverse" />
          <Swatch name="brand" className="bg-brand" />
        </div>
        <div className="mt-gb-lg space-y-gb-xs">
          <p className="text-gb-md text-fg">text-fg — primary</p>
          <p className="text-gb-md text-fg-secondary">text-fg-secondary</p>
          <p className="text-gb-md text-fg-tertiary">text-fg-tertiary</p>
          <p className="text-gb-md text-fg-muted">text-fg-muted</p>
        </div>
      </Section>

      <Section title="Type scale">
        <div className="space-y-gb-md">
          <p className="font-display text-gb-display-xl">display-xl 60/72</p>
          <p className="font-display text-gb-display-md">display-md 36/44</p>
          <p className="font-display text-gb-display-sm">display-sm 30/38</p>
          <p className="font-display text-gb-display-xs">display-xs 24/32</p>
          <p className="text-gb-xl">text-xl 20/30</p>
          <p className="text-gb-lg">text-lg 18/28</p>
          <p className="text-gb-md">text-md 16/24 — Tiếng Việt có dấu</p>
          <p className="text-gb-sm">text-sm 14/20</p>
          <p className="text-gb-xs">text-xs 12/18</p>
        </div>
      </Section>

      <Section title="Radius">
        {/* Class names are written out in full: Tailwind extracts literal
            strings from source, so an interpolated `rounded-gb-${r}` would
            never generate a utility. */}
        <div className="flex flex-wrap items-end gap-gb-md">
          {RADII.map((r) => (
            <div key={r.name} className="text-center">
              <div className={`h-16 w-16 bg-surface-inverse ${r.className}`} />
              <span className="mt-gb-xs block text-gb-xs text-fg-muted">{r.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing">
        <div className="space-y-gb-xs">
          {SPACING.map((s) => (
            <div key={s.name} className="flex items-center gap-gb-md">
              <span className="w-16 text-gb-xs text-fg-muted">{s.name}</span>
              <div className={`h-3 bg-brand ${s.className}`} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadows">
        <div className="flex flex-wrap gap-gb-3xl">
          <div className="rounded-gb-xl bg-surface p-gb-xl shadow-gb-xs">shadow-gb-xs</div>
          <div className="rounded-gb-xl bg-surface p-gb-xl shadow-gb-lg">shadow-gb-lg</div>
          <div className="rounded-gb-xl bg-surface p-gb-xl shadow-gb-xs-skeuomorphic">
            shadow-gb-xs-skeuomorphic
          </div>
        </div>
      </Section>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-gb-lg">
          <Button>Primary sm</Button>
          <Button size="md">Primary md</Button>
          <Button variant="secondary">Secondary sm</Button>
          <Button variant="secondary" size="md">
            Secondary md
          </Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-gb-lg flex flex-wrap items-center gap-gb-lg rounded-gb-md bg-surface-inverse-strong p-gb-lg">
          <Button variant="secondary-on-dark">Secondary on dark</Button>
          <Button>Primary on dark</Button>
        </div>
      </Section>

      <Section title="TopNav — guest, dark (Figma 104:7114)">
        <TopNav
          logo={<GlowbalLogo height={28} />}
          items={DEMO_NAV_ITEMS}
          secondaryAction={{ href: '/auth', label: 'Đăng nhập' }}
          primaryAction={{ href: '/apply', label: 'Lập kế hoạch Du học' }}
        />
      </Section>

      <Section title="TopNav — guest, light (Figma 105:8301)">
        <TopNav
          tone="light"
          logo={<GlowbalLogo height={28} />}
          items={DEMO_NAV_ITEMS}
          secondaryAction={{ href: '/auth', label: 'Đăng nhập' }}
          primaryAction={{ href: '/universities', label: 'Tìm trường đại học' }}
        />
      </Section>

      <Section title="TopNav — signed in (Figma 203:12356; no secondary action)">
        <TopNav
          logo={<GlowbalLogo height={28} />}
          items={DEMO_NAV_ITEMS}
          primaryAction={{ href: '/apply', label: 'Lập kế hoạch Du học' }}
          user={{ name: 'Khánh Linh', href: '/profile', avatarUrl: null }}
        />
      </Section>

      <Section title="Avatar (32px — image and initials fallback)">
        <div className="flex items-center gap-gb-xl bg-surface-inverse-strong p-gb-lg">
          <Avatar name="Khánh Linh" />
          <Avatar name="Olivia Rhye" />
        </div>
      </Section>

      <Section title="Form controls (Figma 105:8028 — label 6px above a 44px box)">
        <div className="grid max-w-gb-width-xl gap-gb-3xl sm:grid-cols-2">
          <Input name="ks-name" label="Name" placeholder="Enter your name" />
          <Input
            name="ks-email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            hint="Chúng tôi chỉ dùng email để gửi kết quả."
          />
          <Input
            name="ks-invalid"
            label="Email (error — không có trong Figma)"
            defaultValue="not-an-email"
            error="Email không hợp lệ."
          />
          <Select name="ks-country" label="Country" placeholder="Select a country" defaultValue="">
            <option value="uk">United Kingdom</option>
            <option value="us">United States</option>
            <option value="au">Australia</option>
          </Select>
          <Input name="ks-disabled" label="Disabled" placeholder="Không sửa được" disabled />
          <Textarea
            name="ks-sop"
            label="Personal statement"
            placeholder="Dán bài viết của bạn vào đây…"
            hint="Tối đa 650 từ."
          />
        </div>
      </Section>

      <Section title="Radio / Checkbox (trạng thái chọn suy từ kit, Figma chỉ vẽ trạng thái trống)">
        <div className="grid max-w-gb-width-xl gap-gb-4xl sm:grid-cols-2">
          <RadioGroup id="ks-level" legend="Bạn đang học ở bậc nào?">
            <Radio name="ks-level" value="highschool" label="Trung học phổ thông" defaultChecked />
            <Radio name="ks-level" value="undergrad" label="Đại học" />
            <Radio
              name="ks-level"
              value="grad"
              label="Sau đại học"
              description="Thạc sĩ hoặc tiến sĩ"
            />
          </RadioGroup>
          <CheckboxGroup id="ks-subjects" legend="Ngành quan tâm" hint="Chọn tất cả những gì phù hợp.">
            <Checkbox name="ks-subjects" value="eng" label="Engineering" description="12 users" />
            <Checkbox name="ks-subjects" value="design" label="Design" description="10 users" />
            <Checkbox name="ks-subjects" value="business" label="Business" />
          </CheckboxGroup>
        </div>
      </Section>

      <Section title="Footer (Figma 104:7404)">
        <Footer
          logo={<GlowbalLogo height={28} />}
          tagline={FOOTER_TAGLINE}
          columns={FOOTER_COLUMNS}
          social={FOOTER_SOCIAL}
          copyright={FOOTER_COPYRIGHT}
          ratings={FOOTER_RATINGS}
        />
      </Section>

      <Section title="Metric (row goes horizontal at lg, hairlines between)">
        <div className="flex flex-col items-center gap-gb-6xl lg:flex-row lg:justify-center lg:gap-0">
          <Metric value="10,000+" label="Trường đại học trong kho" />
          <div aria-hidden="true" className="hidden w-px self-stretch bg-line lg:block" />
          <Metric value="150 triệu" label="Tổng giá trị học bổng (USD)" />
        </div>
      </Section>

      <Section title="CheckItem">
        <CheckList>
          <CheckItem>Hơn 200 trường đại học hàng đầu thế giới</CheckItem>
          <CheckItem>
            Một dòng dài để xem chữ xuống dòng có còn thẳng hàng với dấu tích hay không, vì hộp icon
            28px và line-height 28px là cùng một con số
          </CheckItem>
        </CheckList>
      </Section>

      <Section title="FeatureCard (row sở hữu layout, thẻ không tự đặt bề ngang)">
        <div className="grid gap-gb-3xl sm:grid-cols-2">
          <FeatureCard
            icon="messageChatCircle"
            title="Chọn một trường đại học"
            body="Tìm kiếm một trường đại học mà bạn quan tâm, hoặc duyệt theo quốc gia, chuyên ngành, ngân sách."
            href="/universities"
            actionLabel="Tìm hiểu thêm"
          />
          <FeatureCard
            icon="chartBreakoutSquare"
            title="Chọn học bổng"
            body="Xem các cơ hội học bổng liên quan đến trường đại học bạn đã chọn."
            href="/scholarships"
            actionLabel="Tìm hiểu thêm"
          />
        </div>
      </Section>

      <Section title="KitIcon (kích thước lấy từ viewBox, không phải size-6)">
        <div className="flex flex-wrap items-center gap-gb-4xl text-brand">
          {(['zapFast', 'checkCircle', 'messageChatCircle', 'zap', 'chartBreakoutSquare', 'messageSmileCircle', 'arrowRight'] as const).map(
            (name) => (
              <span key={name} className="flex flex-col items-center gap-gb-md">
                <KitIcon art={ICONS[name]} frame={32} />
                <span className="text-gb-xs text-fg-muted">{name}</span>
              </span>
            ),
          )}
        </div>
      </Section>

      <Section title="Form primitives — RepeatableFieldset and RangeHistogram">
        <p className="mb-gb-3xl text-gb-sm text-fg-tertiary">
          Both are only meaningful in motion. Remove the middle achievement and check the others
          keep their own values; drag the budget handles together and check they clamp rather than
          swap. The distribution is placeholder shape, not real data.
        </p>
        <FormPrimitivesDemo />
      </Section>

      <Section title="ScoreRing (Figma 337:18813 — banded 70 / 40)">
        <p className="mb-gb-xl text-gb-sm text-fg-tertiary">
          Drawn as an SVG arc, not the flat images the frame exports, because the arc has to
          follow a real value. The caption is required: `progress` and `match` band identically,
          so a bare ring at 40% in green is genuinely ambiguous.
        </p>
        <div className="flex flex-wrap items-end gap-gb-4xl">
          <ScoreRing value={92} measure="progress" />
          <ScoreRing value={60} measure="progress" />
          <ScoreRing value={30} measure="progress" />
          <ScoreRing value={0} measure="progress" />
          <ScoreRing value={72} measure="match" size="sm" />
          <ScoreRing value={83} measure="match" size="lg" label="Overall fit" />
        </div>
      </Section>

      <Section title="Stepper — per-course journey (due dates)">
        <Stepper
          steps={[
            { key: 'research', label: 'Research', meta: 'Due 14 Aug 2026' },
            { key: 'eligibility', label: 'Check eligibility', meta: 'Due 14 Sep 2026' },
            { key: 'documents', label: 'Prepare documents', meta: 'Due 14 Oct 2026' },
            { key: 'improve', label: 'Improve application', meta: 'Due 14 Oct 2026' },
            { key: 'submit', label: 'Submit', meta: 'Due 14 Oct 2026' },
          ]}
          currentIndex={2}
          label="Your application journey"
        />
      </Section>

      <Section title="Stepper — AI strategy, paywall after step 3">
        <p className="mb-gb-xl text-gb-sm text-fg-tertiary">
          A locked step never renders as reached and never linkifies, however far the student has
          got — the boundary has to read as a wall rather than as work not yet done.
        </p>
        <Stepper
          steps={[
            { key: 'reflection', label: 'Reflection', href: '#' },
            { key: 'report', label: 'Output report', href: '#' },
            { key: 'university', label: 'University Detail', href: '#' },
            { key: 'strategy', label: 'Application Strategy', locked: true },
            { key: 'audit', label: 'Submit Audit', locked: true },
          ]}
          currentIndex={2}
          label="AI strategy journey"
        />
      </Section>

      <Section title="GlobeLoader (busy state — not from Figma, see tokens.css)">
        <div className="flex flex-wrap items-start gap-gb-4xl">
          <div className="flex flex-col items-center gap-gb-md">
            <GlobeLoader />
            <span className="text-gb-xs text-fg-muted">md, no label</span>
          </div>
          <div className="flex flex-col items-center gap-gb-md">
            <GlobeLoader label="Saving your profile" />
            <span className="text-gb-xs text-fg-muted">md, labelled</span>
          </div>
          <div className="flex flex-col items-center gap-gb-md">
            <GlobeLoader size="sm" label="Recalculating your match" />
            <span className="text-gb-xs text-fg-muted">sm</span>
          </div>
        </div>
        <p className="mt-gb-xl text-gb-sm text-fg-tertiary">
          The rotating line is shared by every loader on screen, so these three show the
          same word. Below is the real overlay, scrim and all.
        </p>
        <div className="mt-gb-lg">
          <LoaderDemo />
        </div>
      </Section>
    </main>
  );
}

/** The five labels on Figma node 104:7114. Reference only, and deliberately
 *  frozen at what that frame drew — the real nav is MARKETING_NAV_ITEMS, which
 *  since 01/08 is four entries with a dropdown and no longer matches this. */
const DEMO_NAV_ITEMS = [
  { href: '/about', label: 'Về chúng tôi' },
  { href: '/ai-strategy', label: 'AI lên chiến lược' },
  { href: '/apply', label: 'Lập kế hoạch du học' },
  { href: '/mentors', label: 'Tìm cố vấn' },
  { href: '/news', label: 'Blog' },
];

const NEUTRALS = [
  { name: '950', className: 'bg-gb-neutral-950' },
  { name: '900', className: 'bg-gb-neutral-900' },
  { name: '700', className: 'bg-gb-neutral-700' },
  { name: '600', className: 'bg-gb-neutral-600' },
  { name: '500', className: 'bg-gb-neutral-500' },
  { name: '400', className: 'bg-gb-neutral-400' },
  { name: '300', className: 'bg-gb-neutral-300' },
  { name: '200', className: 'bg-gb-neutral-200' },
  { name: '50', className: 'bg-gb-neutral-50' },
  { name: '0', className: 'bg-gb-neutral-0 border border-line' },
];

const RADII = [
  { name: 'none', className: 'rounded-gb-none' },
  { name: 'sm', className: 'rounded-gb-sm' },
  { name: 'md', className: 'rounded-gb-md' },
  { name: 'lg', className: 'rounded-gb-lg' },
  { name: 'xl', className: 'rounded-gb-xl' },
  { name: 'full', className: 'rounded-gb-full' },
];

const SPACING = [
  { name: 'xxs', className: 'w-gb-xxs' },
  { name: 'xs', className: 'w-gb-xs' },
  { name: 'sm', className: 'w-gb-sm' },
  { name: 'md', className: 'w-gb-md' },
  { name: 'lg', className: 'w-gb-lg' },
  { name: 'xl', className: 'w-gb-xl' },
  { name: '2xl', className: 'w-gb-2xl' },
  { name: '3xl', className: 'w-gb-3xl' },
  { name: '4xl', className: 'w-gb-4xl' },
  { name: '5xl', className: 'w-gb-5xl' },
  { name: '6xl', className: 'w-gb-6xl' },
  { name: '7xl', className: 'w-gb-7xl' },
  { name: '9xl', className: 'w-gb-9xl' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-gb-6xl border-t border-line pt-gb-3xl">
      <h2 className="mb-gb-xl font-display text-gb-display-xs">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="text-center">
      <div className={`h-16 w-16 rounded-gb-md ${className}`} />
      <span className="mt-gb-xs block text-gb-xs text-fg-muted">{name}</span>
    </div>
  );
}
