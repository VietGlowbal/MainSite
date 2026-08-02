-- About page team roster — remove the duplicate James Lapslie row that
-- supabase-team-members-seed.sql created.
--
-- WHAT HAPPENED. `team_members` already contained a row for this person
-- under slug `james-lapslie` ("James Lapslie", role "Lead Technical
-- Developer", with a photo). The seed file matched the owner's roster
-- spreadsheet instead, which spells the name "James David Lapslie" — so its
-- `on conflict (slug) do update` found no conflict and INSERTED a second row
-- under `james-david-lapslie` rather than updating the existing person.
-- Both now render, as two separate people.
--
-- WHICH ONE SURVIVES, AND WHY. The pre-existing `james-lapslie` row is kept:
-- it has a `photo_url` (the seeded row has none, because the spreadsheet's
-- "Link Photo" column holds bare filenames rather than hosted URLs), and its
-- role — "Lead Technical Developer" — is the more descriptive of the two.
-- The seeded duplicate is the row this pack introduced, so removing it is
-- undoing our own mistake rather than discarding anything the owner entered.
--
-- ⚠️ If the intent was the opposite — keep the spreadsheet's spelling and
-- "Back-end" role — do NOT run this file. Instead update the surviving row
-- in place and delete the other one, so whichever row you keep is the one
-- carrying the photo.
--
-- Safe to re-run: deleting an already-deleted slug is a no-op. The
-- `on delete cascade` on team_achievements clears any attached rows with it
-- (the seeded row has none — the spreadsheet lists no achievements).

delete from public.team_members
where slug = 'james-david-lapslie';
