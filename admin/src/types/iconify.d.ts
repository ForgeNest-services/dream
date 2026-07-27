declare global {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': IconifyIconProps;
    }
  }
}

interface IconifyIconProps extends React.HTMLAttributes<HTMLElement> {
  icon: string;
  width?: string | number;
  height?: string | number;
  flip?: string;
  rotate?: string | number;
}

export {};
