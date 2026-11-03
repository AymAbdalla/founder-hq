// Inline icons drawn from the approved design: 16x16 grid, one 1.5 stroke, round ends.
// Decorative: every use sits next to a visible text label.

const PATHS = {
  today: (
    <>
      <rect x="2.5" y="3" width="11" height="10.5" rx="2" />
      <path d="M2.5 6.5h11M5.5 1.5v3M10.5 1.5v3" />
      <rect x="5" y="8.6" width="2.2" height="2.2" rx=".4" fill="currentColor" stroke="none" />
    </>
  ),
  inbox: (
    <>
      <path d="M2 9.5 3.8 3.6A1.5 1.5 0 0 1 5.2 2.5h5.6a1.5 1.5 0 0 1 1.4 1.1L14 9.5v2.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12z" />
      <path d="M2 9.5h3.2l1 1.5h3.6l1-1.5H14" />
    </>
  ),
  projects: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  plans: (
    <>
      <rect x="2" y="2.5" width="3" height="3" rx=".6" />
      <path d="M7.5 4h6.5M7.5 8h6.5M7.5 12h6.5" />
      <rect x="2" y="10.5" width="3" height="3" rx=".6" />
      <path d="m2.4 8 .9.9L5 7.2" />
    </>
  ),
  all: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3.5 3.5" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" />,
  tick: <path d="m3.5 8.3 2.9 2.9 6-6.4" />,
  bell: (
    <>
      <path d="M4 11.5V7.2a4 4 0 0 1 8 0v4.3l1.2 1.2H2.8z" />
      <path d="M6.6 14.2a1.5 1.5 0 0 0 2.8 0" />
    </>
  ),
  idea: (
    <>
      <path d="M6 11.5c0-1.4-2-2.4-2-5a4 4 0 0 1 8 0c0 2.6-2 3.6-2 5z" />
      <path d="M6.3 13.8h3.4" />
    </>
  ),
  feature: (
    <>
      <path d="M8 2 9.6 6.2 14 6.4l-3.4 2.8 1.2 4.3L8 11l-3.8 2.5 1.2-4.3L2 6.4l4.4-.2z" />
    </>
  ),
  wait: (
    <>
      <path d="M4.5 2h7M4.5 14h7" />
      <path d="M5.5 2v2.2c0 1.3 2.5 2.4 2.5 3.8 0 1.4-2.5 2.5-2.5 3.8V14M10.5 2v2.2c0 1.3-2.5 2.4-2.5 3.8 0 1.4 2.5 2.5 2.5 3.8V14" />
    </>
  ),
  moon: <path d="M13.5 9.8A5.8 5.8 0 0 1 6.2 2.5a5.8 5.8 0 1 0 7.3 7.3z" />,
  sun: (
    <>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg className={`i i-${name} ${className}`.trim()} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

// The Founder HQ mark: four squares, one green. Provisional (design notes).
export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <rect className="m-dim" x="1" y="1" width="7" height="7" rx="1.5" />
      <rect className="m-dim" x="10" y="1" width="7" height="7" rx="1.5" />
      <rect className="m-dim" x="1" y="10" width="7" height="7" rx="1.5" />
      <rect className="m-on" x="10" y="10" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <Mark />
      <span>Founder HQ</span>
    </div>
  );
}
