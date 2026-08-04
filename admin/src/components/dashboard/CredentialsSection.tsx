'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  MdOutlineAdd,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlinePerson,
  MdOutlineLock,
  MdOutlineClose,
  MdOutlineBusiness,
} from 'react-icons/md';
import { useCredentials } from '@/hooks/useCredentials';
import { AppCredential, Branch, APP_CODE_TO_ROLES, BRANCH_SCOPED_ROLES } from '@/types/apps';
import { colors, spacing } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';

interface Props {
  appCode: string;
  branches: Branch[];
  branchesLoading: boolean;
}

type CreateFormValues = { username: string; password: string };
type EditFormValues = { username?: string; password?: string };

// A "slot" is a (role, branch) pair that either has a credential or doesn't yet.
type Slot = {
  role: string;
  branchId: string | null;
  branchName: string | null;
  cred: AppCredential | null;
};

export function CredentialsSection({ appCode, branches, branchesLoading }: Props) {
  const { credentials, isLoading: credsLoading, isMutating, create, update, remove } =
    useCredentials(appCode);
  const [addingSlot, setAddingSlot] = useState<Slot | null>(null);
  const [editingCred, setEditingCred] = useState<AppCredential | null>(null);
  const [confirmDeleteCred, setConfirmDeleteCred] = useState<AppCredential | null>(null);

  const roles = APP_CODE_TO_ROLES[appCode] || [];
  const roleLabel = (code: string) => roles.find((r) => r.code === code)?.label || code.replace('_', ' ');
  const branchName = (branchId: string | null) =>
    branches.find((b) => b.id === branchId)?.name ?? null;

  if (credsLoading || branchesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}>
        <Spinner size="lg" />
      </div>
    );
  }

  // Build the full slot list: tenant-wide roles get one slot; branch-scoped
  // roles get one slot per active branch.
  const slots: Slot[] = [];
  for (const r of roles) {
    if (BRANCH_SCOPED_ROLES.has(r.code)) {
      for (const b of branches) {
        const cred = credentials.find((c) => c.role === r.code && c.branch_id === b.id) || null;
        slots.push({ role: r.code, branchId: b.id, branchName: b.name, cred });
      }
    } else {
      const cred = credentials.find((c) => c.role === r.code) || null;
      slots.push({ role: r.code, branchId: null, branchName: null, cred });
    }
  }

  const filledSlots = slots.filter((s) => s.cred);
  const emptySlots = slots.filter((s) => !s.cred);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {filledSlots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {filledSlots.map((slot) => (
            <CredentialRow
              key={slot.cred!.id}
              cred={slot.cred!}
              label={roleLabel(slot.role)}
              branchName={slot.branchName}
              onEdit={() => setEditingCred(slot.cred)}
              onDelete={() => setConfirmDeleteCred(slot.cred)}
            />
          ))}
        </div>
      )}

      {emptySlots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <p style={{ fontSize: '13px', color: colors.neutral[500], fontWeight: '500' }}>
            {filledSlots.length === 0
              ? 'No credentials yet. Create one for each role your staff will use.'
              : 'Add credentials for the remaining roles:'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
            {emptySlots.map((slot) => (
              <button
                key={`${slot.role}-${slot.branchId ?? 'tenant'}`}
                onClick={() => setAddingSlot(slot)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: '24px',
                  border: `1px dashed ${colors.neutral[300]}`,
                  backgroundColor: colors.neutral[0],
                  color: colors.neutral[700],
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.primary[800];
                  e.currentTarget.style.color = colors.primary[800];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.neutral[300];
                  e.currentTarget.style.color = colors.neutral[700];
                }}
              >
                <MdOutlineAdd size={16} />
                Add {roleLabel(slot.role)}
                {slot.branchName ? ` — ${slot.branchName}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {addingSlot && (
        <CreateCredentialModal
          role={addingSlot.role}
          roleLabel={roleLabel(addingSlot.role)}
          branchName={addingSlot.branchName}
          isSaving={isMutating}
          onClose={() => setAddingSlot(null)}
          onSubmit={async (values) => {
            const ok = await create({
              role: addingSlot.role,
              username: values.username,
              password: values.password,
              branch_id: addingSlot.branchId,
            });
            if (ok) setAddingSlot(null);
          }}
        />
      )}

      {editingCred && (
        <EditCredentialModal
          roleLabel={roleLabel(editingCred.role)}
          branchName={branchName(editingCred.branch_id)}
          current={editingCred}
          isSaving={isMutating}
          onClose={() => setEditingCred(null)}
          onSubmit={async (values) => {
            const ok = await update(editingCred.id, values);
            if (ok) setEditingCred(null);
          }}
        />
      )}

      {confirmDeleteCred && (
        <ConfirmDeleteModal
          roleLabel={roleLabel(confirmDeleteCred.role)}
          branchName={branchName(confirmDeleteCred.branch_id)}
          isDeleting={isMutating}
          onCancel={() => setConfirmDeleteCred(null)}
          onConfirm={async () => {
            const ok = await remove(confirmDeleteCred.id);
            if (ok) setConfirmDeleteCred(null);
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

function CredentialRow({
  cred,
  label,
  branchName,
  onEdit,
  onDelete,
}: {
  cred: AppCredential;
  label: string;
  branchName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: '12px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: colors.primary[50],
          color: colors.primary[800],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <MdOutlinePerson size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: colors.neutral[900],
            margin: 0,
            textTransform: 'capitalize',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          {label}
          {branchName && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'none',
                color: colors.primary[800],
                backgroundColor: colors.primary[50],
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              <MdOutlineBusiness size={12} />
              {branchName}
            </span>
          )}
        </p>
        <p
          style={{
            fontSize: '13px',
            color: colors.neutral[500],
            margin: 0,
            marginTop: '2px',
          }}
        >
          Username: <span style={{ fontFamily: 'monospace', color: colors.neutral[800] }}>{cred.username}</span>
        </p>
      </div>
      <div style={{ display: 'flex', gap: spacing.xs }}>
        <button
          onClick={onEdit}
          title="Edit"
          style={{
            padding: spacing.sm,
            border: 'none',
            background: 'transparent',
            color: colors.neutral[600],
            cursor: 'pointer',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[100])}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <MdOutlineEdit size={18} />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          style={{
            padding: spacing.sm,
            border: 'none',
            background: 'transparent',
            color: colors.status.error,
            cursor: 'pointer',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${colors.status.error}15`)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <MdOutlineDelete size={18} />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
          borderRadius: '16px',
          padding: spacing.xl,
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.lg,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: colors.neutral[900],
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: spacing.xs,
              border: 'none',
              background: 'transparent',
              color: colors.neutral[500],
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MdOutlineClose size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateCredentialModal({
  role,
  roleLabel,
  branchName,
  isSaving,
  onClose,
  onSubmit,
}: {
  role: string;
  roleLabel: string;
  branchName: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: CreateFormValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFormValues>();

  const title = branchName ? `New ${roleLabel} credential — ${branchName}` : `New ${roleLabel} credential`;

  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          {...register('username', {
            required: 'Username is required',
            minLength: { value: 3, message: 'At least 3 characters' },
          })}
          label="Username"
          placeholder={`e.g. ${role}-hotelname`}
          icon={<MdOutlinePerson size={18} />}
          error={errors.username?.message}
          disabled={isSaving}
        />
        <FormInput
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 6, message: 'At least 6 characters' },
          })}
          type="password"
          label="Password"
          placeholder="At least 6 characters"
          icon={<MdOutlineLock size={18} />}
          showPasswordToggle
          error={errors.password?.message}
          disabled={isSaving}
        />
        <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: spacing.lg }}>
          Share these credentials with your {roleLabel.toLowerCase()} staff{branchName ? ` at ${branchName}` : ''}. Anyone with the login can access this role.
        </p>
        <Button type="submit" isLoading={isSaving} size="lg">
          Create Credential
        </Button>
      </form>
    </ModalShell>
  );
}

function EditCredentialModal({
  roleLabel,
  branchName,
  current,
  isSaving,
  onClose,
  onSubmit,
}: {
  roleLabel: string;
  branchName: string | null;
  current: AppCredential | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: EditFormValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditFormValues>({
    defaultValues: { username: current?.username || '', password: '' },
  });

  const submit = async (values: EditFormValues) => {
    const payload: EditFormValues = {};
    if (values.username && values.username !== current?.username) payload.username = values.username;
    if (values.password) payload.password = values.password;
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    await onSubmit(payload);
  };

  const title = branchName ? `Edit ${roleLabel} credential — ${branchName}` : `Edit ${roleLabel} credential`;

  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(submit)}>
        <FormInput
          {...register('username', {
            minLength: { value: 3, message: 'At least 3 characters' },
          })}
          label="Username"
          icon={<MdOutlinePerson size={18} />}
          error={errors.username?.message}
          disabled={isSaving}
        />
        <FormInput
          {...register('password', {
            validate: (v) => !v || v.length >= 6 || 'At least 6 characters',
          })}
          type="password"
          label="New Password"
          placeholder="Leave blank to keep current"
          icon={<MdOutlineLock size={18} />}
          showPasswordToggle
          error={errors.password?.message}
          disabled={isSaving}
        />
        <p style={{ fontSize: '12px', color: colors.neutral[500], marginBottom: spacing.lg }}>
          Currently logged-in staff continue their session until it expires. New logins require the updated password.
        </p>
        <Button type="submit" isLoading={isSaving} size="lg">
          Save Changes
        </Button>
      </form>
    </ModalShell>
  );
}

function ConfirmDeleteModal({
  roleLabel,
  branchName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  roleLabel: string;
  branchName: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const title = branchName
    ? `Delete ${roleLabel} credential for ${branchName}?`
    : `Delete ${roleLabel} credential?`;

  return (
    <ModalShell title={title} onClose={onCancel}>
      <p style={{ fontSize: '14px', color: colors.neutral[700], marginBottom: spacing.lg }}>
        This will remove the {roleLabel.toLowerCase()} login{branchName ? ` for ${branchName}` : ''}. Staff currently signed in stay signed in until their session expires; after that, they can't log in with this cred anymore.
      </p>
      <div style={{ display: 'flex', gap: spacing.sm }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          style={{
            flex: 1,
            padding: `${spacing.md} ${spacing.lg}`,
            borderRadius: '24px',
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
            borderRadius: '24px',
            border: `1px solid ${colors.status.error}`,
            backgroundColor: colors.status.error,
            color: colors.neutral[0],
            fontWeight: '600',
            fontSize: '14px',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            opacity: isDeleting ? 0.6 : 1,
          }}
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </ModalShell>
  );
}
