// Modern Dark Blue Design Tokens
export const colors = {
  // Primary - Dark Navy Blue (#0A2947)
  primary: {
    50: '#E8EDF2',
    100: '#D7E1F2',
    200: '#B3CBEA',
    300: '#8FAADB',
    400: '#4A7CB3',
    500: '#2D5A94',
    600: '#1B4B7C',
    700: '#0D3252',
    800: '#0A2947',
  },

  // Neutrals - Clean whites and grays
  neutral: {
    0: '#ffffff',
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // Status colors
  status: {
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#0A2947',
  },

  // Warm accent — hospitality warmth against the navy scale, used sparingly
  // for signature graphics and small highlights, never for primary actions.
  accent: {
    50: '#FDF3EC',
    200: '#F3CEA9',
    500: '#DB8A3E',
    700: '#B5601C',
  },
};

export const typography = {
  font: {
    primary: 'var(--font-playfair), "Montserrat", sans-serif',
    secondary: 'var(--font-sans), "Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

export const radius = {
  sm: '6px',
  md: '12px',
  lg: '16px',
  full: '9999px',
};

export const layout = {
  sidebarWidth: '260px',
  sidebarCollapsedWidth: '76px',
  topbarHeight: '64px',
};
