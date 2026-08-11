import Image from 'next/image';
import { Button, Section } from '@/shared/ui';

const HOME_TEAM = [
  {
    name: 'Khánh Linh',
    role: 'Founder & CEO',
    bio: 'Life swept away my innocence and threw me into towering ambitions.',
    image: '/home/team/khanh-linh.png',
  },
  {
    name: 'Hoàng Linh',
    role: 'CO - Founder',
    bio: 'I grew through hardship. I rose from the ashes.',
    image: '/home/team/hoang-linh.png',
  },
  {
    name: 'Chu Tuấn Linh',
    role: 'Jack of all trades',
    bio: 'Faith is an expensive luxury, and money is truly spellbinding.',
    image: '/home/team/chu-tuan-linh.png',
  },
  {
    name: 'Lil Chi',
    role: 'UX Research',
    bio: "Children who understand too much rarely get sweets; they drink matcha lattes and eat spicy noodles because they are used to life's bitterness.",
    image: '/home/team/lil-chi.png',
  },
  {
    name: 'Huấn Rose',
    role: 'Backend Developer',
    bio: 'At the feast between angels and demons, I am the only one invited.',
    image: '/home/team/huan-rose.png',
  },
  {
    name: 'Tạ Đức Hiển',
    role: 'Product Designer',
    bio: 'Heaven has not treated me badly. If no one hires me as a developer, I will become a ride-hailing driver.',
    image: '/home/team/ta-duc-hien.png',
  },
  {
    name: 'Hương',
    role: 'UX Researcher',
    bio: 'Some nights I wish I could go back in life. Not to change sh**, but to feel a couple things twice.',
    image: '/home/team/huong.png',
  },
  {
    name: 'James',
    role: 'Product Manager',
    bio: 'Anyone here ever made a mistake? Raise your hand to receive a second chance.',
    image: '/home/team/james.png',
  },
] as const;

/** Home team roster — Figma 903:10609, using its committed portrait exports. */
export function HomeTeam() {
  return (
    <Section
      padded={false}
      className="py-gb-6xl"
      containerClassName="flex flex-col gap-gb-6xl"
    >
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-gb-2xl text-center">
        <h2 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-brand md:text-gb-display-md">
          The team behind your journey.
        </h2>
        <p className="text-gb-md leading-relaxed text-fg-tertiary md:text-gb-xl">
          GlowBal is built by a team across technology, education, research and communication,
          including people who have experienced scholarship and study-abroad journeys themselves.
          We combine student insight, specialist knowledge and technology to turn fragmented
          advice into a clearer system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-gb-4xl gap-y-gb-6xl sm:grid-cols-2 lg:grid-cols-4">
        {HOME_TEAM.map((member) => (
          <article key={member.name}>
            <div className="relative aspect-square overflow-hidden bg-surface-muted">
              <Image
                src={member.image}
                alt={member.name}
                fill
                sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 96px) / 2), 280px"
                className="object-cover"
              />
            </div>
            <div className="mt-gb-xl">
              <h3 data-no-auto-translate className="text-gb-lg font-semibold text-fg">
                {member.name}
              </h3>
              <p className="text-gb-md text-brand">{member.role}</p>
              <p className="mt-gb-md text-gb-md leading-relaxed text-fg-tertiary">{member.bio}</p>
            </div>
          </article>
        ))}
      </div>

      <Button href="/about" size="xl" className="self-center">
        Meet the GlowBal team
      </Button>
    </Section>
  );
}
