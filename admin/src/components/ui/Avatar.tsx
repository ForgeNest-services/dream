'use client';

import { useState } from 'react';
import { colors } from '@/lib/design-tokens';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '?';
}

export function Avatar({
  src,
  name,
  email,
  size = 40,
  backgroundColor = colors.primary[800],
  textColor = colors.neutral[0],
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name, email);
  const showImage = src && !imgError;

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor,
        color: textColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${size * 0.4}px`,
        fontWeight: '600',
        flexShrink: 0,
        overflow: 'hidden',
        border: `2px solid ${colors.neutral[0]}`,
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name || email || 'User'}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
