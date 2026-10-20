import type {
  Comment,
  Issue,
  IssueDetailResponse,
  IssueType,
  Member,
  Priority,
  Project,
  ProjectState,
  Reports,
  Sprint,
  Status,
} from './types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore non-JSON errors */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

const body = (value: unknown) => JSON.stringify(value);

export interface IssuePayload {
  summary: string;
  description?: string;
  type?: IssueType;
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
  reporterId?: string | null;
  sprintId?: string | null;
  epicId?: string | null;
  storyPoints?: number | null;
  labels?: string[];
}

export const api = {
  authStatus: () => request<{ authEnabled: boolean; authed: boolean }>('/auth/status'),
  login: (passcode: string) =>
    request<{ authEnabled: boolean; authed: boolean }>('/auth/login', {
      method: 'POST',
      body: body({ passcode }),
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: body({}) }),

  bootstrap: () => request<{ projects: Project[]; members: Member[] }>('/bootstrap'),
  createProject: (payload: { name: string; key: string; description?: string }) =>
    request<{ project: Project }>('/projects', { method: 'POST', body: body(payload) }),
  updateProject: (id: string, payload: { name?: string; description?: string }) =>
    request<{ project: Project }>(`/projects/${id}`, { method: 'PATCH', body: body(payload) }),
  project: (id: string) => request<ProjectState>(`/projects/${id}`),

  createMember: (payload: { name: string; email?: string; role?: string; color?: string }) =>
    request<{ member: Member }>('/members', { method: 'POST', body: body(payload) }),
  updateMember: (id: string, payload: { name?: string; email?: string; role?: string; color?: string }) =>
    request<{ member: Member }>(`/members/${id}`, { method: 'PATCH', body: body(payload) }),
  deleteMember: (id: string) => request<{ ok: boolean }>(`/members/${id}`, { method: 'DELETE' }),

  createSprint: (
    projectId: string,
    payload: { name?: string; goal?: string; startDate?: string | null; endDate?: string | null },
  ) => request<{ sprint: Sprint }>(`/projects/${projectId}/sprints`, { method: 'POST', body: body(payload) }),
  updateSprint: (
    id: string,
    payload: { name?: string; goal?: string; startDate?: string | null; endDate?: string | null },
  ) => request<{ sprint: Sprint }>(`/sprints/${id}`, { method: 'PATCH', body: body(payload) }),
  startSprint: (
    id: string,
    payload: { startDate?: string; endDate?: string; goal?: string; actorId?: string | null },
  ) => request<{ sprint: Sprint; state: ProjectState }>(`/sprints/${id}/start`, { method: 'POST', body: body(payload) }),
  completeSprint: (id: string, payload: { moveIncompleteTo?: string; actorId?: string | null }) =>
    request<{ state: ProjectState }>(`/sprints/${id}/complete`, { method: 'POST', body: body(payload) }),
  deleteSprint: (id: string) => request<{ state: ProjectState }>(`/sprints/${id}`, { method: 'DELETE' }),

  createIssue: (projectId: string, payload: IssuePayload & { actorId?: string | null }) =>
    request<{ issue: Issue }>(`/projects/${projectId}/issues`, { method: 'POST', body: body(payload) }),
  issue: (id: string) => request<IssueDetailResponse>(`/issues/${id}`),
  updateIssue: (
    id: string,
    payload: Partial<IssuePayload> & { rank?: number; actorId?: string | null },
  ) => request<{ issue: Issue }>(`/issues/${id}`, { method: 'PATCH', body: body(payload) }),
  deleteIssue: (id: string) => request<{ ok: boolean }>(`/issues/${id}`, { method: 'DELETE' }),
  addComment: (id: string, payload: { body: string; authorId?: string | null }) =>
    request<{ comment: Comment }>(`/issues/${id}/comments`, { method: 'POST', body: body(payload) }),

  reorder: (projectId: string, ids: string[]) =>
    request<{ ok: boolean }>(`/projects/${projectId}/reorder`, { method: 'POST', body: body({ ids }) }),

  reports: (projectId: string, sprintId?: string) =>
    request<Reports>(`/projects/${projectId}/reports${sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : ''}`),
};
