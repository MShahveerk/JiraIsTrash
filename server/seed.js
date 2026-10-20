import crypto from 'node:crypto';
import { initDb, query, queryOne, withTx, closeDb } from './db.js';
import { ensureSchema } from './schema.js';

const uuid = () => crypto.randomUUID();
const now = new Date();
const isoDaysAgo = (days, hours = 10) => {
  const date = new Date(now.getTime() - days * 86400000);
  date.setUTCHours(hours, 0, 0, 0);
  return date.toISOString();
};
const MEMBERS = [
  { name: 'Alex Rivera', email: 'alex@nova.dev', role: 'Engineering lead', color: '#0052cc' },
  { name: 'Priya Shah', email: 'priya@nova.dev', role: 'Product designer', color: '#6554c0' },
  { name: 'Marcus Chen', email: 'marcus@nova.dev', role: 'Backend engineer', color: '#00875a' },
  { name: 'Sofia Lindqvist', email: 'sofia@nova.dev', role: 'Frontend engineer', color: '#ff8b00' },
  { name: 'Jamal Wright', email: 'jamal@nova.dev', role: 'QA engineer', color: '#00a3bf' },
  { name: 'Nina Kovač', email: 'nina@nova.dev', role: 'Full-stack engineer', color: '#de350b' },
];

const SPRINTS = [
  { key: 's21', name: 'Sprint 21', start: -48, end: -35, state: 'closed', committed: 32, goal: 'Ship confident exports and stabilise onboarding.' },
  { key: 's22', name: 'Sprint 22', start: -34, end: -21, state: 'closed', committed: 38, goal: 'Billing previews and a faster workspace switcher.' },
  { key: 's23', name: 'Sprint 23', start: -20, end: -7, state: 'closed', committed: 37, goal: 'Give people saved views and make bulk admin safe.' },
  { key: 's24', name: 'Sprint 24', start: -6, end: 7, state: 'active', committed: 42, goal: 'Reliable billing comms and a board that feels instant.' },
  { key: 's25', name: 'Sprint 25', start: 8, end: 21, state: 'future', committed: 0, goal: 'Planning: make reporting and bulk editing self-serve.' },
];

const ISSUES = [
  /* Sprint 21 */
  { sprint: 's21', title: 'Onboarding checklist drops progress on refresh', type: 'bug', status: 'done', priority: 'high', assignee: 3, reporter: 0, points: 3, labels: ['onboarding'], resolved: -36, createdAt: -55, epic: null },
  { sprint: 's21', title: 'Add CSV export to the customer list', type: 'story', status: 'done', priority: 'medium', assignee: 2, reporter: 0, points: 5, labels: ['frontend'], resolved: -37, createdAt: -60, epic: null },
  { sprint: 's21', title: 'Empty states for the reports page', type: 'task', status: 'done', priority: 'low', assignee: 1, reporter: 1, points: 2, labels: ['design'], resolved: -38, createdAt: -58, epic: null },
  { sprint: 's21', title: 'Rate-limit the password reset endpoint', type: 'task', status: 'done', priority: 'highest', assignee: 4, reporter: 0, points: 5, labels: ['security', 'api'], resolved: -39, createdAt: -61, epic: null },
  { sprint: 's21', title: 'Search: debounce and cancel stale queries', type: 'story', status: 'done', priority: 'high', assignee: 5, reporter: 2, points: 8, labels: ['search', 'performance'], resolved: -36, createdAt: -57, epic: null },
  { sprint: 's21', title: 'Fix avatar cropping in the activity feed', type: 'bug', status: 'done', priority: 'low', assignee: 3, reporter: 1, points: 3, labels: ['frontend'], resolved: -40, createdAt: -62, epic: null },
  { sprint: 's21', title: 'Upgrade Postgres driver and test connection pooling', type: 'task', status: 'done', priority: 'medium', assignee: 2, reporter: 0, points: 2, labels: ['infra'], resolved: -37, createdAt: -63, epic: null },

  /* Sprint 22 */
  { sprint: 's22', title: 'Billing: proration preview before plan change', type: 'story', status: 'done', priority: 'highest', assignee: 2, reporter: 2, points: 5, labels: ['billing'], resolved: -23, createdAt: -41, epic: 0 },
  { sprint: 's22', title: 'Add keyboard navigation to the issue table', type: 'story', status: 'done', priority: 'medium', assignee: 3, reporter: 1, points: 3, labels: ['frontend', 'a11y'], resolved: -24, createdAt: -42, epic: null },
  { sprint: 's22', title: 'Missing translations in the invite flow', type: 'bug', status: 'done', priority: 'medium', assignee: 1, reporter: 4, points: 2, labels: ['bug'], resolved: -25, createdAt: -40, epic: null },
  { sprint: 's22', title: 'Workspace switcher virtualisation', type: 'story', status: 'done', priority: 'high', assignee: 5, reporter: 0, points: 8, labels: ['performance'], resolved: -22, createdAt: -44, epic: null },
  { sprint: 's22', title: 'Normalise audit log timestamps to UTC', type: 'task', status: 'done', priority: 'low', assignee: 2, reporter: 0, points: 2, labels: ['api'], resolved: -26, createdAt: -43, epic: null },
  { sprint: 's22', title: 'Fix focus ring contrast on the dark theme', type: 'bug', status: 'done', priority: 'medium', assignee: 1, reporter: 3, points: 3, labels: ['a11y', 'design'], resolved: -24, createdAt: -39, epic: null },
  { sprint: 's22', title: 'Webhook retries with exponential backoff', type: 'story', status: 'done', priority: 'high', assignee: 2, reporter: 0, points: 5, labels: ['api', 'infra'], resolved: -23, createdAt: -45, epic: null },
  { sprint: 's22', title: 'Document the import API', type: 'task', status: 'done', priority: 'low', assignee: 4, reporter: 4, points: 2, labels: ['docs'], resolved: -27, createdAt: -42, epic: null },
  { sprint: 's22', title: 'Reduce layout shift on the dashboard', type: 'task', status: 'done', priority: 'medium', assignee: 3, reporter: 0, points: 3, labels: ['performance', 'frontend'], resolved: -22, createdAt: -41, epic: null },

  /* Sprint 23 */
  { sprint: 's23', title: 'Sprint board: drag between columns', type: 'story', status: 'done', priority: 'highest', assignee: 3, reporter: 0, points: 5, labels: ['frontend'], resolved: -9, createdAt: -30, epic: null },
  { sprint: 's23', title: 'Report export fails for workspaces over 10k rows', type: 'bug', status: 'done', priority: 'highest', assignee: 2, reporter: 4, points: 3, labels: ['reporting', 'bug'], resolved: -11, createdAt: -31, epic: 1, description: 'Large exports time out after 30 seconds. We should stream the CSV instead of building it in memory.' },
  { sprint: 's23', title: 'Invite expiry banner', type: 'task', status: 'done', priority: 'low', assignee: 1, reporter: 1, points: 2, labels: ['design'], resolved: -10, createdAt: -29, epic: null },
  { sprint: 's23', title: 'Saved views for filters', type: 'story', status: 'done', priority: 'high', assignee: 5, reporter: 1, points: 8, labels: ['frontend'], resolved: -8, createdAt: -32, epic: null },
  { sprint: 's23', title: 'Audit log filter by actor', type: 'story', status: 'done', priority: 'medium', assignee: 2, reporter: 0, points: 3, labels: ['api'], resolved: -12, createdAt: -33, epic: 2 },
  { sprint: 's23', title: 'Batch member deactivation', type: 'story', status: 'done', priority: 'high', assignee: 4, reporter: 0, points: 5, labels: ['admin'], resolved: -9, createdAt: -30, epic: 2 },
  { sprint: 's23', title: 'Cache project permissions per request', type: 'task', status: 'done', priority: 'medium', assignee: 2, reporter: 0, points: 2, labels: ['performance', 'api'], resolved: -13, createdAt: -28, epic: null },
  { sprint: 's23', title: 'A11y: announce toast messages', type: 'task', status: 'done', priority: 'medium', assignee: 1, reporter: 3, points: 5, labels: ['a11y'], resolved: -8, createdAt: -27, epic: null },

  /* Sprint 24 — active */
  { sprint: 's24', title: 'Search: highlight matching terms', type: 'story', status: 'done', priority: 'medium', assignee: 3, reporter: 2, points: 3, labels: ['search', 'frontend'], resolved: -5, createdAt: -14, epic: null, description: 'Highlight matches in titles and snippets, and keep the surrounding text readable when a term appears near the end.' },
  { sprint: 's24', title: 'Fix duplicate invoice line items', type: 'bug', status: 'done', priority: 'highest', assignee: 2, reporter: 4, points: 2, labels: ['billing', 'bug'], resolved: -4, createdAt: -12, epic: 0, description: 'Retrying a failed invoice run can duplicate usage lines. Add a unique constraint on invoice_id + source_id and make the job idempotent.' },
  { sprint: 's24', title: 'Onboarding email sequence triggers twice', type: 'bug', status: 'done', priority: 'high', assignee: 4, reporter: 1, points: 3, labels: ['onboarding'], resolved: -2, createdAt: -11, epic: null },
  { sprint: 's24', title: 'Add sprint velocity chart', type: 'story', status: 'done', priority: 'medium', assignee: 5, reporter: 0, points: 5, labels: ['reporting', 'frontend'], resolved: -1, createdAt: -10, epic: 1 },
  { sprint: 's24', title: 'Billing: dunning emails for failed payments', type: 'story', status: 'in_progress', priority: 'highest', assignee: 2, reporter: 0, points: 5, labels: ['billing'], resolved: null, createdAt: -9, epic: 0, description: 'Three reminders over ten days, with a payment update link in each. Copy is approved; we still need to decide what happens when a workspace has no billing admin.' },
  { sprint: 's24', title: 'Board filters persist per user', type: 'story', status: 'in_review', priority: 'medium', assignee: 3, reporter: 0, points: 3, labels: ['frontend'], resolved: null, createdAt: -8, epic: null, description: 'Remember the selected assignee, type and text filters between visits. Keep it scoped to the browser until member profiles ship.' },
  { sprint: 's24', title: 'Sprint goal banner on the board', type: 'task', status: 'todo', priority: 'low', assignee: 1, reporter: 1, points: 2, labels: ['design', 'frontend'], resolved: null, createdAt: -7, epic: null },
  { sprint: 's24', title: 'Reports: cumulative flow diagram', type: 'story', status: 'in_progress', priority: 'high', assignee: 5, reporter: 0, points: 8, labels: ['reporting'], resolved: null, createdAt: -6, epic: 1, description: 'Stacked area chart of issues per status over the sprint. First pass can use daily snapshots; note on the chart that history starts when snapshots begin.' },
  { sprint: 's24', title: 'Limit comment length and sanitise markdown', type: 'task', status: 'in_review', priority: 'high', assignee: 2, reporter: 4, points: 2, labels: ['security', 'api'], resolved: null, createdAt: -5, epic: null },
  { sprint: 's24', title: 'Mobile layout for backlog rows', type: 'task', status: 'todo', priority: 'medium', assignee: 1, reporter: 3, points: 5, labels: ['frontend', 'design'], resolved: null, createdAt: -4, epic: null },

  /* Sprint 25 — future */
  { sprint: 's25', title: 'Team workload report', type: 'story', status: 'todo', priority: 'high', assignee: 5, reporter: 0, points: 5, labels: ['reporting'], resolved: null, createdAt: -3, epic: 1 },
  { sprint: 's25', title: 'Bulk edit issues', type: 'story', status: 'todo', priority: 'high', assignee: 3, reporter: 0, points: 8, labels: ['frontend'], resolved: null, createdAt: -3, epic: null },
  { sprint: 's25', title: 'Sprint retro notes', type: 'task', status: 'todo', priority: 'low', assignee: 1, reporter: 1, points: 3, labels: ['design'], resolved: null, createdAt: -2, epic: null },
  { sprint: 's25', title: 'Issue templates per project', type: 'story', status: 'todo', priority: 'medium', assignee: 2, reporter: 0, points: 5, labels: ['api'], resolved: null, createdAt: -2, epic: null },
  { sprint: 's25', title: 'SLA badges on bugs', type: 'task', status: 'todo', priority: 'medium', assignee: 4, reporter: 4, points: 2, labels: ['frontend'], resolved: null, createdAt: -1, epic: null },
  { sprint: 's25', title: 'Export sprint report as PDF', type: 'story', status: 'todo', priority: 'low', assignee: 5, reporter: 1, points: 5, labels: ['reporting'], resolved: null, createdAt: -1, epic: 1 },

  /* Backlog (epics first) */
  { sprint: null, title: 'Billing 2.0', type: 'epic', status: 'todo', priority: 'high', assignee: 2, reporter: 0, points: null, labels: ['billing'], resolved: null, createdAt: -70, epic: null, description: 'Pricing, invoices and payment recovery for self-serve plans.' },
  { sprint: null, title: 'Reporting overhaul', type: 'epic', status: 'todo', priority: 'high', assignee: 5, reporter: 0, points: null, labels: ['reporting'], resolved: null, createdAt: -68, epic: null, description: 'Fast, schedulable reports that survive large workspaces.' },
  { sprint: null, title: 'Workspace administration', type: 'epic', status: 'todo', priority: 'medium', assignee: 4, reporter: 0, points: null, labels: ['admin'], resolved: null, createdAt: -66, epic: null, description: 'Role templates, bulk provisioning and audit controls.' },
  { sprint: null, title: 'Usage-based pricing calculator', type: 'story', status: 'todo', priority: 'high', assignee: 2, reporter: 0, points: 8, labels: ['billing'], resolved: null, createdAt: -25, epic: 0 },
  { sprint: null, title: 'Invoice PDF branding', type: 'task', status: 'todo', priority: 'medium', assignee: 1, reporter: 1, points: 3, labels: ['billing', 'design'], resolved: null, createdAt: -24, epic: 0 },
  { sprint: null, title: 'Dunning email localisation', type: 'task', status: 'todo', priority: 'low', assignee: 2, reporter: 1, points: 5, labels: ['billing'], resolved: null, createdAt: -23, epic: 0 },
  { sprint: null, title: 'Self-serve plan downgrade', type: 'story', status: 'todo', priority: 'high', assignee: 5, reporter: 0, points: 8, labels: ['billing'], resolved: null, createdAt: -22, epic: 0 },
  { sprint: null, title: 'Report scheduling via email', type: 'story', status: 'todo', priority: 'high', assignee: 2, reporter: 1, points: 5, labels: ['reporting'], resolved: null, createdAt: -20, epic: 1 },
  { sprint: null, title: 'Saved report snapshots', type: 'story', status: 'todo', priority: 'medium', assignee: 5, reporter: 1, points: 8, labels: ['reporting'], resolved: null, createdAt: -19, epic: 1 },
  { sprint: null, title: 'Cumulative flow export', type: 'task', status: 'todo', priority: 'low', assignee: 3, reporter: 0, points: 2, labels: ['reporting', 'frontend'], resolved: null, createdAt: -18, epic: 1 },
  { sprint: null, title: 'Role templates for new workspaces', type: 'story', status: 'todo', priority: 'medium', assignee: 4, reporter: 0, points: 5, labels: ['admin'], resolved: null, createdAt: -17, epic: 2 },
  { sprint: null, title: 'Bulk user provisioning from CSV', type: 'story', status: 'todo', priority: 'medium', assignee: 2, reporter: 0, points: 8, labels: ['admin'], resolved: null, createdAt: -16, epic: 2 },
  { sprint: null, title: 'Audit log retention policy', type: 'task', status: 'todo', priority: 'low', assignee: 4, reporter: 0, points: 3, labels: ['admin'], resolved: null, createdAt: -15, epic: 2 },
  { sprint: null, title: 'Usage alerts for admins', type: 'story', status: 'todo', priority: 'medium', assignee: 3, reporter: 1, points: 5, labels: ['admin'], resolved: null, createdAt: -14, epic: 2 },
  { sprint: null, title: 'Search across archived projects', type: 'story', status: 'todo', priority: 'low', assignee: 3, reporter: 2, points: 3, labels: ['search'], resolved: null, createdAt: -13, epic: null },
  { sprint: null, title: 'Fix stale badge counts after bulk actions', type: 'bug', status: 'todo', priority: 'medium', assignee: 3, reporter: 4, points: 2, labels: ['bug', 'frontend'], resolved: null, createdAt: -12, epic: null },
  { sprint: null, title: 'Improve empty search results', type: 'task', status: 'todo', priority: 'low', assignee: 1, reporter: 2, points: 2, labels: ['design'], resolved: null, createdAt: -11, epic: null },
  { sprint: null, title: 'Dark theme for embedded reports', type: 'task', status: 'todo', priority: 'low', assignee: 5, reporter: 1, points: 3, labels: ['design', 'reporting'], resolved: null, createdAt: -10, epic: 1 },
];

const COMMENTS = [
  { issue: 28, author: 2, days: -2, body: 'Stripe sandbox only retries on the first attempt, so testing day 3 and day 7 reminders needs the clock override. I have it wired locally.' },
  { issue: 28, author: 1, days: -1, body: 'I can add a preview screen with the three email templates if that makes QA easier.' },
  { issue: 29, author: 3, days: -1, body: 'Persisting filters in localStorage for now. We should move this to the member record once sign-in lands.' },
  { issue: 30, author: 1, days: 0, body: 'Copy draft: "Ship reliable billing comms and make the board feel fast." Shout if you want it shorter.' },
  { issue: 31, author: 5, days: -1, body: 'First pass reads daily snapshots, so sprints older than the snapshot job will render empty. Adding a note on the chart.' },
  { issue: 24, author: 4, days: -5, body: 'Verified on staging with 200k documents. p95 stayed under 120ms with highlighting on.' },
  { issue: 47, author: 1, days: -6, body: 'Requested by two design partners, both scheduling weekly spend reports for finance.' },
];

const ACTIVITY = [
  { issue: 30, actor: 1, days: -2, field: 'assigneeId', from: null, toMember: 1 },
  { issue: 28, actor: 0, days: -3, field: 'priority', from: 'high', to: 'highest' },
  { issue: 31, actor: 5, days: -4, field: 'storyPoints', from: null, to: '8' },
  { issue: 24, actor: 2, days: -5, field: 'labels', from: null, to: 'search,frontend' },
];

async function insertDemo() {
  const memberIds = MEMBERS.map(() => uuid());
  const sprintIds = Object.fromEntries(SPRINTS.map((sprint) => [sprint.key, uuid()]));
  const projectId = uuid();
  let nextNumber = 1;
  const issueIds = [];
  const ranks = {};

  await withTx(async () => {
    for (let index = 0; index < MEMBERS.length; index += 1) {
      const member = MEMBERS[index];
      await query(
        `insert into members (id, name, email, role, color, created_at) values ($1,$2,$3,$4,$5,$6)`,
        [memberIds[index], member.name, member.email, member.role, member.color, isoDaysAgo(90)],
      );
    }

    await query(
      `insert into projects (id, key, name, description, next_issue_number, created_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        projectId,
        'NOVA',
        'Nova Platform',
        'Customer workspace, billing and reporting platform.',
        1,
        isoDaysAgo(95),
      ],
    );

    for (const sprint of SPRINTS) {
      await query(
        `insert into sprints (id, project_id, name, goal, state, start_date, end_date, committed_points,
            started_at, completed_at, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          sprintIds[sprint.key],
          projectId,
          sprint.name,
          sprint.goal,
          sprint.state,
          isoDaysAgo(-sprint.start).slice(0, 10),
          isoDaysAgo(-sprint.end).slice(0, 10),
          sprint.committed,
          sprint.state === 'future' ? null : isoDaysAgo(-sprint.start),
          sprint.state === 'closed' ? isoDaysAgo(-sprint.end) : null,
          isoDaysAgo(70),
        ],
      );
    }

    const ids = ISSUES.map(() => uuid());
    const keys = ISSUES.map((_, index) => `NOVA-${index + 1}`);
    const epicIds = ISSUES.map((issue, index) => (issue.type === 'epic' ? ids[index] : null));
    ids.forEach((id) => issueIds.push(id));
    nextNumber = ISSUES.length + 1;

    const order = [
      ...ISSUES.map((_, index) => index).filter((index) => ISSUES[index].type === 'epic'),
      ...ISSUES.map((_, index) => index).filter((index) => ISSUES[index].type !== 'epic'),
    ];

    for (const index of order) {
      const issue = ISSUES[index];
      const id = ids[index];
      const key = keys[index];
      const scope = issue.sprint || 'backlog';
      ranks[scope] = (ranks[scope] || 0) + 1000;
      const epicId = issue.epic != null ? epicIds[issue.epic] : null;
      const resolvedAt = issue.resolved != null ? isoDaysAgo(-issue.resolved) : null;
      await query(
        `insert into issues (id, key, project_id, type, summary, description, status, priority,
            assignee_id, reporter_id, sprint_id, epic_id, story_points, labels, rank,
            created_at, updated_at, resolved_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          id,
          key,
          projectId,
          issue.type,
          issue.title,
          issue.description || '',
          issue.status,
          issue.priority,
          memberIds[issue.assignee],
          memberIds[issue.reporter],
          issue.sprint ? sprintIds[issue.sprint] : null,
          epicId,
          issue.points,
          issue.labels,
          ranks[scope],
          isoDaysAgo(-issue.createdAt),
          resolvedAt || isoDaysAgo(Math.max(0, -issue.createdAt - 1)),
          resolvedAt,
        ],
      );

      await query(
        `insert into activity (id, issue_id, actor_id, field, from_value, to_value, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(), id, memberIds[issue.reporter], 'created', null, issue.title, isoDaysAgo(-issue.createdAt)],
      );
      if (issue.status !== 'todo') {
        const inProgressAt = isoDaysAgo(Math.max(-issue.createdAt - 1, 1));
        await query(
          `insert into activity (id, issue_id, actor_id, field, from_value, to_value, created_at)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [uuid(), id, memberIds[issue.assignee], 'status', 'todo', 'in_progress', inProgressAt],
        );
        if (issue.status === 'done' && resolvedAt) {
          await query(
            `insert into activity (id, issue_id, actor_id, field, from_value, to_value, created_at)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [uuid(), id, memberIds[issue.assignee], 'status', 'in_progress', 'done', resolvedAt],
          );
        } else if (issue.status === 'in_review') {
          await query(
            `insert into activity (id, issue_id, actor_id, field, from_value, to_value, created_at)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [uuid(), id, memberIds[issue.assignee], 'status', 'in_progress', 'in_review', isoDaysAgo(1)],
          );
        }
      }

      if (issue.sprint && issue.sprint !== 's25') {
        await query(
          `insert into sprint_scope (sprint_id, issue_id, points) values ($1,$2,$3)
           on conflict (sprint_id, issue_id) do nothing`,
          [sprintIds[issue.sprint], id, issue.points || 0],
        );
      }
    }

    await query('update projects set next_issue_number = $1 where id = $2', [nextNumber, projectId]);

    for (const comment of COMMENTS) {
      await query(
        `insert into comments (id, issue_id, author_id, body, created_at) values ($1,$2,$3,$4,$5)`,
        [uuid(), issueIds[comment.issue], memberIds[comment.author], comment.body, isoDaysAgo(-comment.days)],
      );
    }

    for (const entry of ACTIVITY) {
      const to = entry.toMember != null ? memberIds[entry.toMember] : entry.to;
      await query(
        `insert into activity (id, issue_id, actor_id, field, from_value, to_value, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(), issueIds[entry.issue], memberIds[entry.actor], entry.field, entry.from, to, isoDaysAgo(-entry.days)],
      );
    }
  });
}

export async function seedIfEmpty() {
  const row = await queryOne('select count(*)::int as count from projects');
  if (Number(row.count) > 0) return false;
  await insertDemo();
  return true;
}

export async function resetDemo() {
  await withTx(async () => {
    await query('delete from activity');
    await query('delete from comments');
    await query('delete from sprint_scope');
    await query('delete from issues');
    await query('delete from sprints');
    await query('delete from projects');
    await query('delete from members');
  });
  await insertDemo();
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isDirectRun) {
  const reset = process.argv.includes('--reset');
  initDb()
    .then(async (database) => {
      await ensureSchema(database);
      if (reset) {
        await resetDemo();
        console.log('[seed] reset and re-seeded demo workspace');
      } else {
        const seeded = await seedIfEmpty();
        console.log(seeded ? '[seed] demo workspace created' : '[seed] database already has data, nothing to do');
      }
      await closeDb();
    })
    .catch((error) => {
      console.error('[seed] failed', error);
      process.exit(1);
    });
}
