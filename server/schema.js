const STATEMENTS = [
  `create table if not exists members (
    id text primary key,
    name text not null,
    email text,
    role text not null default '',
    color text not null default '#0052cc',
    created_at timestamptz not null default now()
  )`,
  `create table if not exists projects (
    id text primary key,
    key text not null unique,
    name text not null,
    description text not null default '',
    next_issue_number integer not null default 1,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists sprints (
    id text primary key,
    project_id text not null references projects(id) on delete cascade,
    name text not null,
    goal text not null default '',
    state text not null default 'future',
    start_date date,
    end_date date,
    committed_points real not null default 0,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists sprints_project_idx on sprints(project_id, state)`,
  `create table if not exists issues (
    id text primary key,
    key text not null,
    project_id text not null references projects(id) on delete cascade,
    type text not null default 'story',
    summary text not null,
    description text not null default '',
    status text not null default 'todo',
    priority text not null default 'medium',
    assignee_id text references members(id) on delete set null,
    reporter_id text references members(id) on delete set null,
    sprint_id text references sprints(id) on delete set null,
    epic_id text references issues(id) on delete set null,
    story_points real,
    labels text[] not null default '{}',
    rank double precision not null default 1000,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz
  )`,
  `create unique index if not exists issues_key_idx on issues(project_id, key)`,
  `create index if not exists issues_project_idx on issues(project_id, sprint_id)`,
  `create table if not exists comments (
    id text primary key,
    issue_id text not null references issues(id) on delete cascade,
    author_id text references members(id) on delete set null,
    body text not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists comments_issue_idx on comments(issue_id, created_at)`,
  `create table if not exists activity (
    id text primary key,
    issue_id text not null references issues(id) on delete cascade,
    actor_id text references members(id) on delete set null,
    field text not null,
    from_value text,
    to_value text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists activity_issue_idx on activity(issue_id, created_at)`,
  `create table if not exists sprint_scope (
    sprint_id text not null references sprints(id) on delete cascade,
    issue_id text not null references issues(id) on delete cascade,
    points real not null default 0,
    primary key (sprint_id, issue_id)
  )`,
];

export async function ensureSchema(database) {
  for (const statement of STATEMENTS) {
    await database.query(statement);
  }
}
