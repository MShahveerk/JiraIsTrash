import type { IssueType, Priority, Status } from './types';
import { PRIORITY_META, STATUS_META, TYPE_META } from './lib';

type IconProps = { size?: number; className?: string };

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
}

export const BoardIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="2.2" y="2.8" width="4.6" height="10.4" rx="1.3" />
    <rect x="9.2" y="2.8" width="4.6" height="6.4" rx="1.3" />
  </svg>
);

export const BacklogIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 4.2h10M3 8h10M3 11.8h6" />
    <path d="M12.6 10.4v3.4M11 12.1h3.2" strokeWidth="1.4" />
  </svg>
);

export const ReportsIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2.5 13.5h11" />
    <rect x="3.2" y="8.4" width="2.6" height="3.4" rx="0.7" />
    <rect x="6.8" y="5" width="2.6" height="6.8" rx="0.7" />
    <rect x="10.4" y="2.6" width="2.6" height="9.2" rx="0.7" />
  </svg>
);

export const TeamIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="6.2" cy="5.6" r="2.4" />
    <path d="M2.4 13.2c0-2.1 1.7-3.6 3.8-3.6s3.8 1.5 3.8 3.6" />
    <path d="M10.8 4.2a2.2 2.2 0 0 1 0 4.2M11.4 9.9c1.5.3 2.5 1.6 2.5 3.3" />
  </svg>
);

export const PlusIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 3.2v9.6M3.2 8h9.6" />
  </svg>
);

export const SearchIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="7.2" cy="7.2" r="4.4" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);

export const CloseIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const GripIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
    <circle cx="6" cy="4" r="1.1" />
    <circle cx="10" cy="4" r="1.1" />
    <circle cx="6" cy="8" r="1.1" />
    <circle cx="10" cy="8" r="1.1" />
    <circle cx="6" cy="12" r="1.1" />
    <circle cx="10" cy="12" r="1.1" />
  </svg>
);

export const ChevronDownIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export const ChevronRightIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);

export const DotsIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
    <circle cx="3.5" cy="8" r="1.25" />
    <circle cx="8" cy="8" r="1.25" />
    <circle cx="12.5" cy="8" r="1.25" />
  </svg>
);

export const CheckIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3.2 8.4l3 3 6.6-6.8" />
  </svg>
);

export const PlayIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M5 3.4l7 4.6-7 4.6V3.4z" />
  </svg>
);

export const TrashIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 4.6h10M6.4 4.6V3.2h3.2v1.4M4.4 4.6l.6 8a1.4 1.4 0 0 0 1.4 1.3h3.2a1.4 1.4 0 0 0 1.4-1.3l.6-8" />
  </svg>
);

export const EditIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M10.6 2.8l2.6 2.6-8 8-3.4.8.8-3.4 8-8z" />
  </svg>
);

export const MessageIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M13.5 8.2c0 2.6-2.5 4.6-5.5 4.6-.7 0-1.4-.1-2-.3l-3 1 1-2.4c-.9-.8-1.5-1.8-1.5-2.9 0-2.5 2.5-4.6 5.5-4.6s5.5 2.1 5.5 4.6z" />
  </svg>
);

export const ActivityIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2.2 8.4h3l1.8-4.6 2.4 8 1.8-4.4h2.6" />
  </svg>
);

export const CalendarIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.6" />
    <path d="M2.4 6.6h11.2M5.4 2.2v2.4M10.6 2.2v2.4" />
  </svg>
);

export const LogoutIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6.2 3H4.4A1.4 1.4 0 0 0 3 4.4v7.2A1.4 1.4 0 0 0 4.4 13h1.8" />
    <path d="M10 5.4L12.6 8 10 10.6M6.6 8h6" />
  </svg>
);

export const SettingsIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1" />
  </svg>
);

export const FolderIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2.2 4.4c0-.7.6-1.3 1.3-1.3h2.4l1.3 1.6h5.3c.7 0 1.3.6 1.3 1.3v5.6c0 .7-.6 1.3-1.3 1.3H3.5c-.7 0-1.3-.6-1.3-1.3V4.4z" />
  </svg>
);

export const SprintIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.6v3.2H9.8" />
  </svg>
);

export const FlagIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 14V2.6" />
    <path d="M4.6 3.2l7.8 2.7-7.8 2.7V3.2z" fill="currentColor" stroke="none" />
  </svg>
);

export const AlertIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 2.4l6 11H2l6-11z" />
    <path d="M8 6.2v3.2M8 11.6v.2" />
  </svg>
);

export const ArrowRightIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2.6 8h10M9 4.4L12.6 8 9 11.6" />
  </svg>
);

export const FilterIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2.4 3.4h11.2L9.3 8.6v4l-2.6 1.2V8.6L2.4 3.4z" />
  </svg>
);

const typePaths: Record<IssueType, React.ReactNode> = {
  story: <path d="M4 2.4h8a1.1 1.1 0 0 1 1.1 1.1v10.1L8 10.5l-5.1 3.1V3.5A1.1 1.1 0 0 1 4 2.4z" fill="currentColor" />,
  task: (
    <>
      <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.3 8.3l1.8 1.8 3.6-3.8" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </>
  ),
  bug: (
    <>
      <circle cx="8" cy="8.6" r="4.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.4V2.6M5.4 3.4l.9 1.5M10.6 3.4l-.9 1.5M3.8 6.8H2.2M12.2 6.8h1.6M4.1 10.4l-1.4.9M11.9 10.4l1.4.9" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  epic: <path d="M9.4 1.8L3 9h4.1l-1 5.2L13 7H8.9l.5-5.2z" fill="currentColor" />,
};

export const TypeIcon = ({ type, size = 16, className }: { type: IssueType; size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    style={{ color: TYPE_META[type].color }}
    aria-label={TYPE_META[type].label}
    role="img"
  >
    {typePaths[type]}
  </svg>
);

export const PriorityIcon = ({ priority, size = 14, className }: { priority: Priority; size?: number; className?: string }) => {
  const level = PRIORITY_META[priority].level;
  const color = PRIORITY_META[priority].color;
  const arrow = (y: number, up: boolean) => (
    <path
      d={up ? `M4 ${y + 3}l4-3 4 3` : `M4 ${y}l4 3 4-3`}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={{ color }} aria-label={PRIORITY_META[priority].label} role="img">
      {level === 4 && (
        <>
          {arrow(1.6, true)}
          {arrow(6, true)}
        </>
      )}
      {level === 3 && arrow(3.4, true)}
      {level === 2 && (
        <>
          <path d="M4 6h8M4 9.4h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}
      {level === 1 && arrow(8.6, false)}
      {level === 0 && (
        <>
          {arrow(7.4, false)}
          {arrow(11.6, false)}
        </>
      )}
    </svg>
  );
};

export const StatusIcon = ({ status, size = 15, className }: { status: Status; size?: number; className?: string }) => {
  const color = STATUS_META[status].color;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={{ color }} aria-hidden>
      {status === 'todo' && <circle cx="8" cy="8" r="5.1" stroke="currentColor" strokeWidth="1.7" strokeDasharray="2.2 2.2" />}
      {status === 'in_progress' && (
        <>
          <circle cx="8" cy="8" r="5.1" stroke="currentColor" strokeWidth="1.7" opacity="0.35" />
          <path d="M8 2.9a5.1 5.1 0 0 1 0 10.2z" fill="currentColor" />
        </>
      )}
      {status === 'in_review' && (
        <>
          <circle cx="8" cy="8" r="5.1" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="8" cy="8" r="2.3" fill="currentColor" />
        </>
      )}
      {status === 'done' && (
        <>
          <circle cx="8" cy="8" r="5.6" fill="currentColor" />
          <path d="M5.5 8.2l1.8 1.8 3.3-3.6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
};
