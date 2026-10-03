import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
const load = createRequire(import.meta.url);
const React = load('next/dist/compiled/react/react.react-server');
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  return name === 'react' ? React : originalLoad.call(this, name, ...args);
};
load('tsx/cjs');
const { renderToReadableStream } = load('next/dist/compiled/react-server-dom-webpack/server.edge');
const { fetchOnboardingState } = load('../../features/ai-strategy-dashboard/api/onboarding-status.ts');
let reads = 0;
let matchingReady = true;
const client = { from(table) {
  const data = {
    course_applications: { candidate_confirmed_at: 'yes' },
    student_personal_report_versions: { id: 'report', confirmed_snapshot_id: 'snapshot' },
    confirmed_candidate_snapshots: { id: 'snapshot' },
    application_match_analyses: matchingReady ? { id: 'match' } : null,
    application_strategy_recommendations: null,
  }[table];
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
    async maybeSingle() { reads++; return { data, error: null }; },
  };
  return query;
} };
async function request(user, app, otherUser = user, otherApp = app) {
  let ready;
  async function View() {
    const results = await Promise.all([
      fetchOnboardingState(client, user, app), fetchOnboardingState(client, otherUser, otherApp),
    ]);
    ready = results[0].aiAnalysisComplete;
    return 'ok';
  }
  await new Response(await renderToReadableStream(React.createElement(View), {})).text();
  return ready;
}
(async () => {
  const readyFirst = await request('user', 'app');
  const firstReads = reads;
  matchingReady = false;
  const readyNext = await request('user', 'app');
  const secondReads = reads-firstReads;
  const beforeApps = reads;
  await request('user', 'app', 'user', 'other-app');
  const separateAppReads = reads-beforeApps;
  const beforeUsers = reads;
  await request('user', 'app', 'other-user', 'app');
  const separateUserReads = reads-beforeUsers;
  console.log(JSON.stringify({ firstRequestReads: firstReads, secondRequestReads: secondReads, separateAppReads, separateUserReads, readyFirst, readyNext }));
  if (process.argv.includes('--assert')) {
    assert.equal(firstReads, 5);
    assert.equal(secondReads, 5);
    assert.equal(separateAppReads, 10);
    assert.equal(separateUserReads, 10);
    assert.equal(readyFirst, true);
    assert.equal(readyNext, false);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
