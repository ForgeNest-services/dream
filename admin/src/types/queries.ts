export interface QueryItem {
  id: string;
  name: string;
  email: string;
  business_name: string | null;
  phone: string | null;
  app_interest: 'rms' | 'ims' | 'bundle' | null;
  message: string;
  created_at: string;
}
