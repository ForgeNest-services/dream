'use client';

import { useForm } from 'react-hook-form';
import { useBusinessRegister } from '@/hooks/useBusinessRegister';
import { BusinessRegisterRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import {
  MdOutlineBusiness,
  MdOutlineLocationOn,
  MdOutlineDescription,
  MdOutlineEmail,
  MdOutlinePhone,
} from 'react-icons/md';

export function BusinessRegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessRegisterRequest>();
  const { register: submitRegister, isLoading } = useBusinessRegister();

  const onSubmit = async (data: BusinessRegisterRequest) => {
    await submitRegister(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormInput
        {...register('business_name', { required: 'Business name is required' })}
        type="text"
        placeholder="e.g. Sunset Hotel Pvt Ltd"
        label="Business Name"
        error={errors.business_name?.message}
        icon={<MdOutlineBusiness size={20} />}
        disabled={isLoading}
      />

      <FormInput
        {...register('business_address', { required: 'Business address is required' })}
        type="text"
        placeholder="Street, city"
        label="Business Address"
        error={errors.business_address?.message}
        icon={<MdOutlineLocationOn size={20} />}
        disabled={isLoading}
      />

      <FormInput
        {...register('pan')}
        type="text"
        placeholder="e.g. 123456789"
        label="PAN / VAT Number"
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
        label="Business Email (optional)"
        error={errors.business_email?.message}
        icon={<MdOutlineEmail size={20} />}
        disabled={isLoading}
      />

      <FormInput
        {...register('business_phone')}
        type="tel"
        placeholder="+977 98XXXXXXXX"
        label="Business Phone (optional)"
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
