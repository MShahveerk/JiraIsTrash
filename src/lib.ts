import type { Issue, IssueType, Priority, Sprint, Status } from './types';

export const STATUSES: Status[] = ['todo', 'in_progress', 'in_review', 'done'];

export const STATUS_META: Record<Status, { label: string; short: string; color: string }> = {
  todo: { label: 'To Do', short: 'To Do', color: '#6b778c' },
  in_progress: { label: 'In Progress', short: 'In Progress', color: '#0c66e4' },
  in_review: { label: 'In Review', short: 'In Review', color: '#8270db' },
  done: { label: 'Done', short: 'Done', color: '#1f845a' },
};

export const TYPE_META: Record<IssueType, { label: string; color: string }> = {
  story: { label: 'Story', color: '#1f845a' },
  task: { label: 'Task', color: '#0c66e4' },
  bug: { label: 'Bug', color: '#c9372c' },
  epic: { label: 'Epic', color: '#8270db' },
};

export const PRIORITY_META: Record<Priority, { label: string; color: string; level: number }> = {
  highest: { label: 'Highest', color: '#c9372c', level: 4 },
  high: { label: 'High', color: '#e56910', level: 3 },
  medium: { label: 'Medium', color: '#c99700', level: 2 },
  low: { label: 'Low', color: '#0c66e4', level: 1 },
  lowest: { label: 'Lowest', color: '#0c66e4', level: 0 },
};

export const PRIORITIES: Priority[] = ['highest', 'high', 'medium', 'low', 'lowest'];
export const ISSUE_TYPES: IssueType[] = ['story', 'task', 'bug', 'epic'];

export const MEMBER_COLORS = ['#0052cc', '#6554c0', '#00875a', '#ff8b00', '#de350b', '#00a3bf', '#943d73', '#5e6c84'];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function parseDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value.length <= 10 ? `${value}T12:00:00` : value);
}

export function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', ...options });
}

export function formatDateLong(value: string | null | undefined) {
  return formatDate(value, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return 'No dates yet';
  if (start && end) {
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    const startLabel = formatDate(start, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
    return `${startLabel} – ${formatDate(end, { day: 'numeric', month: 'short' })}`;
  }
  return formatDate(start || end);
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDate(value, { month: 'short', day: 'numeric' });
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function sprintTiming(sprint: Sprint) {
  const today = todayString();
  if (sprint.state === 'active' && sprint.endDate) {
    const remaining = daysBetween(today, sprint.endDate);
    if (remaining < 0) return `${Math.abs(remaining)}d overdue`;
    if (remaining === 0) return 'ends today';
    return `${remaining}d left`;
  }
  if (sprint.state === 'future' && sprint.startDate) {
    const until = daysBetween(today, sprint.startDate);
    if (until <= 0) return 'ready to start';
    return `starts ${formatDate(sprint.startDate)}`;
  }
  if (sprint.state === 'closed' && sprint.endDate) return `closed ${formatDate(sprint.endDate)}`;
  return '';
}

export function byRank(a: Issue, b: Issue) {
  return a.rank - b.rank;
}

export function issuesIn(issues: Issue[], sprintId: string | null, status?: Status) {
  return issues
    .filter((issue) => issue.sprintId === sprintId && (status ? issue.status === status : true))
    .sort(byRank);
}

export function sumPoints(issues: Issue[]) {
  return Math.round(issues.reduce((total, issue) => total + Number(issue.storyPoints || 0), 0) * 10) / 10;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function moveItem<T>(items: T[], from: number, to: number) {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}
