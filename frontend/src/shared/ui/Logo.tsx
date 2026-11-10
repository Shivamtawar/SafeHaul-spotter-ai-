/** The SafeHaul mark: a road curving to a safe haven, in a navy rounded square. */
export function LogoMark({ title }: { title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <rect width="32" height="32" rx="9" fill="#081836" />
      <path
        d="M7 23c5 0 4-9 9-9s3.5-5 9-5"
        fill="none"
        stroke="#c3e0e2"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="9 6"
      />
      <circle cx="7" cy="23" r="2.6" fill="#158280" />
      <circle cx="25" cy="9" r="3.4" fill="#fc4c64" />
      <path
        d="m23.6 9 1 1 1.9-2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      SafeHaul
    </span>
  )
}
