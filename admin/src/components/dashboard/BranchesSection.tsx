'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { MdOutlineAdd, MdOutlineBusiness, MdOutlineClose } from 'react-icons/md';
import { Branch, CreateBranchPayload } from '@/types/apps';
import { colors, spacing } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';

interface Props {
  branches: Branch[];
  isLoading: boolean;
  isMutating: boolean;
  create: (payload: CreateBranchPayload) => Promise<boolean>;
}

type BranchFormValues = { name: string; address?: string; city?: string; phone?: string };

export function BranchesSection({ branches, isLoading, isMutating, create }: Props) {
  const [isAdding, setIsAdding] = useState(false);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: spacing.xl }}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        {branches.map((b, i) => (
          <div
            key={b.id}
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
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: colors.primary[50],
                color: colors.primary[800],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MdOutlineBusiness size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: '600', color: colors.neutral[900], margin: 0 }}>
                {b.name}
                {i === 0 && (
                  <span
                    style={{
                      marginLeft: spacing.sm,
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.neutral[500],
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    Main
                  </span>
                )}
              </p>
              {(b.address || b.city) && (
                <p style={{ fontSize: '13px', color: colors.neutral[500], margin: 0, marginTop: '2px' }}>
                  {[b.address, b.city].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setIsAdding(true)}
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
          width: 'fit-content',
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
        Add branch
      </button>

      {isAdding && (
        <AddBranchModal
          isSaving={isMutating}
          onClose={() => setIsAdding(false)}
          onSubmit={async (values) => {
            const ok = await create({
              name: values.name,
              address: values.address || null,
              city: values.city || null,
              phone: values.phone || null,
            });
            if (ok) setIsAdding(false);
          }}
        />
      )}
    </div>
  );
}

function AddBranchModal({
  isSaving,
  onClose,
  onSubmit,
}: {
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: BranchFormValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormValues>();

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
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: colors.neutral[900] }}>
            New branch
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormInput
            {...register('name', { required: 'Branch name is required' })}
            label="Branch name"
            placeholder="e.g. Sunset Hotel — Pokhara"
            error={errors.name?.message}
            disabled={isSaving}
          />
          <FormInput
            {...register('address')}
            label="Address"
            placeholder="Optional"
            disabled={isSaving}
          />
          <FormInput {...register('city')} label="City" placeholder="Optional" disabled={isSaving} />
          <FormInput {...register('phone')} label="Phone" placeholder="Optional" disabled={isSaving} />
          <Button type="submit" isLoading={isSaving} size="lg">
            Create Branch
          </Button>
        </form>
      </div>
    </div>
  );
}
