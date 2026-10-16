import type { ReactNode, SVGProps } from 'react';

// Geometry follows the Lucide icon language: consistent 24px outline paths,
// rounded joins and semantic names. Kept local because the deployment runtime
// currently mounts node_modules read-only.

export type UiIconName =
  | 'activity'
  | 'arrow-left'
  | 'bar-chart'
  | 'building'
  | 'calendar'
  | 'calendar-check'
  | 'check'
  | 'check-circle'
  | 'chevron-right'
  | 'chevron-down'
  | 'clock'
  | 'copy'
  | 'document'
  | 'edit'
  | 'email'
  | 'help'
  | 'map-pin'
  | 'menu'
  | 'more'
  | 'note'
  | 'person'
  | 'phone'
  | 'plus'
  | 'send'
  | 'search'
  | 'settings'
  | 'tag'
  | 'trophy'
  | 'users'
  | 'whatsapp';

interface Props extends SVGProps<SVGSVGElement> {
  name: UiIconName;
}

const paths: Record<UiIconName, ReactNode> = {
  person: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c.6-4 2.8-6 7-6s6.4 2 7 6" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20" />
      <circle cx="10" cy="7" r="3" />
      <path d="M16 4.5a3 3 0 0 1 0 5.8M20 20v-1.5a4.5 4.5 0 0 0-3-4.2" />
    </>
  ),
  phone: (
    <path d="M7 4 4.5 6.5c-.5.5-.5 1.3-.1 1.9 2.1 3.5 5.2 6.6 8.7 8.7.6.4 1.4.4 1.9-.1l2.5-2.5-3-3-1.7 1.7a15 15 0 0 1-5.2-5.2l1.7-1.7-3-3Z" />
  ),
  document: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M15 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  edit: (
    <>
      <path d="m4 16-.8 4.8L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17Z" />
      <path d="m14.5 7.5 2 2" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8 20h8M9 17h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  'calendar-check': (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16m4 4-2 2-1-1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  whatsapp: (
    <>
      <path d="M20 11.5a8 8 0 0 1-11.7 7L4 20l1.5-4.2A8 8 0 1 1 20 11.5Z" />
      <path d="M9 8.5c.3 2 1.5 3.2 3.5 4.2l1-.9c.3-.3.7-.3 1-.1l1.1.7" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  note: (
    <>
      <path d="M5 5h14v11H8l-3 3z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="m15 18-6-6 6-6M9 12h11" />
    </>
  ),
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  more: (
    <>
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  send: (
    <>
      <path d="m3 11 18-8-8 18-2-8-8-2Z" />
      <path d="m11 13 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  settings: (
    <>
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      <path d="m4.9 4.9 1.4 1.4m11.4-1.4-1.4 1.4M4 12H2m20 0h-2M4.9 19.1l1.4-1.4m11.4 1.4-1.4-1.4M12 2v2m0 16v2" />
    </>
  ),
  tag: <path d="M20 13 13 20l-9-9V4h7l9 9ZM7.5 7.5h.01" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.3 2.3 0 1 1 3.9 1.7c-.9.8-1.7 1.2-1.7 2.6M12 17h.01" />
    </>
  ),
  'bar-chart': (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V6l8-3 8 3v15" />
      <path d="M2 21h20M8 9h1M8 13h1M8 17h1M15 9h1M15 13h1M15 17h1" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  activity: <path d="m3 12 4-4 4 8 4-6 3 3 3-3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
};

export function UiIcon({ name, className = '', ...props }: Props) {
  return (
    <svg
      aria-hidden="true"
      className={`ui-icon ${className}`.trim()}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
