'use client';

import { useAuth } from '@/hooks/useAuth';

export function DashboardContent() {
  const { user, userType, userRole, isSuperAdmin, tenant } = useAuth();

  const userName = user && 'full_name' in user ? user.full_name : user?.email;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Welcome, {userName}!
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          {isSuperAdmin ? 'Admin Control Panel' : 'Manage your business and team members'}
        </p>
      </div>

      {/* User Info Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* User Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
            Account
          </h2>
          <div className="mt-4 space-y-3">
            {user?.email && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{user.email}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Role</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                {isSuperAdmin ? 'Superadmin' : userRole || 'Unknown'}
              </p>
            </div>
            {user && 'is_verified' in user && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                <p className="text-sm font-medium text-green-600">
                  {user.is_verified ? 'Verified' : 'Pending Verification'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Business Card */}
        {tenant && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Business
            </h2>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Business Name</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{tenant.name}</p>
              </div>
              {tenant.pan && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">PAN</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{tenant.pan}</p>
                </div>
              )}
              {tenant.business_email && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Business Email</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {tenant.business_email}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {!tenant && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 space-y-3">
          <p className="text-blue-900 dark:text-blue-100 font-medium">
            Complete your business registration to get started
          </p>
          <a
            href="/business-register"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Complete Registration →
          </a>
        </div>
      )}
    </div>
  );
}
