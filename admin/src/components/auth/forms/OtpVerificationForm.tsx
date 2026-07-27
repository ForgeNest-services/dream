'use client';

import { useForm } from 'react-hook-form';
import { useVerifyOtp } from '@/hooks/useVerifyOtp';
import { VerifyOTPRequest } from '@/types/api';
import { Spinner } from '@/components/shared/Spinner';
import { Mail, Lock, AlertCircle } from 'lucide-react';

interface OtpVerificationFormProps {
  email: string;
}

export function OtpVerificationForm({ email }: OtpVerificationFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<VerifyOTPRequest>({
    defaultValues: { email },
  });
  const { verify, isLoading, error } = useVerifyOtp();

  const onSubmit = async (data: VerifyOTPRequest) => {
    await verify(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email (Read-only) */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="email"
            id="email"
            value={email}
            disabled
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          OTP sent to this email
        </p>
      </div>

      {/* OTP Code */}
      <div>
        <label htmlFor="otp_code" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Verification Code <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            {...register('otp_code', {
              required: 'Verification code is required',
              pattern: {
                value: /^\d{6}$/,
                message: 'Code must be 6 digits',
              },
            })}
            type="text"
            id="otp_code"
            maxLength={6}
            inputMode="numeric"
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="000000"
            disabled={isLoading}
          />
        </div>
        {errors.otp_code && (
          <p className="text-red-500 text-sm mt-1">{errors.otp_code.message}</p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Enter the 6-digit code sent to your email
        </p>
      </div>

      {/* API Error */}
      {error && (
        <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-200">Verification Failed</p>
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
        {isLoading ? 'Verifying...' : 'Verify & Continue'}
      </button>
    </form>
  );
}
