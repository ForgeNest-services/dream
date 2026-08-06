'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useBusinessRegister } from '@/hooks/useBusinessRegister';
import { BusinessRegisterRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/lib/design-tokens';
import {
  MdOutlineBusiness,
  MdOutlineLocationOn,
  MdOutlineDescription,
  MdOutlineEmail,
  MdOutlinePhone,
  MdOutlineReceiptLong,
} from 'react-icons/md';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '11px',
        fontWeight: '700',
        color: colors.primary[500],
        textTransform: 'uppercase',
        letterSpacing: '1px',
        margin: 0,
        marginBottom: spacing.md,
      }}
    >
      {children}
    </p>
  );
}

export function BusinessRegisterForm() {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BusinessRegisterRequest>({ defaultValues: { is_vat_registered: false } });
  const { register: submitRegister, isLoading } = useBusinessRegister();

  const pan = watch('pan');
  const isVatRegistered = watch('is_vat_registered');
  const hasPan = Boolean(pan && pan.trim().length > 0);

  const onSubmit = async (data: BusinessRegisterRequest) => {
    await submitRegister({
      ...data,
      is_vat_registered: hasPan ? data.is_vat_registered : false,
    });
  };

  const registrationSummary = !hasPan
    ? 'No tax ID yet — invoices won’t include VAT.'
    : isVatRegistered
      ? 'VAT-registered — invoices will show 13% VAT.'
      : 'PAN-registered — invoices exclude VAT.';

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Identity */}
      <SectionLabel>Your business</SectionLabel>
      <FormInput
        {...register('business_name', { required: 'Business name is required' })}
        type="text"
        placeholder="e.g. Sunset Hotel Pvt Ltd"
        label="Business name"
        error={errors.business_name?.message}
        icon={<MdOutlineBusiness size={20} />}
        disabled={isLoading}
      />
      <FormInput
        {...register('business_address', { required: 'Business address is required' })}
        type="text"
        placeholder="Street, city"
        label="Business address"
        error={errors.business_address?.message}
        icon={<MdOutlineLocationOn size={20} />}
        disabled={isLoading}
      />

      {/* Tax registration */}
      <div style={{ marginTop: spacing.xl }}>
        <SectionLabel>Tax registration</SectionLabel>
        <FormInput
          {...register('pan')}
          type="text"
          placeholder="e.g. 123456789"
          label="PAN number (optional)"
          error={errors.pan?.message}
          icon={<MdOutlineDescription size={20} />}
          disabled={isLoading}
        />

        {hasPan && (
          <div style={{ marginBottom: spacing.lg }}>
            <Controller
              name="is_vat_registered"
              control={control}
              render={({ field }) => (
                <div
                  role="radiogroup"
                  aria-label="Tax registration type"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: spacing.sm,
                  }}
                >
                  {[
                    { value: false, title: 'PAN only', hint: 'No VAT on invoices' },
                    { value: true, title: 'VAT registered', hint: '13% VAT on invoices' },
                  ].map((opt) => {
                    const active = field.value === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={isLoading}
                        onClick={() => field.onChange(opt.value)}
                        style={{
                          textAlign: 'left',
                          padding: `${spacing.md} ${spacing.lg}`,
                          borderRadius: '16px',
                          border: `1.5px solid ${active ? colors.primary[800] : colors.neutral[200]}`,
                          backgroundColor: active ? colors.primary[50] : colors.neutral[0],
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: active ? colors.primary[800] : colors.neutral[800],
                          }}
                        >
                          {opt.title}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            color: colors.neutral[500],
                            marginTop: '2px',
                          }}
                        >
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.sm} ${spacing.md}`,
            borderRadius: '12px',
            backgroundColor: colors.neutral[50],
            marginBottom: spacing.lg,
          }}
        >
          <MdOutlineReceiptLong size={16} color={colors.neutral[500]} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '12px', color: colors.neutral[600], margin: 0, lineHeight: '1.5' }}>
            {registrationSummary}
          </p>
        </div>
      </div>

      {/* Contact */}
      <SectionLabel>Contact (optional)</SectionLabel>
      <FormInput
        {...register('business_email', {
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: 'Invalid email address',
          },
        })}
        type="email"
        placeholder="business@example.com"
        label="Business email"
        error={errors.business_email?.message}
        icon={<MdOutlineEmail size={20} />}
        disabled={isLoading}
      />
      <FormInput
        {...register('business_phone')}
        type="tel"
        placeholder="+977 98XXXXXXXX"
        label="Business phone"
        error={errors.business_phone?.message}
        icon={<MdOutlinePhone size={20} />}
        disabled={isLoading}
      />

      <Button type="submit" isLoading={isLoading} size="lg">
        {isLoading ? 'Saving…' : 'Continue to Dashboard'}
      </Button>
    </form>
  );
}
