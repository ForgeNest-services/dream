import { colors } from '@/lib/design-tokens';

// Signature line-art motif: a key turning into an open door — the moment a
// business "opens up" its first app. Reused (at different sizes) across the
// empty apps state and the business setup step so the two moments read as
// one story rather than two unrelated illustrations.
export function HospitalityMark({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
    >
      <circle cx="48" cy="48" r="47" stroke={colors.neutral[200]} strokeWidth="1" />
      <path
        d="M30 48 H62"
        stroke={colors.primary[300]}
        strokeWidth="1.5"
        strokeDasharray="1 5"
        strokeLinecap="round"
      />
      {/* door frame */}
      <path
        d="M40 66 V32 a4 4 0 0 1 4-4 h8 a4 4 0 0 1 4 4 v34"
        stroke={colors.primary[800]}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M34 66 H62" stroke={colors.primary[800]} strokeWidth="2.5" strokeLinecap="round" />
      {/* door handle, in accent to draw the eye */}
      <circle cx="55" cy="49" r="2.4" fill={colors.accent[500]} />
    </svg>
  );
}
