import { Sidebar } from '@/components/layout/Sidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-auto lg:ml-64">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
