import { AppDetailContent } from '@/components/dashboard/AppDetailContent';

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AppDetailContent slug={slug} />;
}
