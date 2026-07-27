'use client';

import { useForm } from 'react-hook-form';
import { useBusinessRegister } from '@/hooks/useBusinessRegister';
import { BusinessRegisterRequest } from '@/types/api';
import { Spinner } from '@/components/shared/Spinner';
import { Building2, MapPin, AlertCircle, Mail, Phone } from 'lucide-react';

export function BusinessRegisterForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<BusinessRegisterRequest>();
  const { register: submitRegister, isLoading, error } = useBusinessRegister();

  const onSubmit = async (data: BusinessRegisterRequest) => {
    await submitRegister(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Business Name */}
      <div>
        <label htmlFor="business_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Business Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            {...register('business_name', { required: 'Business name is required' })}
            type="text"
            id="business_name"
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="Your Business Name"
            disabled={isLoading}
          />
        </div>
        {errors.business_name && (
          <p className="text-red-500 text-sm mt-1">{errors.business_name.message}</p>
        )}
      </div>

      {/* Business Address */}
      <div>
        <label htmlFor="business_address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Business Address <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            {...register('business_address', { required: 'Business address is required' })}
            type="text"
            id="business_address"
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="123 Business Street"
            disabled={isLoading}
          />
        </div>
        {errors.business_address && (
          <p className="text-red-500 text-sm mt-1">{errors.business_address.message}</p>
        )}
      </div>

      {/* PAN */}
      <div>
        <label htmlFor="pan" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          PAN (Tax ID)
        </label>
        <input
          {...register('pan')}
          type="text"
          id="pan"
          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          placeholder="12345ABCDE"
          disabled={isLoading}
        />
      </div>

      {/* Business Email */}
      <div>
        <label htmlFor="business_email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Business Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            {...register('business_email', {
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
            type="email"
            id="business_email"
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="business@example.com"
            disabled={isLoading}
          />
        </div>
        {errors.business_email && (
          <p className="text-red-500 text-sm mt-1">{errors.business_email.message}</p>
        )}
      </div>

      {/* Business Phone */}
      <div>
        <label htmlFor="business_phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Business Phone
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            {...register('business_phone')}
            type="tel"
            id="business_phone"
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="+1 (555) 000-0000"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* API Error */}
      {error && (
        <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-200">Registration Failed</p>
            <p className="text-sm text-red-800 dark:text-red-300">{error.message}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading && <Spinner size="sm" />}
        {isLoading ? 'Registering...' : 'Complete Registration'}
      </button>
    </form>
  );
}
