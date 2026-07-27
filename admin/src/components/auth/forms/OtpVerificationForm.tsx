'use client';

import { useForm } from 'react-hook-form';
import { useVerifyOtp } from '@/hooks/useVerifyOtp';
import { VerifyOTPRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlineEmail, MdOutlineLock, MdOutlineErrorOutline } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';

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
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Email (Read-only) */}
      <div style={{ marginBottom: spacing.xl }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.neutral[700], marginBottom: spacing.sm }}>
          Email
        </label>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: spacing.md, top: '12px', color: colors.neutral[400], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MdOutlineEmail size={20} />
          </div>
          <input
            type="email"
            value={email}
            disabled
            style={{
              width: '100%',
              paddingLeft: '44px',
              paddingRight: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: '8px',
              backgroundColor: colors.neutral[100],
              color: colors.neutral[600],
              cursor: 'not-allowed',
              fontFamily: 'inherit',
              fontSize: '14px',
            }}
          />
        </div>
        <p style={{ fontSize: '12px', color: colors.neutral[500], marginTop: spacing.xs }}>
          OTP sent to this email
        </p>
      </div>

      {/* OTP Code */}
      <div style={{ marginBottom: spacing.xl }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: colors.neutral[700], marginBottom: spacing.sm }}>
          Verification Code <span style={{ color: colors.status.error }}>*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: spacing.md, top: '12px', color: colors.neutral[400], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MdOutlineLock size={20} />
          </div>
          <input
            {...register('otp_code', {
              required: 'Verification code is required',
              pattern: {
                value: /^\d{6}$/,
                message: 'Code must be 6 digits',
              },
            })}
            type="text"
            maxLength={6}
            inputMode="numeric"
            disabled={isLoading}
            style={{
              width: '100%',
              paddingLeft: '44px',
              paddingRight: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              border: `1px solid ${errors.otp_code ? colors.status.error : colors.neutral[200]}`,
              borderRadius: '8px',
              backgroundColor: colors.neutral[0],
              color: colors.neutral[900],
              fontSize: '20px',
              fontWeight: '600',
              letterSpacing: '4px',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontFeatureSettings: 'none',
              transition: 'all 0.2s',
              cursor: isLoading ? 'not-allowed' : 'text',
              opacity: isLoading ? 0.6 : 1,
              boxShadow: errors.otp_code ? `0 0 0 3px ${colors.status.error}20` : 'none',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.primary[400];
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primary[400]}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = errors.otp_code ? colors.status.error : colors.neutral[200];
              e.currentTarget.style.boxShadow = errors.otp_code ? `0 0 0 3px ${colors.status.error}20` : 'none';
            }}
            placeholder="000000"
          />
        </div>
        {errors.otp_code && (
          <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
            <MdOutlineErrorOutline size={16} style={{ color: colors.status.error, flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '13px', color: colors.status.error }}>{errors.otp_code.message}</p>
          </div>
        )}
        <p style={{ fontSize: '12px', color: colors.neutral[500], marginTop: spacing.xs }}>
          Enter the 6-digit code sent to your email
        </p>
      </div>

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
              Verification Failed
            </p>
            <p style={{ color: colors.status.error, fontSize: '13px', opacity: 0.8 }}>
              {error.message}
            </p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button type="submit" isLoading={isLoading} size="lg">
        {isLoading ? 'Verifying...' : 'Verify & Continue'}
      </Button>
    </form>
  );
}
