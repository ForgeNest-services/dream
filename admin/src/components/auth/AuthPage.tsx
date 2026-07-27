'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from './forms/LoginForm';
import { RegisterForm } from './forms/RegisterForm';
import { OtpVerificationForm } from './forms/OtpVerificationForm';
import { Spinner } from '@/components/shared/Spinner';

type AuthStep = 'login' | 'register' | 'verify-otp';

export function AuthPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [step, setStep] = useState<AuthStep>('login');
  const [registrationEmail, setRegistrationEmail] = useState('');

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Dream</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Admin Dashboard</p>
        </div>

        {/* Tabs */}
        {step !== 'verify-otp' && (
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setStep('login')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                step === 'login'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setStep('register')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                step === 'register'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Forms */}
        {step === 'login' && <LoginForm />}

        {step === 'register' && (
          <RegisterForm
            onSuccess={(email) => {
              setRegistrationEmail(email);
              setStep('verify-otp');
            }}
          />
        )}

        {step === 'verify-otp' && (
          <div>
            <button
              onClick={() => setStep('register')}
              className="mb-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back
            </button>
            <OtpVerificationForm email={registrationEmail} />
          </div>
        )}
      </div>
    </div>
  );
}
