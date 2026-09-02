'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  MdOutlineAdd,
  MdOutlineBusiness,
  MdOutlineClose,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineLocationOn,
  MdOutlinePhone,
} from 'react-icons/md';
import { useBranches } from '@/hooks/useBranches';
import { Branch } from '@/types/apps';
import { colors, spacing, radius } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';

type BranchFormValues = { name: string; code?: string; address?: string; city?: string; phone?: string };

export function BranchesContent() {
  const { branches, isLoading, isMutating, create, update, remove } = useBranches();
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);

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
            Branches
          </h1>
          <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs, maxWidth: '520px', lineHeight: '1.6' }}>
            Your locations, shared across every app. Your main location was added automatically from your business details — add more if you run multiple sites.
          </p>
        </div>
        <div style={{ width: 'fit-content' }}>
          <Button onClick={() => setIsAdding(true)} icon={<MdOutlineAdd size={18} />} size="md">
            Add branch
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['3xl'] }}>
          <Spinner size="lg" />
        </div>
      ) : branches.length === 0 ? (
        <EmptyState onAdd={() => setIsAdding(true)} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: spacing.lg,
          }}
        >
          {branches.map((b, i) => (
            <BranchCard
              key={b.id}
              branch={b}
              isMain={i === 0}
              onEdit={() => setEditing(b)}
              onDelete={() => setConfirmDelete(b)}
            />
          ))}
        </div>
      )}

      {isAdding && (
        <BranchFormModal
          title="New branch"
          isSaving={isMutating}
          onClose={() => setIsAdding(false)}
          onSubmit={async (values) => {
            const ok = await create({
              name: values.name,
              code: values.code || undefined,
              address: values.address || null,
              city: values.city || null,
              phone: values.phone || null,
            });
            if (ok) setIsAdding(false);
          }}
        />
      )}

      {editing && (
        <BranchFormModal
          title="Edit branch"
          initial={editing}
          isSaving={isMutating}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const ok = await update(editing.id, {
              name: values.name,
              code: values.code || undefined,
              address: values.address || null,
              city: values.city || null,
              phone: values.phone || null,
            });
            if (ok) setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          branchName={confirmDelete.name}
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

function BranchCard({
  branch,
  isMain,
  onEdit,
  onDelete,
}: {
  branch: Branch;
  isMain: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: radius.lg,
        padding: spacing.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.primary[300];
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(10, 41, 71, 0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.neutral[200];
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: radius.md,
            backgroundColor: colors.primary[50],
            color: colors.primary[800],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <MdOutlineBusiness size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', color: colors.neutral[900], margin: 0 }}>
              {branch.name}
            </p>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
                color: colors.neutral[600],
                backgroundColor: colors.neutral[100],
                padding: '2px 6px',
                borderRadius: radius.sm,
                letterSpacing: '0.3px',
              }}
            >
              {branch.code}
            </span>
          </div>
          {isMain && (
            <span
              style={{
                display: 'inline-block',
                marginTop: '4px',
                fontSize: '10px',
                fontWeight: '700',
                color: colors.accent[700],
                backgroundColor: colors.accent[50],
                padding: '2px 8px',
                borderRadius: radius.full,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Main location
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        {(branch.address || branch.city) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.xs }}>
            <MdOutlineLocationOn size={16} color={colors.neutral[400]} style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '13px', color: colors.neutral[600], margin: 0, lineHeight: '1.5' }}>
              {[branch.address, branch.city].filter(Boolean).join(', ')}
            </p>
          </div>
        )}
        {branch.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <MdOutlinePhone size={16} color={colors.neutral[400]} style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: colors.neutral[600], margin: 0 }}>{branch.phone}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: spacing.xs, marginTop: 'auto', paddingTop: spacing.xs }}>
        <button
          onClick={onEdit}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.sm,
            border: `1px solid ${colors.neutral[200]}`,
            backgroundColor: colors.neutral[0],
            color: colors.neutral[700],
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[50])}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[0])}
        >
          <MdOutlineEdit size={14} />
          Edit
        </button>
        {!isMain && (
          <button
            onClick={onDelete}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: radius.sm,
              border: `1px solid ${colors.neutral[200]}`,
              backgroundColor: colors.neutral[0],
              color: colors.status.error,
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${colors.status.error}0D`)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[0])}
          >
            <MdOutlineDelete size={14} />
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: `${spacing['3xl']} ${spacing.xl}`,
        border: `1px dashed ${colors.neutral[300]}`,
        borderRadius: radius.lg,
        backgroundColor: colors.neutral[0],
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: radius.md,
          backgroundColor: colors.primary[50],
          color: colors.primary[800],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <MdOutlineBusiness size={28} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: '600', color: colors.neutral[900], margin: 0 }}>
        No branches yet
      </p>
      <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs, marginBottom: spacing.lg, maxWidth: '360px' }}>
        Your main location is created automatically once your business is set up.
      </p>
      <div style={{ width: 'fit-content' }}>
        <Button onClick={onAdd} icon={<MdOutlineAdd size={18} />} size="md">
          Add a branch
        </Button>
      </div>
    </div>
  );
}

function BranchFormModal({
  title,
  initial,
  isSaving,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Branch;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: BranchFormValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormValues>({
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      address: initial?.address ?? '',
      city: initial?.city ?? '',
      phone: initial?.phone ?? '',
    },
  });

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
          maxWidth: '440px',
          boxShadow: '0 20px 40px rgba(10, 41, 71, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: colors.neutral[900] }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              padding: spacing.xs,
              border: 'none',
              background: 'transparent',
              color: colors.neutral[500],
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <MdOutlineClose size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormInput
            {...register('name', { required: 'Branch name is required' })}
            label="Branch name"
            placeholder="e.g. Sunset Hotel — Pokhara"
            error={errors.name?.message}
            disabled={isSaving}
          />
          <FormInput
            {...register('code', {
              maxLength: { value: 10, message: 'Max 10 characters' },
              pattern: { value: /^[A-Za-z0-9]*$/, message: 'Letters and numbers only' },
            })}
            label="Branch code"
            placeholder="Auto-generated if left blank"
            error={errors.code?.message}
            disabled={isSaving}
          />
          <p style={{ fontSize: '11px', color: colors.neutral[500], marginTop: `-${spacing.sm}`, marginBottom: spacing.md }}>
            Appears in this branch&apos;s bill numbers once you have more than one branch (IRD requirement) — e.g. INV-KTM-83/84-00007.
          </p>
          <FormInput {...register('address')} label="Address" placeholder="Optional" disabled={isSaving} />
          <FormInput {...register('city')} label="City" placeholder="Optional" disabled={isSaving} />
          <FormInput {...register('phone')} label="Phone" placeholder="Optional" disabled={isSaving} />
          <Button type="submit" isLoading={isSaving} size="lg">
            {initial ? 'Save changes' : 'Create branch'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  branchName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  branchName: string;
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
          Remove {branchName}?
        </h3>
        <p style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: spacing.lg, lineHeight: '1.6' }}>
          Staff credentials tied to this branch will stop working. This can't be undone.
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
