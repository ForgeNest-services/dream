'use client';

import { InputHTMLAttributes, useState, ReactNode } from 'react';
import { MdOutlineVisibility, MdOutlineVisibilityOff } from 'react-icons/md';
import { colors, radius, spacing } from '@/lib/design-tokens';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  showPasswordToggle?: boolean;
}

export function FormInput({
  label,
  error,
  icon,
  showPasswordToggle,
  type = 'text',
  disabled,
  ...props
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div style={{ marginBottom: spacing.lg }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: colors.neutral[700],
            marginBottom: spacing.sm,
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        {icon && (
          <div
            style={{
              position: 'absolute',
              left: spacing.lg,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.neutral[400],
              fontSize: '18px',
            }}
          >
            {icon}
          </div>
        )}

        <input
          type={inputType}
          disabled={disabled}
          style={{
            width: '100%',
            padding: `${spacing.md} ${spacing.lg}`,
            paddingLeft: icon ? '44px' : spacing.lg,
            paddingRight: showPasswordToggle && isPassword ? '44px' : spacing.lg,
            border: `1px solid ${error ? colors.status.error : colors.neutral[200]}`,
            borderRadius: radius.md,
            backgroundColor: disabled ? colors.neutral[100] : colors.neutral[0],
            fontSize: '16px',
            fontFamily: 'inherit',
            color: colors.neutral[900],
            transition: 'all 0.2s',
            outline: 'none',
            boxShadow: error ? `0 0 0 3px ${colors.status.error}20` : undefined,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? colors.status.error : colors.primary[400];
            e.currentTarget.style.boxShadow = error
              ? `0 0 0 3px ${colors.status.error}20`
              : `0 0 0 3px ${colors.primary[400]}20`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? colors.status.error : colors.neutral[200];
            e.currentTarget.style.boxShadow = 'none';
          }}
          {...props}
        />

        {showPasswordToggle && isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: spacing.lg,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: colors.neutral[500],
              fontSize: '18px',
              opacity: disabled ? 0.5 : 1,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            disabled={disabled}
          >
            {showPassword ? <MdOutlineVisibilityOff size={20} /> : <MdOutlineVisibility size={20} />}
          </button>
        )}
      </div>

      {error && (
        <p
          style={{
            fontSize: '13px',
            color: colors.status.error,
            marginTop: spacing.sm,
            fontWeight: '500',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
