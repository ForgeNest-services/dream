import { logger} from '@/lib/logger';

export default function Home() {
  logger.log('Rendering Admin Home Page');
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main>Admin UI</main>
    </div>
  );
}
