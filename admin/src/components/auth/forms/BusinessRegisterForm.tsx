'use client';

import { useEffect } from 'react';
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

function FormRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: spacing.lg,
      }}
      className="business-form-row"
    >
      {children}
    </div>
  );
}

function SectionLabel({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.md }}>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: '11px',
          fontWeight: '700',
          color: colors.accent[500],
          letterSpacing: '0.5px',
        }}
      >
        {String(index).padStart(2, '0')}
      </span>
      <p
        style={{
          fontSize: '11px',
          fontWeight: '700',
          color: colors.primary[600],
          textTransform: 'uppercase',
          letterSpacing: '1.4px',
          margin: 0,
        }}
      >
        {children}
      </p>
    </div>
  );
}

export interface BusinessFormFields {
  businessName: string;
  businessAddress: string;
  pan: string;
  isVatRegistered: boolean;
  businessEmail: string;
  businessPhone: string;
}

export function BusinessRegisterForm({
  onSuccess,
  onFieldsChange,
}: {
  onSuccess?: () => void;
  onFieldsChange?: (fields: BusinessFormFields) => void;
} = {}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BusinessRegisterRequest>({ defaultValues: { is_vat_registered: false } });
  const { register: submitRegister, isLoading } = useBusinessRegister();

  const businessName = watch('business_name');
  const businessAddress = watch('business_address');
  const pan = watch('pan');
  const isVatRegistered = watch('is_vat_registered');
  const businessEmail = watch('business_email');
  const businessPhone = watch('business_phone');
  const hasPan = Boolean(pan && pan.trim().length === 9);

  useEffect(() => {
    onFieldsChange?.({
      businessName: businessName ?? '',
      businessAddress: businessAddress ?? '',
      pan: pan ?? '',
      isVatRegistered: hasPan ? Boolean(isVatRegistered) : false,
      businessEmail: businessEmail ?? '',
      businessPhone: businessPhone ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessName, businessAddress, pan, isVatRegistered, businessEmail, businessPhone]);

  const onSubmit = async (data: BusinessRegisterRequest) => {
    const ok = await submitRegister({
      ...data,
      is_vat_registered: hasPan ? data.is_vat_registered : false,
    });
    if (ok) onSuccess?.();
  };

  const registrationSummary = !pan?.trim()
    ? 'No PAN yet — invoices won’t show a tax ID.'
    : !hasPan
      ? 'Enter all 9 digits to register a tax ID.'
      : isVatRegistered
        ? 'VAT-registered — every invoice will show 13% VAT.'
        : 'PAN-registered — invoices exclude VAT.';

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Business identity */}
      <SectionLabel index={1}>Business identity</SectionLabel>
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
      <div style={{ marginTop: spacing['2xl'] }}>
        <SectionLabel index={2}>Tax registration</SectionLabel>
        <FormInput
          {...register('pan', {
            pattern: { value: /^\d{9}$/, message: 'PAN must be exactly 9 digits' },
            maxLength: { value: 9, message: 'PAN must be exactly 9 digits' },
          })}
          type="text"
          inputMode="numeric"
          maxLength={9}
          placeholder="9-digit PAN, e.g. 123456789"
          label="PAN number (optional)"
          error={errors.pan?.message}
          icon={<MdOutlineDescription size={20} />}
          disabled={isLoading}
          onKeyDown={(e) => {
            // Digits, and the usual control/navigation keys, only — PAN is
            // strictly numeric in Nepal, no letters or punctuation.
            const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (allowed.includes(e.key) || e.metaKey || e.ctrlKey) return;
            if (!/^\d$/.test(e.key)) e.preventDefault();
          }}
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
      <div style={{ marginTop: spacing['2xl'] }}>
        <SectionLabel index={3}>Contact (optional)</SectionLabel>
        <FormRow>
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
        </FormRow>
      </div>

      <Button type="submit" isLoading={isLoading} size="lg">
        {isLoading ? 'Saving…' : 'Continue to dashboard →'}
      </Button>

      <style jsx>{`
        @media (max-width: 520px) {
          :global(.business-form-row) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </form>
  );
}
