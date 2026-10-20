export const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
export const ISSUE_TYPES = ['story', 'task', 'bug', 'epic'];
export const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
export const SPRINT_STATES = ['future', 'active', 'closed'];

const toIso = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return toIso(value).slice(0, 10);
};

export function serializeMember(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || '',
    role: row.role || '',
    color: row.color || '#0052cc',
    createdAt: toIso(row.created_at),
  };
}

export function serializeProject(row) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description || '',
    createdAt: toIso(row.created_at),
  };
}

export function serializeSprint(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    goal: row.goal || '',
    state: row.state,
    startDate: toDate(row.start_date),
    endDate: toDate(row.end_date),
    committedPoints: Number(row.committed_points || 0),
    startedAt: toIso(row.started_at),
    completedAt: toIso(row.completed_at),
    createdAt: toIso(row.created_at),
  };
}

export function serializeIssue(row) {
  return {
    id: row.id,
    key: row.key,
    projectId: row.project_id,
    type: row.type,
    summary: row.summary,
    description: row.description || '',
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id || null,
    reporterId: row.reporter_id || null,
    sprintId: row.sprint_id || null,
    epicId: row.epic_id || null,
    storyPoints: row.story_points == null ? null : Number(row.story_points),
    labels: row.labels || [],
    rank: Number(row.rank),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    resolvedAt: toIso(row.resolved_at),
  };
}

export function serializeComment(row) {
  return {
    id: row.id,
    issueId: row.issue_id,
    authorId: row.author_id || null,
    body: row.body,
    createdAt: toIso(row.created_at),
  };
}

export function serializeActivity(row) {
  return {
    id: row.id,
    issueId: row.issue_id,
    actorId: row.actor_id || null,
    field: row.field,
    fromValue: row.from_value,
    toValue: row.to_value,
    createdAt: toIso(row.created_at),
  };
}
