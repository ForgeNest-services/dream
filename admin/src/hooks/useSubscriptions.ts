import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { appsApi } from '@/services/apps-api';
import type { AppSubscription, SubscriptionPayment, SubmitPaymentPayload, SubscriptionPlan } from '@/types/apps';

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<AppSubscription[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, pmtRes] = await Promise.all([
        appsApi.listMySubscriptions(),
        appsApi.listMyPayments(),
      ]);
      if (subRes.success && subRes.data) setSubscriptions(subRes.data);
      if (pmtRes.success && pmtRes.data) setPayments(pmtRes.data);
    } catch {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const forApp = (appCode: string) =>
    subscriptions.find((s) => s.app_code === appCode) ?? null;

  const submitPayment = async (payload: SubmitPaymentPayload): Promise<{ ok: boolean }> => {
    try {
      const res = await appsApi.submitPayment(payload);
      if (res.success) {
        toast.success('Payment request submitted. Our team will confirm shortly.');
        await fetchAll();
        return { ok: true };
      }
      toast.error(res.error?.message || 'Failed to submit payment');
      return { ok: false };
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit payment');
      return { ok: false };
    }
  };

  const fetchPlansForApp = async (appCode: string): Promise<SubscriptionPlan[]> => {
    try {
      const res = await appsApi.listPlans(appCode);
      return res.success && res.data ? res.data : [];
    } catch {
      return [];
    }
  };

  return { subscriptions, payments, loading, forApp, submitPayment, fetchPlansForApp, refresh: fetchAll };
}
