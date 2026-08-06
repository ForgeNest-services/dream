'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  MdOutlineAdd,
  MdOutlineClose,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlinePerson,
  MdOutlineEmail,
} from 'react-icons/md';
import { useTeamMembers, type InviteTeamMemberInput } from '@/hooks/useTeamMembers';
import { TeamMember } from '@/lib/mock-team';
import { colors, spacing, radius } from '@/lib/design-tokens';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { DropdownMenu } from '@/components/ui/DropdownMenu';

const ROLE_LABEL: Record<TeamMember['role'], string> = { owner: 'Owner', manager: 'Manager' };

const STATUS_STYLE: Record<TeamMember['status'], { label: string; bg: string; fg: string }> = {
  active: { label: 'Active', bg: '#EAF6EE', fg: '#1E7A44' },
  invited: { label: 'Invited', bg: colors.accent[50], fg: colors.accent[700] },
  inactive: { label: 'Inactive', bg: colors.neutral[100], fg: colors.neutral[500] },
};

export function TeamMembersContent() {
  const { members, isMutating, invite, setStatus, update, remove } = useTeamMembers();
  const [isInviting, setIsInviting] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, flexWrap: 'wrap' }}>
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: colors.neutral[900],
              fontFamily: 'var(--font-playfair)',
              margin: 0,
            }}
          >
            Team Members
          </h1>
          <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs, maxWidth: '520px', lineHeight: '1.6' }}>
            People with platform access to manage your business. Managers can create staff credentials and view reports.
          </p>
        </div>
        <div style={{ width: 'fit-content' }}>
          <Button onClick={() => setIsInviting(true)} icon={<MdOutlineAdd size={18} />} size="md">
            Invite member
          </Button>
        </div>
      </div>

      <div
        style={{
          backgroundColor: colors.neutral[0],
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: radius.lg,
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.neutral[200]}` }}>
                {['Member', 'Role', 'Status', 'Active', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === 'Actions' ? 'right' : 'left',
                      padding: `${spacing.md} ${spacing.lg}`,
                      fontSize: '11px',
                      fontWeight: '700',
                      color: colors.neutral[500],
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const status = STATUS_STYLE[m.status];
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                        <Avatar name={m.full_name} email={m.email} src={m.picture_url} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: colors.neutral[900], margin: 0 }}>
                            {m.full_name}
                          </p>
                          <p style={{ fontSize: '12px', color: colors.neutral[500], margin: 0, marginTop: '2px' }}>
                            {m.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}` }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: colors.neutral[700] }}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}` }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: status.fg,
                          backgroundColor: status.bg,
                          padding: '3px 10px',
                          borderRadius: radius.full,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}` }}>
                      <Switch
                        checked={m.status !== 'inactive'}
                        onChange={(checked) => setStatus(m.id, checked ? 'active' : 'inactive')}
                        disabled={m.role === 'owner'}
                        aria-label={`Toggle ${m.full_name} active`}
                      />
                    </td>
                    <td style={{ padding: `${spacing.md} ${spacing.lg}`, textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <DropdownMenu
                          triggerLabel={`Actions for ${m.full_name}`}
                          items={[
                            {
                              label: 'Edit',
                              icon: <MdOutlineEdit size={16} />,
                              onSelect: () => setEditing(m),
                            },
                            ...(m.role !== 'owner'
                              ? [
                                  {
                                    label: 'Delete',
                                    icon: <MdOutlineDelete size={16} />,
                                    onSelect: () => setConfirmDelete(m),
                                    tone: 'danger' as const,
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isInviting && (
        <InviteModal
          isSaving={isMutating}
          onClose={() => setIsInviting(false)}
          onSubmit={async (values) => {
            const ok = await invite(values);
            if (ok) setIsInviting(false);
          }}
        />
      )}

      {editing && (
        <EditModal
          member={editing}
          isSaving={isMutating}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const ok = await update(editing.id, values);
            if (ok) setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          name={confirmDelete.full_name}
          isDeleting={isMutating}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const ok = await remove(confirmDelete.id);
            if (ok) setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 41, 71, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: spacing.lg,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.neutral[0],
          borderRadius: radius.lg,
          padding: spacing.xl,
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 40px rgba(10, 41, 71, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: colors.neutral[900] }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ padding: spacing.xs, border: 'none', background: 'transparent', color: colors.neutral[500], cursor: 'pointer', display: 'flex' }}
          >
            <MdOutlineClose size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InviteModal({
  isSaving,
  onClose,
  onSubmit,
}: {
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: InviteTeamMemberInput) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteTeamMemberInput>({ defaultValues: { role: 'manager' } });

  return (
    <ModalShell title="Invite a team member" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          {...register('full_name', { required: 'Name is required' })}
          label="Full name"
          placeholder="e.g. Priya Sharma"
          icon={<MdOutlinePerson size={18} />}
          error={errors.full_name?.message}
          disabled={isSaving}
        />
        <FormInput
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' },
          })}
          type="email"
          label="Email"
          placeholder="priya@business.com"
          icon={<MdOutlineEmail size={18} />}
          error={errors.email?.message}
          disabled={isSaving}
        />
        <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: spacing.lg }}>
          Invited as Manager — can create staff credentials and view reports, not billing.
        </p>
        <Button type="submit" isLoading={isSaving} size="lg">
          Send invitation
        </Button>
      </form>
    </ModalShell>
  );
}

function EditModal({
  member,
  isSaving,
  onClose,
  onSubmit,
}: {
  member: TeamMember;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: { full_name: string }) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ full_name: string }>({ defaultValues: { full_name: member.full_name } });

  return (
    <ModalShell title="Edit team member" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          {...register('full_name', { required: 'Name is required' })}
          label="Full name"
          icon={<MdOutlinePerson size={18} />}
          error={errors.full_name?.message}
          disabled={isSaving}
        />
        <FormInput label="Email" value={member.email} disabled icon={<MdOutlineEmail size={18} />} />
        <Button type="submit" isLoading={isSaving} size="lg">
          Save changes
        </Button>
      </form>
    </ModalShell>
  );
}

function ConfirmDeleteModal({
  name,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  name: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 41, 71, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: spacing.lg,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.neutral[0],
          borderRadius: radius.lg,
          padding: spacing.xl,
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 40px rgba(10, 41, 71, 0.2)',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: spacing.sm, fontSize: '18px', fontWeight: '700', color: colors.neutral[900] }}>
          Remove {name}?
        </h3>
        <p style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: spacing.lg, lineHeight: '1.6' }}>
          They'll lose platform access immediately. This can't be undone.
        </p>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              flex: 1,
              padding: `${spacing.md} ${spacing.lg}`,
              borderRadius: radius.full,
              border: `1px solid ${colors.neutral[300]}`,
              backgroundColor: colors.neutral[0],
              color: colors.neutral[800],
              fontWeight: '600',
              fontSize: '14px',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              flex: 1,
              padding: `${spacing.md} ${spacing.lg}`,
              borderRadius: radius.full,
              border: `1px solid ${colors.status.error}`,
              backgroundColor: colors.status.error,
              color: colors.neutral[0],
              fontWeight: '600',
              fontSize: '14px',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
