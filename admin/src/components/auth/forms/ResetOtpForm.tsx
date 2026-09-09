'use client';

import { useEffect, useState } from 'react';
import { MdOutlineEmail, MdOutlineTimer, MdOutlineErrorOutline } from 'react-icons/md';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { OtpInput } from '@/components/ui/OtpInput';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/lib/design-tokens';

interface ResetOtpFormProps {
  email: string;
  initialExpiresIn?: number;
  onVerified: (resetToken: string) => void;
}

const DEFAULT_EXPIRY_SECONDS = 300;
const RESEND_COOLDOWN_SECONDS = 30;

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function ResetOtpForm({
  email,
  initialExpiresIn = DEFAULT_EXPIRY_SECONDS,
  onVerified,
}: ResetOtpFormProps) {
  const [code, setCode] = useState('');
  const [expirySeconds, setExpirySeconds] = useState(initialExpiresIn);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const { sendResetOtp, verifyResetOtp, isSending, isVerifying } = usePasswordReset();

  useEffect(() => {
    if (expirySeconds <= 0) return;
    const t = setTimeout(() => setExpirySeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [expirySeconds]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const codeExpired = expirySeconds <= 0;
  const canResend = resendCooldown <= 0 && !isSending;

  const submit = async () => {
    const value = code.trim();
    if (value.length !== 6 || codeExpired) return;
    const result = await verifyResetOtp(email, value);
    if (result.ok && result.resetToken) onVerified(result.resetToken);
  };

  const handleResend = async () => {
    if (!canResend) return;
    const result = await sendResetOtp(email);
    if (result.ok) {
      setExpirySeconds(result.expiresIn ?? DEFAULT_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setCode('');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `${spacing.sm} ${spacing.md}`,
          backgroundColor: colors.primary[50],
          border: `1px solid ${colors.primary[100]}`,
          borderRadius: '24px',
          marginBottom: spacing.xl,
          justifyContent: 'center',
        }}
      >
        <MdOutlineEmail size={16} style={{ color: colors.primary[800] }} />
        <span
          style={{
            fontSize: '13px',
            color: colors.primary[800],
            fontWeight: '500',
            wordBreak: 'break-all',
          }}
        >
          {email}
        </span>
      </div>

      <div style={{ marginBottom: spacing.md }}>
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: colors.neutral[700],
            marginBottom: spacing.md,
            textAlign: 'center',
          }}
        >
          Enter the 6-digit code
        </label>
        <OtpInput
          value={code}
          onChange={setCode}
          disabled={isVerifying || codeExpired}
          autoFocus
          hasError={codeExpired}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          fontSize: '13px',
          color: codeExpired ? colors.status.error : colors.neutral[600],
          marginBottom: spacing.lg,
          fontWeight: codeExpired ? '600' : '500',
        }}
      >
        {codeExpired ? (
          <>
            <MdOutlineErrorOutline size={16} />
            Code expired — resend a new one to continue.
          </>
        ) : (
          <>
            <MdOutlineTimer size={16} style={{ color: colors.neutral[500] }} />
            Code expires in{' '}
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: '700',
                color: expirySeconds <= 30 ? colors.status.error : colors.neutral[800],
              }}
            >
              {formatMMSS(expirySeconds)}
            </span>
          </>
        )}
      </div>

      <div
        style={{
          textAlign: 'center',
          fontSize: '13px',
          color: colors.neutral[600],
          marginBottom: spacing.xl,
        }}
      >
        Didn&apos;t get it?{' '}
        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={isSending}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: colors.primary[800],
              fontWeight: '600',
              cursor: isSending ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              fontSize: '13px',
            }}
          >
            {isSending ? 'Sending…' : 'Resend code'}
          </button>
        ) : (
          <span style={{ color: colors.neutral[500] }}>
            Resend available in {resendCooldown}s
          </span>
        )}
      </div>

      <Button
        type="submit"
        isLoading={isVerifying}
        size="lg"
        disabled={code.length !== 6 || codeExpired}
      >
        {isVerifying ? 'Verifying…' : 'Verify code'}
      </Button>
    </form>
  );
}
