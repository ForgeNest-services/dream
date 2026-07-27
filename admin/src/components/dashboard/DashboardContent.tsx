'use client';

import { useAuth } from '@/hooks/useAuth';
import { MdArrowForward } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';

export function DashboardContent() {
  const { user, userType, userRole, isSuperAdmin, tenant } = useAuth();

  const userName = user && 'full_name' in user ? user.full_name : user?.email;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      {/* Header */}
      <div>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: colors.neutral[900],
          marginBottom: spacing.sm,
          fontFamily: 'var(--font-playfair)',
        }}>
          Welcome, {userName}!
        </h1>
        <p style={{
          fontSize: '16px',
          color: colors.neutral[600],
          marginTop: spacing.sm,
        }}>
          {isSuperAdmin ? 'Admin Control Panel' : 'Manage your business and team members'}
        </p>
      </div>

      {/* User Info Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: spacing.xl,
      }}>
        {/* User Card */}
        <div style={{
          backgroundColor: colors.neutral[0],
          borderRadius: '12px',
          padding: spacing.lg,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          border: `1px solid ${colors.neutral[200]}`,
        }}>
          <h2 style={{
            fontSize: '12px',
            fontWeight: '600',
            color: colors.neutral[500],
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Account
          </h2>
          <div style={{ marginTop: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {user?.email && (
              <div>
                <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: '4px' }}>Email</p>
                <p style={{ fontSize: '14px', fontWeight: '500', color: colors.neutral[900] }}>{user.email}</p>
              </div>
            )}
            <div>
              <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: '4px' }}>Role</p>
              <p style={{ fontSize: '14px', fontWeight: '500', color: colors.neutral[900], textTransform: 'capitalize' }}>
                {isSuperAdmin ? 'Superadmin' : userRole || 'Unknown'}
              </p>
            </div>
            {user && 'is_verified' in user && (
              <div>
                <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: '4px' }}>Status</p>
                <p style={{ fontSize: '14px', fontWeight: '500', color: colors.primary[400] }}>
                  {user.is_verified ? 'Verified' : 'Pending Verification'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Business Card */}
        {tenant && (
          <div style={{
            backgroundColor: colors.neutral[0],
            borderRadius: '12px',
            padding: spacing.lg,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: `1px solid ${colors.neutral[200]}`,
          }}>
            <h2 style={{
              fontSize: '12px',
              fontWeight: '600',
              color: colors.neutral[500],
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Business
            </h2>
            <div style={{ marginTop: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <div>
                <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: '4px' }}>Business Name</p>
                <p style={{ fontSize: '14px', fontWeight: '500', color: colors.neutral[900] }}>{tenant.name}</p>
              </div>
              {tenant.pan && (
                <div>
                  <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: '4px' }}>PAN</p>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: colors.neutral[900] }}>{tenant.pan}</p>
                </div>
              )}
              {tenant.business_email && (
                <div>
                  <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: '4px' }}>Business Email</p>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: colors.neutral[900] }}>
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
        <div style={{
          backgroundColor: `${colors.primary[400]}15`,
          border: `1px solid ${colors.primary[400]}30`,
          borderRadius: '12px',
          padding: spacing.lg,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.md,
        }}>
          <p style={{
            color: colors.neutral[900],
            fontWeight: '500',
            fontSize: '14px',
          }}>
            Complete your business registration to get started
          </p>
          <a
            href="/business-register"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing.sm,
              paddingLeft: spacing.lg,
              paddingRight: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              backgroundColor: colors.primary[400],
              color: colors.neutral[0],
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'all 0.2s',
              width: 'fit-content',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.primary[500];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.primary[400];
            }}
          >
            Complete Registration
            <MdArrowForward size={18} />
          </a>
        </div>
      )}
    </div>
  );
}
