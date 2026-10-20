import crypto from 'node:crypto';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { initDb, query, queryOne, withTx, db } from './db.js';
import { ensureSchema } from './schema.js';
import { seedIfEmpty } from './seed.js';
import {
  STATUSES,
  ISSUE_TYPES,
  PRIORITIES,
  serializeActivity,
  serializeComment,
  serializeIssue,
  serializeMember,
  serializeProject,
  serializeSprint,
} from './serializers.js';
import {
  authEnabled,
  checkPasscode,
  clearSessionCookie,
  isAuthed,
  requireAuth,
  setSessionCookie,
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 3000;

const uuid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (start, end) =>
  Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000);
const addDays = (date, days) => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeDate(value, label) {
  if (value == null || value === '') return null;
  const text = String(value).slice(0, 10);
  if (!DATE_RE.test(text)) fail(400, `${label} must be a date (YYYY-MM-DD)`);
  return text;
}

function normalizeLabels(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(400, 'labels must be an array');
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const label = String(raw).trim().slice(0, 30);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 12) break;
  }
  return out;
}

function normalizePoints(value) {
  if (value == null || value === '') return null;
  const points = Number(value);
  if (!Number.isFinite(points) || points < 0 || points > 100) fail(400, 'storyPoints must be between 0 and 100');
  return Math.round(points * 2) / 2;
}

const ISSUE_FIELDS = {
  summary: 'summary',
  description: 'description',
  type: 'type',
  status: 'status',
  priority: 'priority',
  assigneeId: 'assignee_id',
  reporterId: 'reporter_id',
  sprintId: 'sprint_id',
  epicId: 'epic_id',
  storyPoints: 'story_points',
  labels: 'labels',
};

async function getProject(id) {
  const project = await queryOne('select * from projects where id = $1', [id]);
  if (!project) fail(404, 'Project not found');
  return project;
}

async function getSprint(id) {
  const sprint = await queryOne('select * from sprints where id = $1', [id]);
  if (!sprint) fail(404, 'Sprint not found');
  return sprint;
}

async function getIssue(id) {
  const issue = await queryOne('select * from issues where id = $1', [id]);
  if (!issue) fail(404, 'Issue not found');
  return issue;
}

async function actorFrom(req, body = {}) {
  const id = body.actorId || req.get('x-actor-id');
  if (!id) return null;
  const member = await queryOne('select id from members where id = $1', [id]);
  return member ? member.id : null;
}

async function recordActivity(issueId, actorId, field, fromValue, toValue) {
  await query(
    `insert into activity (id, issue_id, actor_id, field, from_value, to_value)
     values ($1, $2, $3, $4, $5, $6)`,
    [uuid(), issueId, actorId, field, fromValue == null ? null : String(fromValue), toValue == null ? null : String(toValue)],
  );
}

async function appendRank(projectId, sprintId) {
  const params = [projectId];
  let scope = 'sprint_id is null';
  if (sprintId) {
    params.push(sprintId);
    scope = 'sprint_id = $2';
  }
  const row = await queryOne(
    `select coalesce(max(rank), 0) as max from issues where project_id = $1 and ${scope}`,
    params,
  );
  return Number(row.max) + 1000;
}

async function addToScope(sprintId, issueId, points) {
  await query(
    `insert into sprint_scope (sprint_id, issue_id, points) values ($1, $2, $3)
     on conflict (sprint_id, issue_id) do nothing`,
    [sprintId, issueId, Number(points || 0)],
  );
}

async function projectState(projectId) {
  const project = await getProject(projectId);
  const [sprints, issues] = await Promise.all([
    query('select * from sprints where project_id = $1 order by coalesce(start_date, created_at::date) asc, created_at asc', [projectId]),
    query('select * from issues where project_id = $1 order by rank asc, created_at asc', [projectId]),
  ]);
  return {
    project: serializeProject(project),
    sprints: sprints.map(serializeSprint),
    issues: issues.map(serializeIssue),
  };
}

function buildReports(projectId, sprints, issues, focusId, scopeRows = []) {
  const bySprint = new Map();
  for (const sprint of sprints) bySprint.set(sprint.id, []);
  for (const issue of issues) {
    if (issue.sprint_id && bySprint.has(issue.sprint_id)) bySprint.get(issue.sprint_id).push(issue);
  }

  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const scopeBySprint = new Map();
  for (const row of scopeRows) {
    if (!scopeBySprint.has(row.sprint_id)) scopeBySprint.set(row.sprint_id, []);
    scopeBySprint.get(row.sprint_id).push({ issueId: row.issue_id, points: Number(row.points || 0) });
  }

  const sprintRows = sprints.map((sprint) => {
    const sprintIssues = bySprint.get(sprint.id) || [];
    const done = sprintIssues.filter((issue) => issue.status === 'done');
    return {
      ...serializeSprint(sprint),
      issueCount: sprintIssues.length,
      completedCount: done.length,
      completedPoints: Math.round(done.reduce((sum, issue) => sum + Number(issue.story_points || 0), 0) * 10) / 10,
      totalPoints: Math.round(sprintIssues.reduce((sum, issue) => sum + Number(issue.story_points || 0), 0) * 10) / 10,
    };
  });

  const active = sprintRows.find((sprint) => sprint.state === 'active');
  const closed = sprintRows.filter((sprint) => sprint.state === 'closed');
  const focus =
    (focusId && sprintRows.find((sprint) => sprint.id === focusId)) ||
    active ||
    closed[closed.length - 1] ||
    null;

  let burndown = null;
  if (focus && focus.startDate) {
    const start = focus.startDate;
    const isActive = focus.state === 'active';
    const sprintEnd = focus.endDate || addDays(start, 13);
    let end = sprintEnd;
    if (isActive && today() < end) end = today() < start ? start : today();
    if (end < start) end = start;
    const span = Math.max(1, daysBetween(start, sprintEnd));
    const snapshot = scopeBySprint.get(focus.id) || [];
    const scope = snapshot.length
      ? snapshot
      : (bySprint.get(focus.id) || []).map((issue) => ({
          issueId: issue.id,
          points: Number(issue.story_points || 0),
        }));
    const total = scope.reduce((sum, item) => sum + item.points, 0);
    const days = [];
    for (let date = start; date <= end; date = addDays(date, 1)) days.push(date);
    const series = days.map((date) => {
      const cutoff = new Date(`${date}T23:59:59.999Z`).getTime();
      const completed = scope
        .filter((item) => {
          const issue = issueById.get(item.issueId);
          return issue && issue.status === 'done' && issue.resolved_at && new Date(issue.resolved_at).getTime() <= cutoff;
        })
        .reduce((sum, item) => sum + item.points, 0);
      return {
        date,
        remaining: Math.max(0, Math.round((total - completed) * 10) / 10),
      };
    });
    burndown = {
      sprintId: focus.id,
      sprintName: focus.name,
      startDate: start,
      endDate: focus.endDate,
      totalPoints: Math.round(total * 10) / 10,
      committedPoints: focus.committedPoints,
      today: today(),
      series: series.map((point) => ({
        ...point,
        ideal:
          Math.round(
            total *
              Math.max(0, 1 - Math.min(span, Math.max(0, daysBetween(start, point.date))) / span) *
              10,
          ) / 10,
      })),
    };
  }

  const workload = new Map();
  for (const issue of issues) {
    if (issue.status === 'done') continue;
    const id = issue.assignee_id || 'unassigned';
    if (!workload.has(id)) workload.set(id, { assigneeId: issue.assignee_id, open: 0, points: 0, byStatus: {} });
    const entry = workload.get(id);
    entry.open += 1;
    entry.points += Number(issue.story_points || 0);
    entry.byStatus[issue.status] = (entry.byStatus[issue.status] || 0) + 1;
  }

  const distribution = { status: {}, type: {}, priority: {} };
  for (const issue of issues) {
    distribution.status[issue.status] = (distribution.status[issue.status] || 0) + 1;
    distribution.type[issue.type] = (distribution.type[issue.type] || 0) + 1;
    distribution.priority[issue.priority] = (distribution.priority[issue.priority] || 0) + 1;
  }

  const doneIssues = issues.filter((issue) => issue.status === 'done');
  return {
    sprints: sprintRows,
    velocity: closed.slice(-6).map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      committed: sprint.committedPoints,
      completed: sprint.completedPoints,
      endDate: sprint.endDate,
    })),
    focus,
    burndown,
    workload: [...workload.values()].sort((a, b) => b.points - a.points),
    distribution,
    totals: {
      issues: issues.length,
      done: doneIssues.length,
      openPoints: Math.round(
        issues.filter((issue) => issue.status !== 'done').reduce((sum, issue) => sum + Number(issue.story_points || 0), 0) * 10,
      ) / 10,
      donePoints: Math.round(doneIssues.reduce((sum, issue) => sum + Number(issue.story_points || 0), 0) * 10) / 10,
    },
  };
}

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.get('/api/health', route(async (req, res) => {
    await query('select 1 as ok');
    res.json({ ok: true, db: db().kind, auth: authEnabled() });
  }));

  app.get('/api/auth/status', (req, res) => {
    res.json({ authEnabled: authEnabled(), authed: isAuthed(req) });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!authEnabled()) return res.json({ authEnabled: false, authed: true });
    if (!checkPasscode(req.body?.passcode)) {
      return res.status(401).json({ error: 'Incorrect passcode' });
    }
    setSessionCookie(req, res);
    res.json({ authEnabled: true, authed: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.use('/api', requireAuth);

  app.get('/api/bootstrap', route(async (req, res) => {
    const [projects, members] = await Promise.all([
      query('select * from projects order by created_at asc'),
      query('select * from members order by name asc'),
    ]);
    res.json({ projects: projects.map(serializeProject), members: members.map(serializeMember) });
  }));

  app.post('/api/projects', route(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const key = String(req.body?.key || '').trim().toUpperCase();
    const description = String(req.body?.description || '').trim();
    if (!name) fail(400, 'Project name is required');
    if (!/^[A-Z][A-Z0-9]{1,5}$/.test(key)) fail(400, 'Key must be 2–6 letters or numbers, starting with a letter');
    if (await queryOne('select id from projects where key = $1', [key])) fail(409, 'That project key is already in use');
    const row = await queryOne(
      `insert into projects (id, key, name, description) values ($1, $2, $3, $4) returning *`,
      [uuid(), key, name, description],
    );
    res.status(201).json({ project: serializeProject(row) });
  }));

  app.patch('/api/projects/:id', route(async (req, res) => {
    const project = await getProject(req.params.id);
    const name = req.body?.name != null ? String(req.body.name).trim() : project.name;
    const description = req.body?.description != null ? String(req.body.description) : project.description;
    if (!name) fail(400, 'Project name is required');
    const row = await queryOne('update projects set name = $1, description = $2 where id = $3 returning *', [
      name,
      description,
      project.id,
    ]);
    res.json({ project: serializeProject(row) });
  }));

  app.get('/api/projects/:id', route(async (req, res) => {
    res.json(await projectState(req.params.id));
  }));

  /* ---------------------------------- members --------------------------------- */

  app.post('/api/members', route(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) fail(400, 'Member name is required');
    const member = await queryOne(
      `insert into members (id, name, email, role, color) values ($1, $2, $3, $4, $5) returning *`,
      [uuid(), name, String(req.body?.email || '').trim(), String(req.body?.role || '').trim(), String(req.body?.color || '#0052cc')],
    );
    res.status(201).json({ member: serializeMember(member) });
  }));

  app.patch('/api/members/:id', route(async (req, res) => {
    const member = await queryOne('select * from members where id = $1', [req.params.id]);
    if (!member) fail(404, 'Member not found');
    const updated = await queryOne(
      `update members set name = $1, email = $2, role = $3, color = $4 where id = $5 returning *`,
      [
        req.body?.name != null ? String(req.body.name).trim() : member.name,
        req.body?.email != null ? String(req.body.email).trim() : member.email,
        req.body?.role != null ? String(req.body.role).trim() : member.role,
        req.body?.color != null ? String(req.body.color) : member.color,
        member.id,
      ],
    );
    res.json({ member: serializeMember(updated) });
  }));

  app.delete('/api/members/:id', route(async (req, res) => {
    await query('delete from members where id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  /* ---------------------------------- sprints --------------------------------- */

  app.post('/api/projects/:id/sprints', route(async (req, res) => {
    const project = await getProject(req.params.id);
    const count = await queryOne("select count(*)::int as count from sprints where project_id = $1", [project.id]);
    const name = String(req.body?.name || '').trim() || `Sprint ${Number(count.count) + 1}`;
    const startDate = normalizeDate(req.body?.startDate, 'startDate');
    const endDate = normalizeDate(req.body?.endDate, 'endDate');
    if (startDate && endDate && endDate < startDate) fail(400, 'End date must be after the start date');
    const row = await queryOne(
      `insert into sprints (id, project_id, name, goal, start_date, end_date)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [uuid(), project.id, name, String(req.body?.goal || '').trim(), startDate, endDate],
    );
    res.status(201).json({ sprint: serializeSprint(row) });
  }));

  app.patch('/api/sprints/:id', route(async (req, res) => {
    const sprint = await getSprint(req.params.id);
    if (sprint.state === 'closed') fail(400, 'Closed sprints cannot be edited');
    const name = req.body?.name != null ? String(req.body.name).trim() : sprint.name;
    if (!name) fail(400, 'Sprint name is required');
    const startDate = req.body?.startDate !== undefined ? normalizeDate(req.body.startDate, 'startDate') : sprint.start_date;
    const endDate = req.body?.endDate !== undefined ? normalizeDate(req.body.endDate, 'endDate') : sprint.end_date;
    if (startDate && endDate && String(endDate).slice(0, 10) < String(startDate).slice(0, 10)) {
      fail(400, 'End date must be after the start date');
    }
    const row = await queryOne(
      `update sprints set name = $1, goal = $2, start_date = $3, end_date = $4 where id = $5 returning *`,
      [name, req.body?.goal != null ? String(req.body.goal) : sprint.goal, startDate, endDate, sprint.id],
    );
    res.json({ sprint: serializeSprint(row) });
  }));

  app.post('/api/sprints/:id/start', route(async (req, res) => {
    const sprint = await getSprint(req.params.id);
    if (sprint.state === 'closed') fail(400, 'This sprint is already complete');
    if (sprint.state === 'active') fail(400, 'This sprint is already active');
    const existing = await queryOne("select id from sprints where project_id = $1 and state = 'active'", [sprint.project_id]);
    if (existing) fail(409, 'Finish the current sprint before starting another one');

    const issues = await query('select id, story_points from issues where sprint_id = $1', [sprint.id]);
    if (!issues.length) fail(400, 'Add at least one issue to the sprint before starting it');

    const startDate = normalizeDate(req.body?.startDate, 'startDate') || today();
    const endDate = normalizeDate(req.body?.endDate, 'endDate') || addDays(startDate, 13);
    if (endDate < startDate) fail(400, 'End date must be after the start date');
    const goal = req.body?.goal != null ? String(req.body.goal) : sprint.goal;
    const committed = issues.reduce((sum, issue) => sum + Number(issue.story_points || 0), 0);

    const row = await withTx(async () => {
      await query('delete from sprint_scope where sprint_id = $1', [sprint.id]);
      for (const issue of issues) {
        await addToScope(sprint.id, issue.id, issue.story_points);
      }
      return queryOne(
        `update sprints set state = 'active', started_at = now(), start_date = $1, end_date = $2,
           goal = $3, committed_points = $4 where id = $5 returning *`,
        [startDate, endDate, goal, committed, sprint.id],
      );
    });

    res.json({ sprint: serializeSprint(row), state: await projectState(sprint.project_id) });
  }));

  app.post('/api/sprints/:id/complete', route(async (req, res) => {
    const sprint = await getSprint(req.params.id);
    if (sprint.state !== 'active') fail(400, 'Only an active sprint can be completed');
    const target = req.body?.moveIncompleteTo;
    let targetSprint = null;
    if (target && target !== 'backlog') {
      targetSprint = await getSprint(target);
      if (targetSprint.project_id !== sprint.project_id) fail(400, 'Target sprint belongs to another project');
      if (targetSprint.state === 'closed') fail(400, 'Cannot move work into a closed sprint');
      if (targetSprint.id === sprint.id) fail(400, 'Cannot move work into the sprint being completed');
    }

    await withTx(async () => {
      const open = await query(
        'select id, story_points from issues where sprint_id = $1 and status <> $2',
        [sprint.id, 'done'],
      );
      if (open.length) {
        let rank = await appendRank(sprint.project_id, targetSprint ? targetSprint.id : null);
        for (const issue of open) {
          await query('update issues set sprint_id = $1, rank = $2, updated_at = now() where id = $3', [
            targetSprint ? targetSprint.id : null,
            rank,
            issue.id,
          ]);
          if (targetSprint) await addToScope(targetSprint.id, issue.id, issue.story_points);
          rank += 1000;
        }
      }
      await query("update sprints set state = 'closed', completed_at = now() where id = $1", [sprint.id]);
    });

    res.json({ state: await projectState(sprint.project_id) });
  }));

  app.delete('/api/sprints/:id', route(async (req, res) => {
    const sprint = await getSprint(req.params.id);
    if (sprint.state !== 'future') fail(400, 'Only future sprints can be deleted');
    await withTx(async () => {
      const rank = await appendRank(sprint.project_id, null);
      const issues = await query('select id from issues where sprint_id = $1', [sprint.id]);
      let nextRank = rank;
      for (const issue of issues) {
        await query('update issues set sprint_id = null, rank = $1 where id = $2', [nextRank, issue.id]);
        nextRank += 1000;
      }
      await query('delete from sprints where id = $1', [sprint.id]);
    });
    res.json({ state: await projectState(sprint.project_id) });
  }));

  /* ---------------------------------- issues ---------------------------------- */

  app.post('/api/projects/:id/issues', route(async (req, res) => {
    const project = await getProject(req.params.id);
    const body = req.body || {};
    const summary = String(body.summary || '').trim();
    if (!summary) fail(400, 'Summary is required');
    const type = ISSUE_TYPES.includes(body.type) ? body.type : 'story';
    const status = STATUSES.includes(body.status) ? body.status : 'todo';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'medium';
    const points = normalizePoints(body.storyPoints);
    let sprintId = body.sprintId || null;
    if (sprintId) {
      const sprint = await queryOne('select * from sprints where id = $1 and project_id = $2', [sprintId, project.id]);
      if (!sprint) fail(400, 'Sprint not found in this project');
      if (sprint.state === 'closed') fail(400, 'Cannot add issues to a closed sprint');
      sprintId = sprint.id;
    }
    let epicId = body.epicId || null;
    if (epicId) {
      const epic = await queryOne("select id from issues where id = $1 and project_id = $2 and type = 'epic'", [epicId, project.id]);
      if (!epic) fail(400, 'Epic not found in this project');
    }
    const actorId = await actorFrom(req, body);

    const issue = await withTx(async () => {
      const locked = await queryOne('select * from projects where id = $1 for update', [project.id]);
      const number = locked.next_issue_number;
      await query('update projects set next_issue_number = $1 where id = $2', [number + 1, project.id]);
      const rank = await appendRank(project.id, sprintId);
      const row = await queryOne(
        `insert into issues (id, key, project_id, type, summary, description, status, priority,
            assignee_id, reporter_id, sprint_id, epic_id, story_points, labels, rank, resolved_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         returning *`,
        [
          uuid(),
          `${locked.key}-${number}`,
          project.id,
          type,
          summary,
          String(body.description || ''),
          status,
          priority,
          body.assigneeId || null,
          body.reporterId || actorId,
          sprintId,
          epicId,
          points,
          normalizeLabels(body.labels),
          rank,
          status === 'done' ? new Date().toISOString() : null,
        ],
      );
      await recordActivity(row.id, actorId, 'created', null, summary);
      if (sprintId) {
        const sprint = await queryOne('select state from sprints where id = $1', [sprintId]);
        if (sprint?.state === 'active') await addToScope(sprintId, row.id, points);
      }
      return row;
    });

    res.status(201).json({ issue: serializeIssue(issue) });
  }));

  app.get('/api/issues/:id', route(async (req, res) => {
    const issue = await getIssue(req.params.id);
    const [comments, activity] = await Promise.all([
      query('select * from comments where issue_id = $1 order by created_at asc', [issue.id]),
      query('select * from activity where issue_id = $1 order by created_at asc', [issue.id]),
    ]);
    res.json({
      issue: serializeIssue(issue),
      comments: comments.map(serializeComment),
      activity: activity.map(serializeActivity),
    });
  }));

  app.patch('/api/issues/:id', route(async (req, res) => {
    const existing = await getIssue(req.params.id);
    const project = await getProject(existing.project_id);
    const body = req.body || {};
    const actorId = await actorFrom(req, body);
    const updates = [];
    const activityLog = [];
    const params = [];
    const push = (column, value) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    const valueOf = (field) => {
      const current = existing[ISSUE_FIELDS[field]];
      if (field === 'storyPoints') return current == null ? null : Number(current);
      if (field === 'labels') return current || [];
      return current == null ? null : current;
    };

    for (const field of Object.keys(ISSUE_FIELDS)) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
      let value = body[field];
      if (field === 'summary') {
        value = String(value || '').trim();
        if (!value) fail(400, 'Summary cannot be empty');
      } else if (field === 'description') {
        value = String(value || '');
        if (value.length > 20000) fail(400, 'Description is too long');
      } else if (field === 'type') {
        if (!ISSUE_TYPES.includes(value)) fail(400, 'Invalid issue type');
      } else if (field === 'status') {
        if (!STATUSES.includes(value)) fail(400, 'Invalid status');
      } else if (field === 'priority') {
        if (!PRIORITIES.includes(value)) fail(400, 'Invalid priority');
      } else if (field === 'storyPoints') {
        value = normalizePoints(value);
      } else if (field === 'labels') {
        value = normalizeLabels(value);
      } else if (field === 'epicId') {
        if (value) {
          if (value === existing.id) fail(400, 'An epic cannot contain itself');
          const epic = await queryOne("select id from issues where id = $1 and project_id = $2 and type = 'epic'", [
            value,
            project.id,
          ]);
          if (!epic) fail(400, 'Epic not found in this project');
        }
      } else if (field === 'sprintId') {
        if (value) {
          const sprint = await queryOne('select * from sprints where id = $1 and project_id = $2', [value, project.id]);
          if (!sprint) fail(400, 'Sprint not found in this project');
          if (sprint.state === 'closed') fail(400, 'Cannot move work into a closed sprint');
        }
      } else if (field === 'assigneeId' || field === 'reporterId') {
        if (value) {
          const member = await queryOne('select id from members where id = $1', [value]);
          if (!member) fail(400, 'Member not found');
        }
      }

      const before = valueOf(field);
      const changed =
        field === 'labels'
          ? JSON.stringify(before) !== JSON.stringify(value)
          : field === 'storyPoints'
            ? Number(before || 0) !== Number(value || 0)
            : before !== value;
      if (!changed) continue;

      push(ISSUE_FIELDS[field], value);
      activityLog.push([field, field === 'description' ? null : before, field === 'description' ? null : value]);
    }

    if (!updates.length && !Object.prototype.hasOwnProperty.call(body, 'rank')) {
      return res.json({ issue: serializeIssue(existing) });
    }

    if (Object.prototype.hasOwnProperty.call(body, 'rank')) {
      const rank = Number(body.rank);
      if (!Number.isFinite(rank)) fail(400, 'Invalid rank');
      push('rank', rank);
    }

    if (body.sprintId !== undefined && body.sprintId !== existing.sprint_id && body.rank === undefined) {
      const rank = await appendRank(project.id, body.sprintId || null);
      push('rank', rank);
    }

    if (body.status !== undefined && body.status !== existing.status) {
      params.push(body.status === 'done' ? new Date().toISOString() : null);
      updates.push(`resolved_at = $${params.length}`);
    }

    params.push(new Date().toISOString(), existing.id);
    updates.push(`updated_at = $${params.length - 1}`);
    const row = await queryOne(`update issues set ${updates.join(', ')} where id = $${params.length} returning *`, params);

    for (const [field, from, to] of activityLog) {
      await recordActivity(existing.id, actorId, field, from, to);
    }
    if (body.sprintId && body.sprintId !== existing.sprint_id) {
      const sprint = await queryOne('select state from sprints where id = $1', [body.sprintId]);
      if (sprint?.state === 'active') await addToScope(body.sprintId, existing.id, row.story_points);
    }

    res.json({ issue: serializeIssue(row) });
  }));

  app.delete('/api/issues/:id', route(async (req, res) => {
    const issue = await getIssue(req.params.id);
    await query('delete from issues where id = $1', [issue.id]);
    res.json({ ok: true });
  }));

  app.post('/api/issues/:id/comments', route(async (req, res) => {
    const issue = await getIssue(req.params.id);
    const body = String(req.body?.body || '').trim();
    if (!body) fail(400, 'Comment cannot be empty');
    if (body.length > 10000) fail(400, 'Comment is too long');
    const authorId = await actorFrom(req, req.body || {});
    const row = await queryOne(
      'insert into comments (id, issue_id, author_id, body) values ($1, $2, $3, $4) returning *',
      [uuid(), issue.id, authorId, body],
    );
    await query('update issues set updated_at = now() where id = $1', [issue.id]);
    res.status(201).json({ comment: serializeComment(row) });
  }));

  app.post('/api/projects/:id/reorder', route(async (req, res) => {
    const project = await getProject(req.params.id);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (!ids) fail(400, 'ids array is required');
    if (ids.length > 2000) fail(400, 'Too many issues in one reorder');
    const rows = await query('select id from issues where project_id = $1', [project.id]);
    const valid = new Set(rows.map((row) => row.id));
    const clean = ids.filter((id) => valid.has(id));
    await withTx(async () => {
      for (let index = 0; index < clean.length; index += 1) {
        await query('update issues set rank = $1 where id = $2', [(index + 1) * 1000, clean[index]]);
      }
    });
    res.json({ ok: true });
  }));

  /* ---------------------------------- reports --------------------------------- */

  app.get('/api/projects/:id/reports', route(async (req, res) => {
    const project = await getProject(req.params.id);
    const [sprints, issues, scopeRows] = await Promise.all([
      query('select * from sprints where project_id = $1 order by coalesce(start_date, created_at::date) asc, created_at asc', [project.id]),
      query('select * from issues where project_id = $1 order by rank asc', [project.id]),
      query(
        `select ss.sprint_id, ss.issue_id, ss.points from sprint_scope ss
         join sprints s on s.id = ss.sprint_id where s.project_id = $1`,
        [project.id],
      ),
    ]);
    res.json(buildReports(project.id, sprints, issues, req.query.sprintId, scopeRows));
  }));

  /* ---------------------------------- static ---------------------------------- */

  const dist = path.join(root, 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error('[api]', req.method, req.originalUrl, err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });

  return app;
}

async function main() {
  await initDb();
  await ensureSchema(db());
  if (process.env.SEED_DEMO === 'false') {
    console.log('[db] demo seeding disabled (SEED_DEMO=false)');
  } else {
    const seeded = await seedIfEmpty();
    if (seeded) console.log('[db] seeded demo workspace');
  }
  if (!process.env.DATABASE_URL) {
    console.log('[db] using local PGlite at', process.env.PGLITE_DIR || '.data/pg');
    if (process.env.NODE_ENV === 'production') {
      console.warn('[db] WARNING: no DATABASE_URL set — data will not survive a redeploy on Render.');
    }
  }

  const app = createApp();
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[forgeboard] listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close();
    await import('./db.js').then(({ closeDb }) => closeDb());
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
