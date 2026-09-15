/*
  HeroIllustration
  ================
  An original line-art illustration rather than a stock photograph. Two
  reasons: no real photography exists yet (the organization hasn't
  supplied any, and I'm not sourcing images of real people to stand in
  for a real home health organization), and a considered illustration in
  the brand palette says more than a generic stock photo of a smiling
  stranger would anyway.

  The motif: a home, held - simple, warm, and literal without being cute.
*/

export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 480 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Illustration of a house held gently within two curved lines, suggesting care given at home"
      className="h-full w-full"
    >
      <circle cx="240" cy="200" r="190" fill="var(--color-sage)" />

      {/* The encircling arc - "care that surrounds" */}
      <path
        d="M70 260C50 180 110 90 220 68"
        stroke="var(--color-marigold)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M410 150C428 232 372 320 262 340"
        stroke="var(--color-marigold)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* The house */}
      <g>
        <path
          d="M150 230L240 155L330 230V310C330 315.523 325.523 320 320 320H160C154.477 320 150 315.523 150 310V230Z"
          fill="var(--color-paper)"
          stroke="var(--color-pine)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M130 240L240 148L350 240"
          stroke="var(--color-pine)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Door */}
        <rect
          x="215"
          y="255"
          width="50"
          height="65"
          rx="4"
          fill="var(--color-pine)"
        />
        {/* Window */}
        <rect
          x="180"
          y="255"
          width="24"
          height="24"
          rx="2"
          stroke="var(--color-pine)"
          strokeWidth="4"
        />
        <rect
          x="276"
          y="255"
          width="24"
          height="24"
          rx="2"
          stroke="var(--color-pine)"
          strokeWidth="4"
        />
      </g>

      {/* A small mark above the door - a simple heart, standing for the
          human presence a visit brings, kept plain rather than sentimental */}
      <path
        d="M240 205C240 205 226 195.5 226 185.5C226 179.7 230.5 175 236 175C238.5 175 240 176.5 240 176.5C240 176.5 241.5 175 244 175C249.5 175 254 179.7 254 185.5C254 195.5 240 205 240 205Z"
        fill="var(--color-marigold)"
      />
    </svg>
  );
}
