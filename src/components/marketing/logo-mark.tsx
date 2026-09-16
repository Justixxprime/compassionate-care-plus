/*
  LogoMark
  ========
  An original mark, not a placeholder and not a generic medical cross or
  caduceus (the brief is explicit about avoiding that cliche). The idea:
  an open arc cradling a small warm point of light - care that shelters
  without closing in. Pine for the arc, marigold for the point at its
  center.

  Built to work small (favicon-sized, header-sized) as well as large -
  no fine detail that disappears below 24px.
*/

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Cheliv Compassionate Care Plus"
      className={className}
    >
      <path
        d="M31.5 12C29 7.5 24.5 4.5 19.3 4.5 11.4 4.5 5 10.9 5 18.8s6.4 14.3 14.3 14.3c5.2 0 9.7-2.8 12.2-7"
        stroke="var(--color-pine)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="20" cy="18.8" r="4.5" fill="var(--color-marigold)" />
    </svg>
  );
}
