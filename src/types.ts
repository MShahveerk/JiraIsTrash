export type Status = 'todo' | 'in_progress' | 'in_review' | 'done';
export type IssueType = 'story' | 'task' | 'bug' | 'epic';
export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';
export type SprintState = 'future' | 'active' | 'closed';
export type Route = 'board' | 'backlog' | 'reports' | 'team';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  createdAt: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  state: SprintState;
  startDate: string | null;
  endDate: string | null;
  committedPoints: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Issue {
  id: string;
  key: string;
  projectId: string;
  type: IssueType;
  summary: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  reporterId: string | null;
  sprintId: string | null;
  epicId: string | null;
  storyPoints: number | null;
  labels: string[];
  rank: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  issueId: string;
  actorId: string | null;
  field: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

export interface ProjectState {
  project: Project;
  sprints: Sprint[];
  issues: Issue[];
}

export interface SprintReport extends Sprint {
  issueCount: number;
  completedCount: number;
  completedPoints: number;
  totalPoints: number;
}

export interface VelocityPoint {
  id: string;
  name: string;
  committed: number;
  completed: number;
  endDate: string | null;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export interface Burndown {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string | null;
  totalPoints: number;
  committedPoints: number;
  today: string;
  series: BurndownPoint[];
}

export interface WorkloadEntry {
  assigneeId: string | null;
  open: number;
  points: number;
  byStatus: Partial<Record<Status, number>>;
}

export interface Reports {
  sprints: SprintReport[];
  velocity: VelocityPoint[];
  focus: SprintReport | null;
  burndown: Burndown | null;
  workload: WorkloadEntry[];
  distribution: {
    status: Partial<Record<Status, number>>;
    type: Partial<Record<IssueType, number>>;
    priority: Partial<Record<Priority, number>>;
  };
  totals: {
    issues: number;
    done: number;
    openPoints: number;
    donePoints: number;
  };
}

export interface IssueDetailResponse {
  issue: Issue;
  comments: Comment[];
  activity: Activity[];
}
