'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { colors, radius, spacing } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: ReactNode;
}

const variantStyles = {
  primary: {
    background: colors.primary[400],
    color: colors.neutral[0],
    hover: colors.primary[500],
    border: `1px solid ${colors.primary[400]}`,
  },
  secondary: {
    background: colors.neutral[100],
    color: colors.neutral[900],
    hover: colors.neutral[200],
    border: `1px solid ${colors.neutral[200]}`,
  },
  outline: {
    background: colors.neutral[0],
    color: colors.neutral[900],
    hover: colors.neutral[50],
    border: `1px solid ${colors.neutral[300]}`,
  },
};

const sizeStyles = {
  sm: { padding: `${spacing.sm} ${spacing.lg}`, fontSize: '14px' },
  md: { padding: `${spacing.md} ${spacing.xl}`, fontSize: '16px' },
  lg: { padding: `${spacing.md} ${spacing.xl}`, fontSize: '16px' },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  icon,
  ...props
}: ButtonProps) {
  const style = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        width: '100%',
        padding: sizeStyle.padding,
        fontSize: sizeStyle.fontSize,
        fontWeight: '600',
        backgroundColor: style.background,
        color: style.color,
        border: style.border,
        borderRadius: '24px',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        opacity: disabled || isLoading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = style.hover;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = style.background;
      }}
      {...props}
    >
      {isLoading && <Spinner size="sm" className="text-white" />}
      {icon && !isLoading && icon}
      {children}
    </button>
  );
}
