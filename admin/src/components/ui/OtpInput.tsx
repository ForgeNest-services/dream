'use client';

import { OTPInput, type SlotProps } from 'input-otp';
import { colors, spacing } from '@/lib/design-tokens';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  hasError?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  onComplete,
  autoFocus,
  hasError,
}: OtpInputProps) {
  return (
    <OTPInput
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      maxLength={length}
      disabled={disabled}
      autoFocus={autoFocus}
      containerClassName="otp-container"
      render={({ slots }) => (
        <div
          style={{
            display: 'flex',
            gap: spacing.sm,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {slots.map((slot, idx) => (
            <Slot key={idx} {...slot} disabled={disabled} hasError={hasError} />
          ))}
        </div>
      )}
    />
  );
}

function Slot({
  char,
  isActive,
  hasFakeCaret,
  disabled,
  hasError,
}: SlotProps & { disabled?: boolean; hasError?: boolean }) {
  const borderColor = hasError
    ? colors.status.error
    : isActive
      ? colors.primary[800]
      : colors.neutral[200];

  return (
    <div
      style={{
        width: '48px',
        height: '56px',
        borderRadius: '12px',
        border: `2px solid ${borderColor}`,
        backgroundColor: disabled ? colors.neutral[100] : colors.neutral[0],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px',
        fontWeight: '600',
        color: colors.neutral[900],
        fontFamily: 'monospace',
        transition: 'all 0.15s ease',
        boxShadow: isActive ? `0 0 0 4px ${colors.primary[800]}22` : 'none',
        position: 'relative',
      }}
    >
      {char !== null && char}
      {hasFakeCaret && (
        <span
          style={{
            position: 'absolute',
            width: '2px',
            height: '24px',
            backgroundColor: colors.primary[800],
            animation: 'otp-caret-blink 1s step-end infinite',
          }}
        />
      )}
    </div>
  );
}
