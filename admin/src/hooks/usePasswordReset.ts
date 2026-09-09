import { useState } from 'react';
import { toast } from 'sonner';
import { authApi } from '@/services/auth-api';
import { ApiError } from '@/types/auth';

interface ForgotPasswordResult {
  ok: boolean;
  expiresIn?: number;
}

interface VerifyResetOtpResult {
  ok: boolean;
  resetToken?: string;
}

export function usePasswordReset() {
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const sendResetOtp = async (email: string): Promise<ForgotPasswordResult> => {
    setIsSending(true);
    try {
      const response = await authApi.forgotPassword({ email });
      toast.success('A reset code has been sent to your email.');
      return { ok: true, expiresIn: response.data?.otp_expires_in };
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.code === 'USER_NOT_FOUND') {
        toast.error('No account found with this email.');
      } else if (apiErr?.code === 'GOOGLE_ACCOUNT') {
        toast.error("This account signs in with Google — there's no password to reset.");
      } else {
        toast.error(apiErr?.message || 'Could not send the reset code.');
      }
      return { ok: false };
    } finally {
      setIsSending(false);
    }
  };

  const verifyResetOtp = async (email: string, otpCode: string): Promise<VerifyResetOtpResult> => {
    setIsVerifying(true);
    try {
      const response = await authApi.verifyResetOtp({ email, otp_code: otpCode });
      const resetToken = response.data?.reset_token;
      if (!resetToken) {
        toast.error('Verification succeeded but response was incomplete.');
        return { ok: false };
      }
      return { ok: true, resetToken };
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.code === 'INVALID_OTP') {
        toast.error('Incorrect or expired code. Try again or resend a new one.');
      } else {
        toast.error(apiErr?.message || 'Could not verify the code.');
      }
      return { ok: false };
    } finally {
      setIsVerifying(false);
    }
  };

  const resetPassword = async (resetToken: string, newPassword: string): Promise<boolean> => {
    setIsResetting(true);
    try {
      await authApi.resetPassword({ reset_token: resetToken, new_password: newPassword });
      toast.success('Password reset. Please sign in with your new password.');
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.code === 'INVALID_RESET_TOKEN') {
        toast.error('This reset session has expired. Start over.');
      } else {
        toast.error(apiErr?.message || 'Could not reset the password.');
      }
      return false;
    } finally {
      setIsResetting(false);
    }
  };

  return {
    sendResetOtp,
    verifyResetOtp,
    resetPassword,
    isSending,
    isVerifying,
    isResetting,
  };
}
