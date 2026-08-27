'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  MdOutlineAdd,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineLock,
  MdOutlineClose,
  MdOutlineBusiness,
  MdOutlineVpnKey,
  MdCheckCircle,
  MdContentCopy,
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

// Plain-language explanation of what each role can actually do — the thing
// the old design left out entirely, forcing owners to guess from the label.
// Keyed by app code because the same word ("manager") means different things
// per app (see CLAUDE.md §2.4). Falls back to a generic sentence if a role
// isn't listed here.
const ROLE_DESCRIPTIONS: Record<string, Record<string, string>> = {
  srota_pms: {
    app_owner: 'Full access to every branch — rooms, bookings, guests, reports, and settings. Usually you.',
    manager: 'Runs day-to-day operations at one branch: bookings, check-ins, guests, and reports for that branch only.',
    front_desk: 'Handles guests at one branch — check-in, check-out, and bookings. No access to reports or settings.',
  },
  srota_rms: {
    owner: 'Full access to every branch — menu, orders, staff, reports, and settings. Usually you.',
    manager: 'Runs day-to-day operations at one branch: menu, orders, tables, and reports for that branch only.',
    waiter: 'Takes and serves orders at one branch. No access to reports or settings.',
    chef: 'Views and updates order status in the kitchen at one branch. No access to reports or settings.',
  },
  srota_ims: {
    owner: 'Full access to every branch — stock, purchase orders, staff, and settings. Usually you.',
    manager: 'Runs day-to-day inventory at one branch: stock levels, purchase orders, and reports for that branch only.',
    storekeeper: 'Records stock in and out at one branch. No access to reports or settings.',
  },
};

const TENANT_WIDE_NOTE =
  'One login for this role, shared across your whole business — it can switch between every branch.';
const BRANCH_SCOPED_NOTE =
  'This role needs a separate login per branch — each one only sees that branch.';

function roleDescription(appCode: string, role: string): string {
  return ROLE_DESCRIPTIONS[appCode]?.[role] || 'Staff login for this role.';
}

export function CredentialsSection({ appCode, branches, branchesLoading }: Props) {
  const { credentials, isLoading: credsLoading, isMutating, create, update, remove } =
    useCredentials(appCode);
  const [addingSlot, setAddingSlot] = useState<Slot | null>(null);
  const [editingCred, setEditingCred] = useState<AppCredential | null>(null);
  const [confirmDeleteCred, setConfirmDeleteCred] = useState<AppCredential | null>(null);

  const roles = APP_CODE_TO_ROLES[appCode] || [];
  const roleLabel = (code: string) => roles.find((r) => r.code === code)?.label || code.replace('_', ' ');

  if (credsLoading || branchesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div
        style={{
          padding: spacing.lg,
          backgroundColor: colors.neutral[50],
          border: `1px dashed ${colors.neutral[300]}`,
          borderRadius: '12px',
          color: colors.neutral[600],
          fontSize: '14px',
        }}
      >
        Add a branch first — most staff roles are tied to a location.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {roles.map((r) => {
        const scoped = BRANCH_SCOPED_ROLES.has(r.code);
        const roleSlots: Slot[] = scoped
          ? branches.map((b) => ({
              role: r.code,
              branchId: b.id,
              branchName: b.name,
              cred: credentials.find((c) => c.role === r.code && c.branch_id === b.id) || null,
            }))
          : [
              {
                role: r.code,
                branchId: null,
                branchName: null,
                cred: credentials.find((c) => c.role === r.code) || null,
              },
            ];
        const filledCount = roleSlots.filter((s) => s.cred).length;

        return (
          <div
            key={r.code}
            style={{
              backgroundColor: colors.neutral[0],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: spacing.md,
                padding: spacing.lg,
                borderBottom: `1px solid ${colors.neutral[100]}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <p style={{ fontSize: '15px', fontWeight: '700', color: colors.neutral[900], margin: 0 }}>
                    {r.label}
                  </p>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: scoped ? colors.accent[700] : colors.primary[800],
                      backgroundColor: scoped ? colors.accent[50] : colors.primary[50],
                      padding: '2px 8px',
                      borderRadius: '10px',
                      flexShrink: 0,
                    }}
                  >
                    {scoped ? 'Per branch' : 'All branches'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: colors.neutral[600], margin: `${spacing.xs} 0 0`, lineHeight: '1.5', maxWidth: '520px' }}>
                  {roleDescription(appCode, r.code)}
                </p>
              </div>
              <div style={{ fontSize: '12px', color: colors.neutral[400], fontWeight: '600', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {filledCount}/{roleSlots.length} set up
              </div>
            </div>

            <div>
              {roleSlots.map((slot) => (
                <SlotRow
                  key={`${slot.role}-${slot.branchId ?? 'tenant'}`}
                  slot={slot}
                  onAdd={() => setAddingSlot(slot)}
                  onEdit={() => setEditingCred(slot.cred)}
                  onDelete={() => setConfirmDeleteCred(slot.cred)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {addingSlot && (
        <CreateCredentialModal
          role={addingSlot.role}
          roleLabel={roleLabel(addingSlot.role)}
          branchName={addingSlot.branchName}
          helpText={addingSlot.branchName ? BRANCH_SCOPED_NOTE : TENANT_WIDE_NOTE}
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
          branchName={branches.find((b) => b.id === editingCred.branch_id)?.name ?? null}
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
          branchName={branches.find((b) => b.id === confirmDeleteCred.branch_id)?.name ?? null}
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

function SlotRow({
  slot,
  onAdd,
  onEdit,
  onDelete,
}: {
  slot: Slot;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: `${spacing.md} ${spacing.lg}`,
        borderBottom: `1px solid ${colors.neutral[100]}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        {slot.branchName && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: '600',
              color: colors.neutral[700],
              flexShrink: 0,
            }}
          >
            <MdOutlineBusiness size={14} color={colors.neutral[400]} />
            {slot.branchName}
          </span>
        )}
        {slot.cred ? (
          <span style={{ fontSize: '13px', color: colors.neutral[500], display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            {slot.branchName && <span style={{ color: colors.neutral[300] }}>·</span>}
            <MdCheckCircle size={14} color={colors.status.success} style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', color: colors.neutral[800], overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {slot.cred.username}
            </span>
          </span>
        ) : (
          <span style={{ fontSize: '13px', color: colors.neutral[400] }}>
            {slot.branchName && <span style={{ color: colors.neutral[300], marginRight: spacing.sm }}>·</span>}
            No login yet
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: spacing.xs, flexShrink: 0 }}>
        {slot.cred ? (
          <>
            <IconButton title="Edit login" onClick={onEdit}>
              <MdOutlineEdit size={16} />
            </IconButton>
            <IconButton title="Remove login" onClick={onDelete} danger>
              <MdOutlineDelete size={16} />
            </IconButton>
          </>
        ) : (
          <button
            onClick={onAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: `6px ${spacing.md}`,
              borderRadius: '20px',
              border: `1px solid ${colors.neutral[300]}`,
              backgroundColor: colors.neutral[0],
              color: colors.primary[800],
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.primary[800];
              e.currentTarget.style.backgroundColor = colors.primary[50];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.neutral[300];
              e.currentTarget.style.backgroundColor = colors.neutral[0];
            }}
          >
            <MdOutlineAdd size={14} />
            Create login
          </button>
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '6px',
        border: 'none',
        background: 'transparent',
        color: danger ? colors.status.error : colors.neutral[500],
        cursor: 'pointer',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = danger ? `${colors.status.error}15` : colors.neutral[100])}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </button>
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
  helpText,
  isSaving,
  onClose,
  onSubmit,
}: {
  role: string;
  roleLabel: string;
  branchName: string | null;
  helpText: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: CreateFormValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFormValues>();

  const title = branchName ? `New ${roleLabel} login — ${branchName}` : `New ${roleLabel} login`;

  return (
    <ModalShell title={title} onClose={onClose}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing.sm,
          padding: spacing.md,
          backgroundColor: colors.neutral[50],
          borderRadius: '10px',
          marginBottom: spacing.lg,
        }}
      >
        <MdOutlineVpnKey size={16} color={colors.neutral[500]} style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '12.5px', color: colors.neutral[600], margin: 0, lineHeight: '1.5' }}>{helpText}</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          {...register('username', {
            required: 'Username is required',
            minLength: { value: 3, message: 'At least 3 characters' },
          })}
          label="Username"
          placeholder={`e.g. ${role}-hotelname`}
          icon={<MdOutlineVpnKey size={18} />}
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
          Share these with your {roleLabel.toLowerCase()} staff{branchName ? ` at ${branchName}` : ''}. Anyone with the login can sign in — it's shared, not per-person.
        </p>
        <Button type="submit" isLoading={isSaving} size="lg">
          Create Login
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
  const [copied, setCopied] = useState(false);

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

  const copyUsername = async () => {
    if (!current?.username) return;
    try {
      await navigator.clipboard.writeText(current.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore, username is still visible to copy by hand
    }
  };

  const title = branchName ? `Edit ${roleLabel} login — ${branchName}` : `Edit ${roleLabel} login`;

  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(submit)}>
        <div style={{ position: 'relative' }}>
          <FormInput
            {...register('username', {
              minLength: { value: 3, message: 'At least 3 characters' },
            })}
            label="Username"
            icon={<MdOutlineVpnKey size={18} />}
            error={errors.username?.message}
            disabled={isSaving}
          />
          <button
            type="button"
            onClick={copyUsername}
            title="Copy username"
            style={{
              position: 'absolute',
              right: spacing.sm,
              top: '34px',
              border: 'none',
              background: 'transparent',
              color: copied ? colors.status.success : colors.neutral[400],
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <MdContentCopy size={16} />
          </button>
        </div>
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
          Staff already signed in stay signed in until their session expires. New logins need the updated password.
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
    ? `Remove ${roleLabel} login for ${branchName}?`
    : `Remove ${roleLabel} login?`;

  return (
    <ModalShell title={title} onClose={onCancel}>
      <p style={{ fontSize: '14px', color: colors.neutral[700], marginBottom: spacing.lg }}>
        Staff currently signed in stay signed in until their session expires. After that, this login stops working — you can create a new one for {roleLabel.toLowerCase()}{branchName ? ` at ${branchName}` : ''} any time.
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
          {isDeleting ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </ModalShell>
  );
}
