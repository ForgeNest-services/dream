'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { colors, spacing, layout } from '@/lib/design-tokens';

function DashboardShell({ children }: { children: ReactNode }) {
  const { collapsed, isDesktop } = useSidebar();
  const marginLeft = isDesktop ? (collapsed ? layout.sidebarCollapsedWidth : layout.sidebarWidth) : 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.neutral[50] }}>
      <Sidebar />
      <div
        style={{
          marginLeft,
          transition: 'margin-left 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Topbar />
        <main style={{ flex: 1, padding: `${spacing.xl} ${spacing['2xl']}` }}>{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <DashboardShell>{children}</DashboardShell>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
