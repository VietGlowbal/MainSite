'use client';

import { useEffect, useState } from 'react';
import styles from './strategy-master-preview.module.css';

const REPORTS = [
  {
    eyebrow: 'Applicant Personal Report',
    title: 'Your profile at a glance',
    description: 'Understand the experiences, strengths, motivations and growth areas shaping your application.',
    scores: [
      ['Academic strength', '84'],
      ['Leadership evidence', '72'],
      ['Personal narrative', '79'],
    ],
    note: 'Your strongest evidence combines initiative, sustained commitment and a clear reason for your chosen field.',
    noteLabel: 'Potential signal',
  },
  {
    eyebrow: 'GlowBal Matching Report',
    title: 'How well do you fit?',
    description: 'See how your profile aligns with a selected opportunity and where you can strengthen your fit.',
    scores: [
      ['Academic fit', '88'],
      ['Values alignment', '76'],
      ['Story relevance', '69'],
    ],
    note: 'Your academic trajectory and extracurricular direction support the opportunity. The next step is making that connection visible.',
    noteLabel: 'Where to focus',
  },
] as const;

const SUPPORT_ITEMS = [
  ['01', 'Essay support', 'Story, evidence, structure and application relevance.'],
  ['02', 'CV support', 'Make your experiences and achievements easier to understand.'],
  ['03', 'LOR support', 'Connect recommendations to the wider application story.'],
  ['04', 'Final evaluation', 'Bring every document together before you submit.'],
] as const;

const TESTIMONIALS = [
  ['Essay support · Reflection', '“Instead of only highlighting grammatical mistakes, GlowBal evaluates my writing against the actual admissions criteria of each university I apply to.”', 'Duong Hoang Yen', 'Hanoi'],
  ['Reflection', '“The reflection questions helped me see the bigger picture and develop initial ideas for my essays and application preparation.”', 'Nguyen Hoang Minh Anh', 'Le Quy Don High School · Ho Chi Minh City'],
  ['Applicant Personal Report', '“I was impressed by the profile report because it was very well developed and covered everything I needed.”', 'Nguyen Hoang Bao Minh', 'The Dewey Schools THT · Hanoi'],
  ['CV support', '“It can review my CV and show me what needs to become clearer.”', 'Dinh Thanh Minh', 'Vinschool Ocean Park 1 · Hung Yen'],
] as const;

const PLANS = [
  ['GlowBal Starter', 'Free', 'Start exploring your study-abroad opportunities.'],
  ['GlowBal Yearly Plan', '2.49M VND', 'Build and manage your application journey with GlowBal.'],
  ['GlowBal Yearly Premium', '4.49M VND', 'For students looking for deeper support throughout the journey.'],
] as const;
type PlanName = (typeof PLANS)[number][0];
const DEFAULT_PLAN: PlanName = 'GlowBal Starter';
const ANCHOR_LINKS = [
  ['Reports', 'reports'],
  ['AI feedback', 'feedback'],
  ['Experts', 'experts'],
  ['Pricing', 'pricing'],
] as const;

function isPlanName(value: string): value is PlanName {
  return PLANS.some(([name]) => name === value);
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function StrategyMasterPreview() {
  const [selectedPlan, setSelectedPlan] = useState<PlanName>(DEFAULT_PLAN);
  const [submitted, setSubmitted] = useState(false);
  const [playingExpert, setPlayingExpert] = useState<number | null>(null);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add(styles.visible ?? 'visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add(styles.visible ?? 'visible')),
      { threshold: 0.12 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.page} data-no-auto-translate>
      <nav className={styles.anchorNav} aria-label="Strategy Master sections">
        <span className={styles.anchorLabel}>Strategy Master</span>
        <div className={styles.anchorLinks}>
          {ANCHOR_LINKS.map(([label, id]) => (
            <button key={id} type="button" onClick={() => scrollToSection(id)}>{label}</button>
          ))}
        </div>
        <button type="button" className={styles.anchorCta} onClick={() => scrollToSection('consultation')}>
          Free consultation
        </button>
      </nav>

      <div>
        <section className={`${styles.section} ${styles.hero}`} id="top">
          <div className={`${styles.heroCopy} ${styles.reveal}`} data-reveal>
            <p className={styles.eyebrow}>Strategy Master · GlowBal AI</p>
            <h1>Your AI strategy partner for <span>studying abroad.</span></h1>
            <p className={styles.lead}>
              GlowBal helps you understand your profile, review your application, strengthen your essays, CV and LOR, and receive actionable feedback whenever you need it.
            </p>
            <p className={styles.supportingLead}>
              Built around structured application frameworks, scoring criteria and insights developed with scholarship mentors and education experts.
            </p>
            <div className={styles.buttonRow}>
              <button type="button" className={styles.primaryButton} onClick={() => scrollToSection('reports')}>Explore Strategy Master</button>
              <button type="button" className={styles.secondaryButton} onClick={() => scrollToSection('feedback')}>See GlowBal AI in action</button>
            </div>
          </div>

          <div role="img" className={`${styles.orbit} ${styles.reveal}`} data-reveal aria-label="GlowBal AI connects profile, criteria, evidence, feedback and strategy">
            <div className={styles.orbitRingOne} />
            <div className={styles.orbitRingTwo} />
            <div className={styles.orbitCore}>GlowBal<br />AI</div>
            {['Profile', 'Criteria', 'Evidence', 'Feedback', 'Strategy'].map((label, index) => (
              <span key={label} className={`${styles.orbitNode} ${styles[`orbitNode${index}`]}`}>{label}</span>
            ))}
          </div>
        </section>

        <section className={styles.section} id="reports">
          <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
            <p className={styles.sectionKicker}>Exclusive reports</p>
            <h2>See your application from <span>two perspectives.</span></h2>
            <p className={styles.lead}>From self-understanding to application strategy — backed by structured analysis, not guesswork.</p>
          </div>
          <div className={styles.reportGrid}>
            {REPORTS.map((report) => (
              <article className={`${styles.reportCard} ${styles.reveal}`} data-reveal key={report.eyebrow}>
                <div className={styles.windowBar}>
                  <strong>{report.eyebrow}</strong>
                  <span className={styles.traffic} aria-hidden="true"><i /><i /><i /></span>
                </div>
                <div className={styles.reportBody}>
                  <div className={styles.miniCard}>
                    <small>Illustrative report view</small>
                    <h3>{report.title}</h3>
                    <p>{report.description}</p>
                  </div>
                  {report.scores.map(([label, score]) => (
                    <div className={styles.scoreBlock} key={label}>
                      <div className={styles.scoreLine}><span>{label}</span><strong>{score}</strong></div>
                      <div className={styles.meter} aria-label={`${label}: ${score} out of 100`}><b style={{ width: `${score}%` }} /></div>
                    </div>
                  ))}
                  <div className={styles.miniCard}>
                    <strong>{report.noteLabel}</strong>
                    <p>{report.note}</p>
                  </div>
                  <div className={styles.miniCard}>
                    <strong>Next development step</strong>
                    <p>Turn the strongest signal into clear evidence that an admissions reader can remember.</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.feedbackSection}`} id="feedback">
          <div className={styles.demoGrid}>
            <div className={`${styles.reveal}`} data-reveal>
              <p className={styles.sectionKicker}>Profile support</p>
              <h2>Not just “good” or “bad”. <span>Understand why.</span></h2>
              <p className={styles.lead}>GlowBal reviews your application using structured criteria and turns feedback into clear, actionable next steps.</p>
              <div className={styles.supportList}>
                {SUPPORT_ITEMS.map(([number, title, description]) => (
                  <div className={styles.supportItem} key={number}>
                    <span className={styles.supportNumber}>{number}</span>
                    <span><strong>{title}</strong><small>{description}</small></span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`${styles.demoScreen} ${styles.reveal}`} data-reveal>
              <div className={styles.scanLine} />
              <div className={styles.essayPaper}>
                <strong>Statement of Purpose</strong>
                <p>I first became interested in social impact when I led a student project that <mark>connected volunteers with elderly residents during the pandemic.</mark> The project taught me that technology becomes meaningful when it improves everyday services.</p>
                <p>At university, I want to explore how digital systems can help institutions make better decisions while remaining accountable to the communities they serve.</p>
              </div>
              <div className={styles.feedbackPop}>
                <strong>Criterion: Evidence of impact</strong>
                <p>Strong example, but quantify your role and outcome to make the evidence more convincing.</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="experts">
          <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
            <p className={styles.sectionKicker}>Expert perspective</p>
            <h2>Technology works better with <span>human perspective.</span></h2>
            <p className={styles.lead}>The final word should belong to a person who understands the student, the opportunity and the context.</p>
          </div>
          {[['Admissions perspective', 'Head of Student Admissions · VinUniversity'], ['Mentor perspective', 'Education development · Vietnam Institute for Lifelong Learning']].map(([title, subtitle], index) => (
            <article className={`${styles.expertCard} ${styles.reveal}`} data-reveal key={title}>
              <div className={`${styles.expertPortrait} ${index === 1 ? styles.expertPortraitAlt : ''}`}>
                <small>{subtitle}</small>
                <strong>{title}</strong>
              </div>
              <button type="button" className={styles.videoCard} onClick={() => setPlayingExpert(index)} aria-label={`Play ${title} video`}>
                {playingExpert === index ? <span><strong>Expert video placeholder</strong><small>Replace this block with the final approved video.</small></span> : <span className={styles.playButton}>▶</span>}
              </button>
            </article>
          ))}
        </section>

        <section className={`${styles.section} ${styles.voicesSection}`}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
            <p className={styles.sectionKicker}>Student voices</p>
            <h2>Real students. <span>Real application problems.</span></h2>
          </div>
          <div className={`${styles.testimonials} ${styles.reveal}`} data-reveal aria-label="Student testimonials">
            {TESTIMONIALS.map(([tag, quote, name, school]) => (
              <article className={styles.quoteCard} key={name}>
                <span className={styles.tag}>{tag}</span>
                <blockquote>{quote}</blockquote>
                <strong>{name}</strong><small>{school}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.humanSection}`}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
            <p className={styles.sectionKicker}>AI + human support</p>
            <h2>Don&apos;t trust the machine? <span>You&apos;re not alone.</span></h2>
            <p className={styles.lead}>AI when you need speed. Humans when you need perspective. Whichever GlowBal plan you choose, you are not navigating your application alone.</p>
          </div>
          <div className={styles.mentorGrid}>
            <article className={`${styles.mentorCard} ${styles.reveal}`} data-reveal>
              <div className={styles.initialBadge}>KL</div>
              <h3>Nguyen Khanh Linh</h3>
              <p><strong>Mentor · VinUniversity · University of Birmingham</strong></p>
              <ul><li>80% Merit-based Scholarship — VinUniversity</li><li>4-time Dean&apos;s List Academic Award Recipient</li><li>Represented VinUniversity on exchange at the University of Birmingham</li><li>Advised students receiving major VinUniversity merit scholarships</li></ul>
            </article>
            <article className={`${styles.mentorCard} ${styles.reveal}`} data-reveal>
              <div className={styles.initialBadge}>QC</div>
              <h3>Pham Quynh Chi</h3>
              <p><strong>Supporter · VinUniversity</strong></p>
              <ul><li>100% Merit-based Scholarship — VinUniversity</li><li>100% Scholarship — Fulbright University</li><li>Vice Chancellor Scholarship — RMIT</li><li>Education Development Scholarship — BUV</li><li>Full Scholarship — Lingnan University</li></ul>
            </article>
          </div>
        </section>

        <section className={`${styles.section} ${styles.pricingSection}`} id="pricing">
          <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
            <p className={styles.sectionKicker}>Pricing</p>
            <h2>Choose how you Glow on your <span>study-abroad journey.</span></h2>
            <p className={styles.lead}>Start free, then choose the level of support that fits your application journey.</p>
          </div>
          <div className={styles.pricingGrid}>
            {PLANS.map(([name, price, description], index) => (
              <article className={`${styles.priceCard} ${index === 1 ? styles.featuredPrice : ''} ${styles.reveal}`} data-reveal key={name}>
                <small>{name}</small><strong className={styles.price}>{price}</strong><p>{description}</p>
                <button type="button" className={index === 1 ? styles.primaryDarkButton : styles.darkButton} onClick={() => { setSelectedPlan(name); scrollToSection('consultation'); }}>{index === 0 ? 'Get started' : `Select ${index === 1 ? 'yearly plan' : 'premium'}`}</button>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.consultationSection}`} id="consultation">
          <div className={styles.formGrid}>
            <div className={`${styles.formArt} ${styles.reveal}`} data-reveal>
              <p className={styles.sectionKicker}>Free consultation</p>
              <h2>Not sure where to start?</h2>
              <p>Tell us about your study-abroad goals and our team will help you understand your next steps.</p>
            </div>
            <form className={`${styles.consultForm} ${styles.reveal}`} data-reveal onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
              <h3>Register for a Free Scholarship Consultation</h3>
              <p>Your selected package will be carried into the form automatically.</p>
              <div className={styles.fields}>
                <label>Full name<input required name="name" placeholder="Your name" /></label>
                <label>Date of birth<input required name="birthDate" type="date" /></label>
                <label>Email address<input required name="email" type="email" placeholder="you@email.com" /></label>
                <label>Phone number<input required name="phone" placeholder="+84 ..." /></label>
                <label className={styles.fullField}>Where would you like to study?<input name="institution" placeholder="Institution name / country" /></label>
                <label>Study-abroad budget<select name="budget" defaultValue=""><option value="" disabled>Choose...</option><option>&lt; 300M VND</option><option>300–500M VND</option><option>500–800M VND</option><option>&gt; 800M VND</option></select></label>
                <label>Choose package<select name="package" value={selectedPlan} onChange={(event) => { if (isPlanName(event.target.value)) setSelectedPlan(event.target.value); }}>{PLANS.map(([name]) => <option key={name}>{name}</option>)}</select></label>
              </div>
              <button className={styles.submitButton} type="submit">{submitted ? 'Consultation requested ✓' : 'Request consultation'}</button>
            </form>
          </div>
        </section>
      </div>
      <footer className={styles.previewFooter}><strong>GLOWBAL</strong><small>Strategy Master · Product concept preview</small></footer>
    </div>
  );
}
