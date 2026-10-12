import { MongoClient, ObjectId } from 'mongodb';
import { config } from 'dotenv';

config({ path: '.env.local' });

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const name = process.env.MONGODB_DB ?? 'taskloom';
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

async function main() {
  await client.connect();
  const db = client.db(name);
  if (await db.collection('projects').countDocuments()) {
    console.log('Workspace already has projects; no sample records were added.');
    return;
  }
  const seed = [
    {
      name: 'Insure360',
      description: 'Engineering quality, performance, and framework upgrades.',
      color: '#7366e8',
      lists: [
        {
          title: 'Getting ready',
          description: 'Establish a clean baseline',
          tasks: [
            {
              title: 'Push current code to Git',
              status: 'in_progress',
              priority: 'high',
              dueDate: day(2),
              subs: [
                ['Check branch and remote', 'completed'],
                ['Create baseline commit', 'in_progress'],
                ['Confirm remote push', 'pending'],
              ],
            },
            {
              title: 'Audit code using multiple tools',
              status: 'in_progress',
              priority: 'high',
              dueDate: day(4),
              subs: [
                ['PHPStan analysis', 'completed'],
                ['Run automated tests', 'in_progress'],
                ['Document findings', 'pending'],
              ],
            },
            {
              title: 'Fix formatting issues',
              status: 'pending',
              priority: 'medium',
              dueDate: day(6),
              subs: [],
            },
          ],
        },
        {
          title: 'Quality & optimization',
          description: 'Measure first, improve second',
          tasks: [
            {
              title: 'Check every page for errors',
              status: 'in_progress',
              priority: 'high',
              dueDate: day(1),
              subs: [
                ['Admin pages', 'completed'],
                ['Tenant pages', 'in_progress'],
                ['Portal workflows', 'pending'],
              ],
            },
            {
              title: 'Optimize code where required',
              status: 'pending',
              priority: 'medium',
              dueDate: day(8),
              subs: [],
            },
            {
              title: 'Add environment-aware diagnostic logs',
              status: 'blocked',
              priority: 'high',
              dueDate: day(3),
              subs: [
                ['Define logging policy', 'completed'],
                ['Avoid sensitive payloads', 'pending'],
              ],
            },
            {
              title: 'Remove deprecated and unused code',
              status: 'pending',
              priority: 'low',
              dueDate: day(10),
              subs: [],
            },
          ],
        },
        {
          title: 'Upgrades',
          description: 'Safe staged framework migration',
          tasks: [
            {
              title: 'Replace conflicting custom app() helper',
              status: 'pending',
              priority: 'medium',
              dueDate: day(9),
              subs: [],
            },
            {
              title: 'Upgrade Filament 3 → 4 → 5',
              status: 'pending',
              priority: 'high',
              dueDate: day(15),
              subs: [
                ['Audit compatibility', 'pending'],
                ['Upgrade to 4', 'pending'],
                ['Upgrade to 5', 'pending'],
              ],
            },
            {
              title: 'Upgrade Laravel to 13',
              status: 'pending',
              priority: 'high',
              dueDate: day(20),
              subs: [],
            },
          ],
        },
      ],
    },
    {
      name: 'Website refresh',
      description: 'A sharper experience for customers from landing to launch.',
      color: '#4f9cdc',
      lists: [
        {
          title: 'Design',
          description: 'Visual and interaction polish',
          tasks: [
            {
              title: 'Define component system',
              status: 'completed',
              priority: 'high',
              dueDate: day(-3),
              subs: [
                ['Colors and typography', 'completed'],
                ['Component audit', 'completed'],
              ],
            },
            {
              title: 'Build responsive navigation',
              status: 'in_progress',
              priority: 'medium',
              dueDate: day(5),
              subs: [],
            },
            { title: 'Accessibility review', status: 'pending', priority: 'high', dueDate: day(7), subs: [] },
          ],
        },
        {
          title: 'Release',
          description: 'Launch readiness',
          tasks: [
            {
              title: 'Test mobile breakpoints',
              status: 'pending',
              priority: 'medium',
              dueDate: day(11),
              subs: [],
            },
            { title: 'Ship new homepage', status: 'pending', priority: 'high', dueDate: day(16), subs: [] },
          ],
        },
      ],
    },
    {
      name: 'Personal workspace',
      description: 'Small improvements that compound over time.',
      color: '#48b59b',
      lists: [
        {
          title: 'This month',
          description: 'High-leverage habits',
          tasks: [
            {
              title: 'Review weekly goals',
              status: 'completed',
              priority: 'medium',
              dueDate: day(-1),
              subs: [],
            },
            {
              title: 'Organize project documentation',
              status: 'in_progress',
              priority: 'medium',
              dueDate: day(5),
              subs: [
                ['Collect documents', 'completed'],
                ['Create index', 'pending'],
              ],
            },
            {
              title: 'Plan next learning sprint',
              status: 'pending',
              priority: 'low',
              dueDate: day(12),
              subs: [],
            },
          ],
        },
      ],
    },
  ] as const;
  for (const [pi, p] of seed.entries()) {
    const projectId = new ObjectId();
    await db.collection('projects').insertOne({
      _id: projectId,
      name: p.name,
      description: p.description,
      color: p.color,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    for (const [li, l] of p.lists.entries()) {
      const listId = new ObjectId();
      await db.collection('lists').insertOne({
        _id: listId,
        projectId: String(projectId),
        title: l.title,
        description: l.description,
        position: pi * 10000 + li,
        createdAt: new Date(),
      });
      for (const [ti, t] of l.tasks.entries()) {
        const taskId = new ObjectId();
        await db.collection('tasks').insertOne({
          _id: taskId,
          projectId: String(projectId),
          listId: String(listId),
          title: t.title,
          description: '',
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          position: ti,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        for (const [si, [title, status]] of t.subs.entries())
          await db.collection('subtasks').insertOne({
            _id: new ObjectId(),
            projectId: String(projectId),
            taskId: String(taskId),
            title,
            status,
            dueDate: null,
            position: si,
            createdAt: new Date(),
          });
      }
    }
  }
  console.log('Seeded three projects with sample lists, tasks, and subtasks.');
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.close());
