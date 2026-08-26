'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { colors, spacing, layout } from '@/lib/design-tokens';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/shared/Spinner';

function OnboardingGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, tenant, isSuperAdmin } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) return;
    if (!tenant) {
      router.replace('/onboarding');
      return;
    }
    if (!tenant.free_app_code) {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, tenant, isSuperAdmin, router]);

  // Briefly show spinner while redirecting to onboarding
  if (isAuthenticated && !isSuperAdmin && (!tenant || !tenant.free_app_code)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: colors.neutral[50] }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}

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
        <OnboardingGuard>
          <DashboardShell>{children}</DashboardShell>
        </OnboardingGuard>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
