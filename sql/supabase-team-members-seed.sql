-- About page team roster — adds the other 11 members of the GlowBal team
-- from the owner-supplied roster ("Organisation_Members | GlowBal.xlsx —
-- Thông tin Thành viên"), alongside the founder already seeded by
-- supabase-team.sql.
--
-- Run in the Supabase SQL Editor after supabase-team.sql. Additive and
-- idempotent: every row is `on conflict (slug) do update`, so re-running
-- this file corrects a typo instead of duplicating a person.
--
-- DOES NOT TOUCH THE FOUNDER (slug 'nguyen-khanh-linh'). She is already
-- seeded by supabase-team.sql with real achievements and a quote that this
-- file has no source data for — re-inserting her here with only the columns
-- this roster provides would null those out on conflict. Slug collision is
-- exactly how `on conflict` finds "the same person" (see docs/known-issues.md
-- §0's "never edit an applied migration in place" — the same caution applies
-- to touching an already-seeded row from a different file).
--
-- WHAT DIDN'T MAKE IT IN, ON PURPOSE:
--   - Date of birth and phone number: present in the source sheet, but this
--     is a public page and neither has a display field in team_members. Real
--     PII with no UI to show it belongs nowhere near a public table.
--   - Facebook profile links and the "Link CV / Thành tích" column: no
--     `facebook_url` or free-text achievement-link column exists on
--     team_members, and adding one is a schema change this task doesn't need
--     — LinkedIn/Instagram/email already cover "how to reach them" (the
--     About page's own subheading). Four rows have a Facebook link; ask if
--     that should become a real column + UI slot rather than being dropped.
--   - Photo files: the sheet's "Link Photo" column is bare filenames
--     ("Nguyễn Khánh Linh.JPG"), not hosted URLs — there is nothing here to
--     put in photo_url. Every row below ships with photo_url = null, which
--     the About page already renders as initials (see about-team.tsx's
--     monogram() fallback) rather than a broken image. Photos need to be
--     uploaded somewhere reachable (Supabase Storage, or a Drive folder
--     shared "anyone with the link" — see normalizeDriveImageUrl in
--     src/lib/team.ts) and this column updated per row afterward.
--   - Achievements (team_achievements rows): the source sheet has no award/
--     scholarship list for these 11, only the founder's. Inventing bullet
--     points to match her card's shape would be fabricated content — their
--     achievements section is simply empty until real ones are supplied.
--
-- short_bio is composed from real columns (year of study, major, university,
-- city) rather than copied verbatim, since the sheet has no bio field —
-- e.g. "Third-year Business Administration student at VinUniversity, based
-- in Hanoi." City has no dedicated column on team_members either, so it
-- lives in this sentence rather than being dropped.

insert into public.team_members (
  full_name, slug, role, short_bio,
  university, degree, major, exchange_university,
  email, display_order, is_featured, is_visible
) values
  (
    'Phùng Thị Hương', 'phung-thi-huong', 'Head of Business Development',
    'Third-year International Political Economy student (career & international development track) at Foreign Trade University, based in Hanoi.',
    'Foreign Trade University', null, 'International Political Economy', null,
    'huongphung2985@gmail.com', 2, false, true
  ),
  (
    'Nguyễn Hoàng Linh', 'nguyen-hoang-linh', 'Co-founder',
    'Third-year Business Administration student at VinUniversity, based in Hanoi.',
    'VinUniversity', null, 'Business Administration', null,
    'hoanglinhn050901@gmail.com', 3, false, true
  ),
  (
    'Chu Tuấn Linh', 'chu-tuan-linh', 'Head of Technology',
    'Third-year Information Technology student at Hanoi University of Science and Technology, based in Thanh Hoa.',
    'Hanoi University of Science and Technology', null, 'Information Technology', null,
    'tlinh030805@gmail.com', 4, false, true
  ),
  (
    'James David Lapslie', 'james-david-lapslie', 'Back-end',
    'Third-year Computer Engineering student at the University of Birmingham, based in Birmingham, UK.',
    'University of Birmingham', null, 'Computer Engineering', null,
    'james@lapslie.com', 5, false, true
  ),
  (
    'Phạm Quỳnh Chi', 'pham-quynh-chi', 'Marketing',
    'Incoming first-year Business Administration student at VinUniversity, based in Hai Duong.',
    'VinUniversity', null, 'Business Administration', null,
    'chiquynhpham2008@gmail.com', 6, false, true
  ),
  (
    'Phùng Hoàng Hà Anh', 'phung-hoang-ha-anh', 'Marketing',
    'Second-year student at Fulbright University Vietnam, based in Ho Chi Minh City.',
    'Fulbright University Vietnam', null, null, null,
    'cathphung1003@gmail.com', 7, false, true
  ),
  (
    'Nguyễn Trần Hồng Liên', 'nguyen-tran-hong-lien', 'Front-end & System',
    'Second-year student at Fulbright University Vietnam, based in Ho Chi Minh City.',
    'Fulbright University Vietnam', null, null, null,
    'honglien0607@gmail.com', 8, false, true
  ),
  (
    'Tạ Đức Hiển', 'ta-duc-hien', 'Back-end',
    'Third-year Computer Engineering student at Hanoi University of Science and Technology, based in Hai Phong.',
    'Hanoi University of Science and Technology', null, 'Computer Engineering', null,
    'taduchien314@gmail.com', 9, false, true
  ),
  (
    'Nguyễn Tuấn Kiên', 'nguyen-tuan-kien', 'Finance',
    'Third-year Banking and Finance student at the Academy of Finance, based in Bac Ninh.',
    'Academy of Finance', null, 'Banking and Finance', null,
    'ntk250406thcsttt@gmail.com', 10, false, true
  ),
  (
    'Nguyễn Văn Huấn', 'nguyen-van-huan', 'Back-end',
    'Third-year Computer Engineering student at Hanoi University of Science and Technology, based in Hanoi.',
    'Hanoi University of Science and Technology', null, 'Computer Engineering', null,
    'huan.elenoa@gmail.com', 11, false, true
  ),
  (
    'Lý Giai Mẫn', 'ly-giai-man', 'Head of Research and Development',
    'Second-year Economics student at Fulbright University Vietnam, based in Ho Chi Minh City.',
    'Fulbright University Vietnam', null, 'Economics', null,
    'giaimanly@gmail.com', 12, false, true
  )
on conflict (slug) do update set
  full_name  = excluded.full_name,
  role       = excluded.role,
  short_bio  = excluded.short_bio,
  university = excluded.university,
  degree     = excluded.degree,
  major      = excluded.major,
  email      = excluded.email,
  display_order = excluded.display_order,
  is_visible = excluded.is_visible;
