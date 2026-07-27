'use client';

import { useForm } from 'react-hook-form';
import { useBusinessRegister } from '@/hooks/useBusinessRegister';
import { BusinessRegisterRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlineBusiness, MdOutlineLocationOn, MdOutlineDescription, MdOutlineEmail, MdOutlinePhone, MdOutlineErrorOutline } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';

export function BusinessRegisterForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<BusinessRegisterRequest>();
  const { register: submitRegister, isLoading, error } = useBusinessRegister();

  const onSubmit = async (data: BusinessRegisterRequest) => {
    await submitRegister(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormInput
        {...register('business_name', { required: 'Business name is required' })}
        type="text"
        placeholder="Your Business Name"
        label="Business Name"
        error={errors.business_name?.message}
        icon={<MdOutlineBusiness size={20} />}
        disabled={isLoading}
      />

      <FormInput
        {...register('business_address', { required: 'Business address is required' })}
        type="text"
        placeholder="123 Business Street"
        label="Business Address"
        error={errors.business_address?.message}
        icon={<MdOutlineLocationOn size={20} />}
        disabled={isLoading}
      />

      <FormInput
        {...register('pan')}
        type="text"
        placeholder="12345ABCDE"
        label="PAN (Tax ID)"
        error={errors.pan?.message}
        icon={<MdOutlineDescription size={20} />}
        disabled={isLoading}
      />

      <FormInput
        {...register('business_email', {
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: 'Invalid email address',
          },
        })}
        type="email"
        placeholder="business@example.com"
        label="Business Email"
        error={errors.business_email?.message}
        icon={<MdOutlineEmail size={20} />}
        disabled={isLoading}
      />

      <FormInput
        {...register('business_phone')}
        type="tel"
        placeholder="+1 (555) 000-0000"
        label="Business Phone"
        error={errors.business_phone?.message}
        icon={<MdOutlinePhone size={20} />}
        disabled={isLoading}
      />

      {/* API Error */}
      {error && (
        <div
          style={{
            padding: spacing.md,
            backgroundColor: `${colors.status.error}15`,
            border: `1px solid ${colors.status.error}30`,
            borderRadius: '8px',
            marginBottom: spacing.lg,
            display: 'flex',
            gap: spacing.md,
          }}
        >
          <div style={{ color: colors.status.error, flexShrink: 0 }}>
            <MdOutlineErrorOutline size={20} />
          </div>
          <div>
            <p style={{ fontWeight: '600', color: colors.status.error, fontSize: '14px' }}>
              Registration Failed
            </p>
            <p style={{ color: colors.status.error, fontSize: '13px', opacity: 0.8 }}>
              {error.message}
            </p>
          </div>
        </div>
      )}

      <Button type="submit" isLoading={isLoading} size="lg">
        {isLoading ? 'Registering...' : 'Complete Registration'}
      </Button>
    </form>
  );
}
