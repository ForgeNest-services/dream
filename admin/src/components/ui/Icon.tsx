import React from 'react';

interface IconProps extends React.HTMLAttributes<HTMLElement> {
  icon: string;
  width?: string | number;
  height?: string | number;
}

export function Icon({ icon, width = 20, height = width, ...props }: IconProps) {
  return React.createElement('iconify-icon', {
    icon,
    width,
    height,
    ...props,
  } as any);
}
