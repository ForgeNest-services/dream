'use client';

import { colors } from '@/lib/design-tokens';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Switch({ checked, onChange, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: '38px',
        height: '22px',
        borderRadius: '9999px',
        border: 'none',
        padding: '2px',
        backgroundColor: checked ? colors.primary[800] : colors.neutral[300],
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background-color 0.15s',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
      }}
      {...rest}
    >
      <span
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: colors.neutral[0],
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}
