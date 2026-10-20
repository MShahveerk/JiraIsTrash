import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type IssuePayload } from './api';
import type { Issue, Member, Project, ProjectState, Route, Sprint, Status } from './types';
import { byRank } from './lib';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Board } from './components/Board';
import { Backlog } from './components/Backlog';
import { ReportsPage } from './components/Reports';
import { Team } from './components/Team';
import { IssueDrawer } from './components/IssueDrawer';
import { IssueModal, type CreateDefaults } from './components/IssueModal';
import { Login } from './components/Login';
import { FirstRun } from './components/FirstRun';
import { Toasts, Spinner, type Toast } from './components/ui';

const ROUTES: Route[] = ['board', 'backlog', 'reports', 'team'];
const ACTOR_KEY = 'forgeboard:actor';
const PROJECT_KEY = 'forgeboard:project';

function parseHash(): { key?: string; route: Route } {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length >= 2 && ROUTES.includes(parts[1] as Route)) {
    return { key: parts[0].toUpperCase(), route: parts[1] as Route };
  }
  if (parts.length === 1 && ROUTES.includes(parts[0] as Route)) return { route: parts[0] as Route };
  return { route: 'board' };
}

type Patch = Partial<IssuePayload> & { rank?: number };

export default function App() {
  const initialHash = useRef(parseHash());
  const [auth, setAuth] = useState<{ enabled: boolean; authed: boolean } | null>(null);
  const [booting, setBooting] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [state, setState] = useState<ProjectState | null>(null);
  const [route, setRoute] = useState<Route>(initialHash.current.route);
  const [loadingProject, setLoadingProject] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [createDefaults, setCreateDefaults] = useState<CreateDefaults | null>(null);
  const [actorId, setActorId] = useState<string | null>(() => localStorage.getItem(ACTOR_KEY));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [detailVersion, setDetailVersion] = useState(0);
  const [revision, setRevision] = useState(0);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const loadBootstrap = useCallback(async () => {
    const data = await api.bootstrap();
    setProjects(data.projects);
    setMembers(data.members);
    setActorId((current) => {
      const stored = current && data.members.some((member) => member.id === current) ? current : null;
      return stored || data.members[0]?.id || null;
    });
    setProjectId((current) => {
      if (current && data.projects.some((project) => project.id === current)) return current;
      const hashKey = parseHash().key;
      const byKey = hashKey ? data.projects.find((project) => project.key === hashKey) : null;
      const stored = localStorage.getItem(PROJECT_KEY);
      return (
        byKey?.id ||
        data.projects.find((project) => project.id === stored)?.id ||
        data.projects[0]?.id ||
        null
      );
    });
  }, []);

  const refreshProject = useCallback(async (id = projectId) => {
    if (!id) return;
    try {
      const next = await api.project(id);
      setState(next);
      setRevision((value) => value + 1);
      setDetailVersion((value) => value + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load project', 'error');
    }
  }, [projectId, notify]);

  useEffect(() => {
    api
      .authStatus()
      .then((status) => setAuth({ enabled: status.authEnabled, authed: status.authed }))
      .catch(() => setAuth({ enabled: false, authed: true }));
  }, []);

  useEffect(() => {
    if (!auth?.authed) return;
    let cancelled = false;
    setBooting(true);
    loadBootstrap()
      .catch((error) => {
        if (!cancelled) notify(error instanceof Error ? error.message : 'Could not load workspace', 'error');
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.authed, loadBootstrap, notify]);

  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(PROJECT_KEY, projectId);
    let cancelled = false;
    setState((prev) => (prev && prev.project.id !== projectId ? null : prev));
    setLoadingProject(true);
    api
      .project(projectId)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((error) => {
        if (!cancelled) notify(error instanceof Error ? error.message : 'Could not load project', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingProject(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, notify]);

  useEffect(() => {
    if (actorId) localStorage.setItem(ACTOR_KEY, actorId);
  }, [actorId]);

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash();
      setRoute(parsed.route);
      if (parsed.key) {
        const project = projects.find((candidate) => candidate.key === parsed.key);
        if (project && project.id !== projectId) setProjectId(project.id);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [projects, projectId]);

  const project = state?.project || projects.find((candidate) => candidate.id === projectId) || null;
  const sprints = state?.sprints || [];
  const issues = state?.issues || [];
  const activeSprint = sprints.find((sprint) => sprint.state === 'active') || null;

  useEffect(() => {
    if (!project) return;
    const target = `#/${project.key}/${route}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [project, route]);

  const actor = members.find((member) => member.id === actorId) || members[0] || null;

  const navigate = (next: Route) => {
    setRoute(next);
    if (project) window.location.hash = `#/${project.key}/${next}`;
  };

  const openCreate = (defaults: CreateDefaults = {}) => {
    setCreateDefaults({
      sprintId: defaults.sprintId !== undefined ? defaults.sprintId : activeSprint?.id ?? null,
      status: defaults.status || 'todo',
      type: defaults.type || 'story',
    });
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        setCreateDefaults({ sprintId: activeSprint?.id ?? null, status: 'todo', type: 'story' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSprint?.id]);

  const updateIssue = async (id: string, patch: Patch) => {
    if (!state) return;
    setState((prev) =>
      prev
        ? {
            ...prev,
            issues: prev.issues.map((issue) =>
              issue.id === id ? { ...issue, ...(patch as Partial<Issue>) } : issue,
            ),
          }
        : prev,
    );
    try {
      const result = await api.updateIssue(id, { ...patch, actorId });
      setState((prev) =>
        prev
          ? { ...prev, issues: prev.issues.map((issue) => (issue.id === id ? result.issue : issue)) }
          : prev,
      );
      setDetailVersion((value) => value + 1);
      if (route === 'reports') setRevision((value) => value + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update issue', 'error');
      await refreshProject();
    }
  };

  const moveIssue = async (
    id: string,
    sprintId: string | null,
    beforeId: string | null,
    status?: Status,
  ) => {
    if (!state || !project) return;
    const moved = state.issues.find((issue) => issue.id === id);
    if (!moved) return;
    const targetStatus = status || moved.status;

    const nextIssues = state.issues.map((issue) =>
      issue.id === id ? { ...issue, sprintId, status: targetStatus } : issue,
    );
    setState({ ...state, issues: nextIssues });

    try {
      await api.updateIssue(id, { sprintId, status: targetStatus, actorId });
      const list = nextIssues
        .filter(
          (issue) =>
            issue.id !== id &&
            issue.sprintId === sprintId &&
            (!status || issue.status === targetStatus),
        )
        .sort(byRank);
      const index = beforeId ? list.findIndex((issue) => issue.id === beforeId) : -1;
      list.splice(index === -1 ? list.length : index, 0, { ...moved, sprintId, status: targetStatus });
      await api.reorder(project.id, list.map((issue) => issue.id));
      await refreshProject();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not move issue', 'error');
      await refreshProject();
    }
  };

  const createIssue = async (payload: IssuePayload) => {
    if (!project) return;
    const result = await api.createIssue(project.id, { ...payload, actorId });
    await refreshProject();
    setCreateDefaults(null);
    setDrawerId(result.issue.id);
    notify(`${result.issue.key} created`, 'success');
  };

  const deleteIssue = async (id: string) => {
    const issue = issues.find((candidate) => candidate.id === id);
    await api.deleteIssue(id);
    if (drawerId === id) setDrawerId(null);
    setState((prev) => (prev ? { ...prev, issues: prev.issues.filter((candidate) => candidate.id !== id) } : prev));
    setRevision((value) => value + 1);
    notify(issue ? `${issue.key} deleted` : 'Issue deleted', 'success');
  };

  const addComment = async (id: string, body: string) => {
    await api.addComment(id, { body, authorId: actorId });
    setDetailVersion((value) => value + 1);
    setRevision((value) => value + 1);
  };

  const bulkMove = async (ids: string[], sprintId: string | null) => {
    if (!project) return;
    try {
      await Promise.all(ids.map((id) => api.updateIssue(id, { sprintId, actorId })));
      await refreshProject();
      notify(`${ids.length} issue${ids.length === 1 ? '' : 's'} moved`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not move issues', 'error');
      await refreshProject();
    }
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.deleteIssue(id)));
      setState((prev) =>
        prev ? { ...prev, issues: prev.issues.filter((issue) => !ids.includes(issue.id)) } : prev,
      );
      setRevision((value) => value + 1);
      notify(`${ids.length} issue${ids.length === 1 ? '' : 's'} deleted`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete issues', 'error');
      await refreshProject();
    }
  };

  const createSprint = async (payload: { name?: string; goal?: string; startDate?: string | null; endDate?: string | null }) => {
    if (!project) return;
    await api.createSprint(project.id, payload);
    await refreshProject();
    notify('Sprint created', 'success');
  };

  const updateSprint = async (
    id: string,
    payload: { name?: string; goal?: string; startDate?: string | null; endDate?: string | null },
  ) => {
    await api.updateSprint(id, payload);
    await refreshProject();
    notify('Sprint updated', 'success');
  };

  const startSprint = async (id: string, payload: { startDate?: string; endDate?: string; goal?: string }) => {
    const result = await api.startSprint(id, { ...payload, actorId });
    setState(result.state);
    setRevision((value) => value + 1);
    notify(`${result.sprint.name} started`, 'success');
    navigate('board');
  };

  const completeSprint = async (id: string, moveIncompleteTo: string) => {
    const sprint = sprints.find((candidate) => candidate.id === id);
    const result = await api.completeSprint(id, { moveIncompleteTo, actorId });
    setState(result.state);
    setRevision((value) => value + 1);
    notify(`${sprint?.name || 'Sprint'} completed`, 'success');
  };

  const deleteSprint = async (id: string) => {
    const result = await api.deleteSprint(id);
    setState(result.state);
    setRevision((value) => value + 1);
    notify('Sprint deleted', 'success');
  };

  const saveMember = async (
    id: string | null,
    payload: { name: string; email?: string; role?: string; color?: string },
  ) => {
    if (id) await api.updateMember(id, payload);
    else await api.createMember(payload);
    const data = await api.bootstrap();
    setMembers(data.members);
    await refreshProject();
    notify(id ? 'Member updated' : 'Member added', 'success');
  };

  const deleteMember = async (id: string) => {
    await api.deleteMember(id);
    const data = await api.bootstrap();
    setMembers(data.members);
    setActorId((current) => (current === id ? data.members[0]?.id || null : current));
    await refreshProject();
    notify('Member removed', 'success');
  };

  const createProject = async (payload: { name: string; key: string; description?: string }) => {
    const result = await api.createProject(payload);
    const data = await api.bootstrap();
    setProjects(data.projects);
    setProjectId(result.project.id);
    setRoute('board');
    window.location.hash = `#/${result.project.key}/board`;
    notify(`${result.project.name} created`, 'success');
  };

  const switchProject = (id: string) => {
    if (id !== projectId) setState(null);
    setProjectId(id);
    const next = projects.find((candidate) => candidate.id === id);
    if (next) window.location.hash = `#/${next.key}/${route}`;
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setToasts([]);
      setAuth({ enabled: true, authed: false });
      setState(null);
      setProjects([]);
      setMembers([]);
    }
  };

  const drawerIssue = issues.find((issue) => issue.id === drawerId) || null;

  const openIssues = useMemo(() => issues.filter((issue) => issue.status !== 'done'), [issues]);

  if (!auth) {
    return (
      <div className="boot-screen">
        <Spinner label="Loading Forgeboard" />
      </div>
    );
  }

  if (auth.enabled && !auth.authed) {
    return (
      <Login
        onSuccess={() => {
          setToasts([]);
          setAuth({ enabled: true, authed: true });
        }}
        onError={(message) => notify(message, 'error')}
      />
    );
  }

  if (booting && !projects.length) {
    return (
      <div className="boot-screen">
        <Spinner label="Loading your workspace" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        project={project}
        projects={projects}
        sprints={sprints}
        issues={issues}
        members={members}
        actor={actor}
        route={route}
        authEnabled={auth.enabled}
        onNavigate={navigate}
        onSwitchProject={switchProject}
        onPickActor={setActorId}
        onNewIssue={() => openCreate()}
        onLogout={logout}
      />
      <div className="app-main">
        <TopBar
          project={project}
          route={route}
          activeSprint={activeSprint}
          onNewIssue={() => openCreate()}
          onNavigate={navigate}
        />
        <main className="page-scroll">
          {projects.length === 0 ? (
            <FirstRun onCreate={createProject} />
          ) : !project || (loadingProject && !state) ? (
            <div className="page-loading">
              <Spinner label="Loading project" />
            </div>
          ) : route === 'board' ? (
            <Board
              project={project}
              sprints={sprints}
              issues={issues}
              members={members}
              actorId={actorId}
              onOpenIssue={(id) => setDrawerId(id)}
              onCreate={openCreate}
              onMove={moveIssue}
              onCompleteSprint={completeSprint}
              onNavigateBacklog={() => navigate('backlog')}
            />
          ) : route === 'backlog' ? (
            <Backlog
              project={project}
              sprints={sprints}
              issues={issues}
              members={members}
              onOpenIssue={(id) => setDrawerId(id)}
              onCreate={openCreate}
              onMove={moveIssue}
              onCreateSprint={createSprint}
              onUpdateSprint={updateSprint}
              onStartSprint={startSprint}
              onCompleteSprint={completeSprint}
              onDeleteSprint={deleteSprint}
              onBulkMove={bulkMove}
              onBulkDelete={bulkDelete}
              onNotify={notify}
            />
          ) : route === 'reports' ? (
            <ReportsPage
              project={project}
              members={members}
              revision={revision}
              sprints={sprints}
              onOpenIssue={(id) => setDrawerId(id)}
              onNotify={notify}
            />
          ) : (
            <Team
              project={project}
              projects={projects}
              members={members}
              issues={openIssues}
              sprints={sprints}
              onSwitchProject={switchProject}
              onSaveMember={saveMember}
              onDeleteMember={deleteMember}
              onCreateProject={createProject}
              authEnabled={auth.enabled}
              onLogout={logout}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {drawerIssue && (
        <IssueDrawer
          issueId={drawerIssue.id}
          liveIssue={drawerIssue}
          members={members}
          sprints={sprints}
          issues={issues}
          actor={actor}
          detailVersion={detailVersion}
          onClose={() => setDrawerId(null)}
          onPatch={updateIssue}
          onDelete={deleteIssue}
          onAddComment={addComment}
          onOpenIssue={(id) => setDrawerId(id)}
          onNotify={notify}
        />
      )}

      {createDefaults && project && (
        <IssueModal
          project={project}
          sprints={sprints}
          members={members}
          issues={issues}
          defaults={createDefaults}
          actorId={actorId}
          onClose={() => setCreateDefaults(null)}
          onCreate={createIssue}
          onNotify={notify}
        />
      )}

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </div>
  );
}
