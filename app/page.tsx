import { getSnapshot } from '@/lib/data';
import { TaskloomApp } from '@/components/taskloom-app';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HomePage() {
  const data = await getSnapshot();
  return <TaskloomApp data={data} />;
}
