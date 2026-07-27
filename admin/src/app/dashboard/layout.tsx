import { Sidebar } from '@/components/layout/Sidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ReactNode } from 'react';
import { colors, spacing } from '@/lib/design-tokens';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: colors.neutral[0],
      }}>
        <Sidebar />

        {/* Main content */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          marginLeft: '256px',
        }}>
          <div style={{
            padding: `${spacing.md} ${spacing.lg}`,
          }}>
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
