import Image from 'next/image';
import type { TeamMember } from '@/lib/team';
import { Button, Section } from '@/shared/ui';

export function HomeTeam({ members = [] }: { members?: readonly TeamMember[] }) {
  const featured = members.filter((member) => member.photo_url).slice(0, 4);

  return (
    <Section
      padded={false}
      className="py-gb-9xl"
      containerClassName="flex flex-col gap-gb-7xl"
    >
      <div className="grid items-center gap-gb-7xl lg:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-gb-xl bg-surface-muted">
          <Image
            src="/home-contact-team.jpg"
            alt="The GlowBal team"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            quality={90}
            className="object-cover"
          />
        </div>

        <div>
          <p className="text-gb-md font-semibold text-brand">Our team</p>
          <h2 className="mt-gb-lg font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg md:text-gb-display-md">
            The team behind your journey.
          </h2>
          <p className="mt-gb-2xl text-gb-md leading-relaxed text-fg-tertiary md:text-gb-lg">
            GlowBal is built by a team across technology, education, research and communication,
            including people who have experienced scholarship and study-abroad journeys themselves.
            We combine student insight, specialist knowledge and technology to turn fragmented
            advice into a clearer system.
          </p>
          <Button href="/about" size="xl" className="mt-gb-4xl">
            Meet the GlowBal team
          </Button>
        </div>
      </div>

      {featured.length > 0 ? (
        <div className="grid grid-cols-2 gap-gb-xl md:grid-cols-4">
          {featured.map((member) => (
            <article key={member.id} className="group">
              <div className="relative aspect-[4/5] overflow-hidden rounded-gb-xl bg-surface-muted">
                <Image
                  src={member.photo_url!}
                  alt={member.full_name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 data-no-auto-translate className="mt-gb-lg text-gb-md font-semibold text-fg">
                {member.full_name}
              </h3>
              <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{member.role}</p>
            </article>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
