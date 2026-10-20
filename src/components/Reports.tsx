import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type {
  Burndown,
  Member,
  Project,
  Reports,
  Sprint,
  Status,
  VelocityPoint,
} from '../types';
import {
  STATUSES,
  STATUS_META,
  TYPE_META,
  formatDate,
  formatRange,
  pluralize,
  relativeTime,
} from '../lib';
import {
  ActivityIcon,
  CalendarIcon,
  ReportsIcon,
  StatusIcon,
  TypeIcon,
} from '../icons';
import { Avatar, EmptyState, Spinner, type Toast } from './ui';

const CHART = { width: 720, height: 260, left: 40, right: 16, top: 18, bottom: 34 };

function niceMax(value: number) {
  if (value <= 0) return 10;
  const step = value <= 20 ? 5 : value <= 60 ? 10 : 20;
  return Math.ceil(value / step) * step;
}

function VelocityChart({ data }: { data: VelocityPoint[] }) {
  if (!data.length) {
    return <div className="chart-empty">Complete a sprint to start building velocity.</div>;
  }
  const max = niceMax(Math.max(...data.flatMap((point) => [point.committed, point.completed])));
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const group = plotWidth / data.length;
  const barWidth = Math.min(26, group * 0.28);
  const y = (value: number) => CHART.top + plotHeight - (value / max) * plotHeight;

  return (
    <div className="chart-block">
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="chart" role="img" aria-label="Committed and completed points per sprint">
        <defs>
          <linearGradient id="velocityBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c66e4" />
            <stop offset="100%" stopColor="#388bff" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = max * fraction;
          return (
            <g key={fraction}>
              <line
                x1={CHART.left}
                x2={CHART.width - CHART.right}
                y1={y(value)}
                y2={y(value)}
                className="grid-line"
              />
              <text x={CHART.left - 8} y={y(value) + 4} className="axis-label" textAnchor="end">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        {data.map((point, index) => {
          const center = CHART.left + group * index + group / 2;
          return (
            <g key={point.id}>
              <rect
                x={center - barWidth - 3}
                y={y(point.committed)}
                width={barWidth}
                height={Math.max(2, CHART.top + plotHeight - y(point.committed))}
                rx={4}
                className="velocity-committed"
              >
                <title>{`${point.name}: ${point.committed} committed`}</title>
              </rect>
              <rect
                x={center + 3}
                y={y(point.completed)}
                width={barWidth}
                height={Math.max(2, CHART.top + plotHeight - y(point.completed))}
                rx={4}
                fill="url(#velocityBar)"
              >
                <title>{`${point.name}: ${point.completed} completed`}</title>
              </rect>
              <text x={center} y={CHART.height - 12} className="axis-label" textAnchor="middle">
                {point.name.replace(/^Sprint\s*/i, 'S')}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-swatch committed" /> Committed
        </span>
        <span>
          <i className="legend-swatch completed" /> Completed
        </span>
      </div>
    </div>
  );
}

function BurndownChart({ data }: { data: Burndown }) {
  const points = data.series;
  const max = niceMax(Math.max(data.totalPoints, data.committedPoints, ...points.map((point) => point.ideal)));
  const plotWidth = 860 - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const x = (index: number) => CHART.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => CHART.top + plotHeight - (value / max) * plotHeight;
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.remaining)}`).join(' ');
  const idealLine = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.ideal)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const last = points[points.length - 1];
  const todayIndex = points.findIndex((point) => point.date === data.today);

  return (
    <div className="chart-block">
      <svg viewBox="0 0 860 260" className="chart" role="img" aria-label="Sprint burndown chart">
        <defs>
          <linearGradient id="burnArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c66e4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0c66e4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = max * fraction;
          return (
            <g key={fraction}>
              <line
                x1={CHART.left}
                x2={860 - CHART.right}
                y1={y(value)}
                y2={y(value)}
                className="grid-line"
              />
              <text x={CHART.left - 8} y={y(value) + 4} className="axis-label" textAnchor="end">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#burnArea)" />
        <path d={idealLine} className="ideal-line" />
        <path d={line} className="burn-line" />
        {points.map((point, index) => (
          <g key={point.date}>
            {index === todayIndex && (
              <line x1={x(index)} x2={x(index)} y1={CHART.top} y2={CHART.top + plotHeight} className="today-line" />
            )}
            <circle cx={x(index)} cy={y(point.remaining)} r={3.6} className="burn-dot">
              <title>{`${formatDate(point.date)}: ${point.remaining} points remaining`}</title>
            </circle>
          </g>
        ))}
        <text x={CHART.left} y={CHART.height - 12} className="axis-label">
          {formatDate(points[0]?.date)}
        </text>
        <text x={860 - CHART.right} y={CHART.height - 12} className="axis-label" textAnchor="end">
          {formatDate(points[points.length - 1]?.date)}
        </text>
        {last && (
          <text x={860 - CHART.right} y={CHART.top + 12} className="axis-label" textAnchor="end">
            {last.remaining} pts remaining
          </text>
        )}
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-swatch remaining" /> Remaining
        </span>
        <span>
          <i className="legend-line ideal" /> Ideal burn
        </span>
        {data.endDate && (
          <span className="legend-muted">
            <CalendarIcon size={12} /> Sprint ends {formatDate(data.endDate)}
          </span>
        )}
      </div>
    </div>
  );
}

export function ReportsPage({
  project,
  members,
  revision,
  sprints,
  onNotify,
}: {
  project: Project;
  members: Member[];
  revision: number;
  sprints: Sprint[];
  onOpenIssue: (id: string) => void;
  onNotify: (message: string, tone?: Toast['tone']) => void;
}) {
  const [data, setData] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .reports(project.id, focusId || undefined)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        if (!cancelled) onNotify(error instanceof Error ? error.message : 'Could not load reports', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, revision, focusId, onNotify]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const closed = data?.sprints.filter((sprint) => sprint.state === 'closed') || [];
  const lastClosed = closed[closed.length - 1] || null;
  const averageVelocity = closed.length
    ? Math.round(
        (closed.slice(-3).reduce((sum, sprint) => sum + sprint.completedPoints, 0) / Math.min(3, closed.length)) * 10,
      ) / 10
    : 0;
  const delivery = lastClosed?.committedPoints
    ? Math.round((lastClosed.completedPoints / lastClosed.committedPoints) * 100)
    : 0;
  const maxWorkload = Math.max(1, ...(data?.workload.map((entry) => entry.points) || [1]));
  const burndownOptions = sprints.filter((sprint) => sprint.state !== 'future');

  return (
    <div className="page reports-page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="page-sub">How the team is pacing, without a separate analytics tool.</p>
        </div>
        <div className="page-actions">
          <label className="inline-select">
            <span>Burndown for</span>
            <select
              value={data?.focus?.id || ''}
              onChange={(event) => setFocusId(event.target.value)}
              className="select compact"
            >
              {burndownOptions.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                  {sprint.state === 'active' ? ' · active' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && !data ? (
        <div className="page-loading">
          <Spinner label="Crunching sprint data" />
        </div>
      ) : !data ? (
        <EmptyState icon={<ReportsIcon size={24} />} title="No report data yet" description="Start and complete a sprint to unlock velocity and burndown." />
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-label">Average velocity</span>
              <strong className="stat-value">{averageVelocity}<small> pts</small></strong>
              <span className="stat-foot">Last {Math.min(3, closed.length) || 0} completed sprints</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Last sprint delivery</span>
              <strong className="stat-value">{delivery}%</strong>
              <div className="mini-progress wide">
                <span style={{ width: `${Math.min(100, delivery)}%` }} />
              </div>
              <span className="stat-foot">{lastClosed ? `${lastClosed.name} · ${lastClosed.completedPoints}/${lastClosed.committedPoints} pts` : 'No closed sprint yet'}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Open points</span>
              <strong className="stat-value">{data.totals.openPoints}</strong>
              <span className="stat-foot">Across {pluralize(data.totals.issues - data.totals.done, 'open issue')}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Delivered all time</span>
              <strong className="stat-value">{data.totals.donePoints}<small> pts</small></strong>
              <span className="stat-foot">{data.totals.done} of {data.totals.issues} issues done</span>
            </div>
          </div>

          <div className="report-grid">
            <section className="surface report-card span-2">
              <header className="card-head">
                <div>
                  <h2>Sprint velocity</h2>
                  <p>Committed vs completed story points.</p>
                </div>
                <span className="card-badge">{pluralize(closed.length, 'closed sprint')}</span>
              </header>
              <VelocityChart data={data.velocity} />
            </section>

            <section className="surface report-card">
              <header className="card-head">
                <div>
                  <h2>Team workload</h2>
                  <p>Open points per person.</p>
                </div>
              </header>
              {data.workload.length === 0 ? (
                <div className="chart-empty">Nothing open. Enjoy the quiet.</div>
              ) : (
                <ul className="workload-list">
                  {data.workload.map((entry) => {
                    const member = entry.assigneeId ? memberById.get(entry.assigneeId) : null;
                    const segments = STATUSES.map((status) => ({
                      status,
                      value: entry.byStatus[status] || 0,
                    })).filter((segment) => segment.value > 0);
                    return (
                      <li key={entry.assigneeId || 'unassigned'}>
                        <div className="workload-row">
                          <Avatar member={member} size={22} />
                          <span className="workload-name">{member?.name || 'Unassigned'}</span>
                          <span className="workload-value">{entry.points} pts</span>
                          <span className="workload-count">{pluralize(entry.open, 'issue')}</span>
                        </div>
                        <div className="workload-bar">
                          <div
                            className="workload-fill"
                            style={{ width: `${Math.max(4, (entry.points / maxWorkload) * 100)}%` }}
                          >
                            {segments.map((segment) => (
                              <i
                                key={segment.status}
                                style={{
                                  background: STATUS_META[segment.status].color,
                                  flex: segment.value,
                                }}
                                title={`${segment.value} ${STATUS_META[segment.status].label}`}
                              />
                            ))}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="surface report-card span-3">
              <header className="card-head">
                <div>
                  <h2>Burndown</h2>
                  <p>
                    {data.burndown
                      ? `${data.burndown.sprintName} · ${data.burndown.totalPoints} points in scope`
                      : 'No sprint to burn down yet.'}
                  </p>
                </div>
                {data.burndown && (
                  <div className="burndown-stats">
                    <span>
                      <strong>{data.burndown.totalPoints}</strong> scope
                    </span>
                    <span>
                      <strong>{data.burndown.committedPoints}</strong> committed
                    </span>
                  </div>
                )}
              </header>
              {data.burndown ? <BurndownChart data={data.burndown} /> : <div className="chart-empty">Start a sprint to see the burndown.</div>}
            </section>

            <section className="surface report-card span-2">
              <header className="card-head">
                <div>
                  <h2>Sprint history</h2>
                  <p>Every sprint, committed against delivered.</p>
                </div>
              </header>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sprint</th>
                      <th>Dates</th>
                      <th className="num">Committed</th>
                      <th className="num">Completed</th>
                      <th>Delivery</th>
                      <th>State</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.sprints].reverse().map((sprint) => {
                      const rate = sprint.committedPoints
                        ? Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
                        : sprint.totalPoints
                          ? Math.round((sprint.completedPoints / sprint.totalPoints) * 100)
                          : 0;
                      return (
                        <tr key={sprint.id} className={data.focus?.id === sprint.id ? 'is-focus' : ''}>
                          <td>
                            <div className="table-sprint">
                              {sprint.state === 'active' ? <span className="live-dot" /> : <SprintDot state={sprint.state} />}
                              <strong>{sprint.name}</strong>
                            </div>
                          </td>
                          <td className="muted">{formatRange(sprint.startDate, sprint.endDate)}</td>
                          <td className="num">{sprint.committedPoints || '—'}</td>
                          <td className="num">{sprint.completedPoints}</td>
                          <td>
                            <div className="delivery-cell">
                              <div className="mini-progress">
                                <span
                                  style={{
                                    width: `${Math.min(100, rate)}%`,
                                    background: rate >= 80 ? '#1f845a' : rate >= 50 ? '#e56910' : '#c9372c',
                                  }}
                                />
                              </div>
                              <span>{sprint.state === 'future' ? '—' : `${rate}%`}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`state-pill ${sprint.state}`}>{sprint.state}</span>
                          </td>
                          <td className="num muted">
                            {sprint.state === 'active' ? relativeTime(sprint.startedAt) : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="surface report-card">
              <header className="card-head">
                <div>
                  <h2>Issue mix</h2>
                  <p>Where the work sits.</p>
                </div>
              </header>
              <div className="mix-list">
                {(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((type) => {
                  const count = data.distribution.type[type] || 0;
                  const total = data.totals.issues || 1;
                  return (
                    <div key={type} className="mix-row">
                      <TypeIcon type={type} size={14} />
                      <span className="mix-label">{TYPE_META[type].label}</span>
                      <div className="mini-progress">
                        <span style={{ width: `${(count / total) * 100}%`, background: TYPE_META[type].color }} />
                      </div>
                      <span className="mix-value">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="status-split">
                {STATUSES.map((status: Status) => (
                  <div key={status} className="status-split-item">
                    <StatusIcon status={status} size={13} />
                    <span>{STATUS_META[status].label}</span>
                    <strong>{data.distribution.status[status] || 0}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="report-footnote">
            <ActivityIcon size={13} /> Burndown uses the sprint scope captured at start. Points added mid-sprint still count
            against the team's open work.
          </div>
        </>
      )}
    </div>
  );
}

function SprintDot({ state }: { state: Sprint['state'] }) {
  return <span className={`sprint-dot ${state}`} />;
}
