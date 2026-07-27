'use client';

import { MdAutoAwesome } from 'react-icons/md';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        animation: 'spin 1s linear infinite',
      }}
    >
      <MdAutoAwesome size={sizeMap[size]} className={className} />
    </div>
  );
}
