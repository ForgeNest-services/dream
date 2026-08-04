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
} from 'react-icons/md';
import { useCredentials } from '@/hooks/useCredentials';
import { AppCredential, APP_CODE_TO_ROLES } from '@/types/apps';
import { colors, spacing } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';

interface Props {
  appCode: string;
}

type CreateFormValues = { username: string; password: string };
type EditFormValues = { username?: string; password?: string };

export function CredentialsSection({ appCode }: Props) {
  const { credentials, isLoading, isMutating, create, update, remove } = useCredentials(appCode);
  const [addingRole, setAddingRole] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<string | null>(null);

  const roles = APP_CODE_TO_ROLES[appCode] || [];
  const rolesWithCred = new Set(credentials.map((c) => c.role));
  const missingRoles = roles.filter((r) => !rolesWithCred.has(r.code));

  const roleLabel = (code: string) =>
    roles.find((r) => r.code === code)?.label || code.replace('_', ' ');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {/* Existing credentials list */}
      {credentials.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {credentials.map((cred) => (
            <CredentialRow
              key={cred.id}
              cred={cred}
              label={roleLabel(cred.role)}
              onEdit={() => setEditingRole(cred.role)}
              onDelete={() => setConfirmDeleteRole(cred.role)}
            />
          ))}
        </div>
      )}

      {/* Missing roles — "Add credential" prompts */}
      {missingRoles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <p style={{ fontSize: '13px', color: colors.neutral[500], fontWeight: '500' }}>
            {credentials.length === 0
              ? 'No credentials yet. Create one for each role your staff will use.'
              : 'Add credentials for the remaining roles:'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
            {missingRoles.map((r) => (
              <button
                key={r.code}
                onClick={() => setAddingRole(r.code)}
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
                Add {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {addingRole && (
        <CreateCredentialModal
          role={addingRole}
          roleLabel={roleLabel(addingRole)}
          isSaving={isMutating}
          onClose={() => setAddingRole(null)}
          onSubmit={async (values) => {
            const ok = await create({
              role: addingRole,
              username: values.username,
              password: values.password,
            });
            if (ok) setAddingRole(null);
          }}
        />
      )}

      {/* Edit modal */}
      {editingRole && (
        <EditCredentialModal
          role={editingRole}
          roleLabel={roleLabel(editingRole)}
          current={credentials.find((c) => c.role === editingRole) || null}
          isSaving={isMutating}
          onClose={() => setEditingRole(null)}
          onSubmit={async (values) => {
            const ok = await update(editingRole, values);
            if (ok) setEditingRole(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteRole && (
        <ConfirmDeleteModal
          roleLabel={roleLabel(confirmDeleteRole)}
          isDeleting={isMutating}
          onCancel={() => setConfirmDeleteRole(null)}
          onConfirm={async () => {
            const ok = await remove(confirmDeleteRole);
            if (ok) setConfirmDeleteRole(null);
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
  onEdit,
  onDelete,
}: {
  cred: AppCredential;
  label: string;
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
          }}
        >
          {label}
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
  isSaving,
  onClose,
  onSubmit,
}: {
  role: string;
  roleLabel: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: CreateFormValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFormValues>();

  return (
    <ModalShell title={`New ${roleLabel} credential`} onClose={onClose}>
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
          Share these credentials with your {roleLabel.toLowerCase()} staff. Anyone with the login can access this role.
        </p>
        <Button type="submit" isLoading={isSaving} size="lg">
          Create Credential
        </Button>
      </form>
    </ModalShell>
  );
}

function EditCredentialModal({
  role,
  roleLabel,
  current,
  isSaving,
  onClose,
  onSubmit,
}: {
  role: string;
  roleLabel: string;
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

  return (
    <ModalShell title={`Edit ${roleLabel} credential`} onClose={onClose}>
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
  isDeleting,
  onCancel,
  onConfirm,
}: {
  roleLabel: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <ModalShell title={`Delete ${roleLabel} credential?`} onClose={onCancel}>
      <p style={{ fontSize: '14px', color: colors.neutral[700], marginBottom: spacing.lg }}>
        This will remove the {roleLabel.toLowerCase()} login. Staff currently signed in stay signed in until their session expires; after that, they can't log in with this cred anymore.
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
