import 'server-only';
import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const name = process.env.MONGODB_DB ?? 'taskloom';

declare global {
  var taskloomClientPromise: Promise<MongoClient> | undefined;

  var taskloomIndexesPromise: Promise<void> | undefined;
}

async function client(): Promise<MongoClient> {
  if (!global.taskloomClientPromise) {
    global.taskloomClientPromise = new MongoClient(uri, {
      serverSelectionTimeoutMS: 4000,
      maxPoolSize: 10,
    })
      .connect()
      .catch((error: unknown) => {
        global.taskloomClientPromise = undefined;
        throw error;
      });
  }
  return global.taskloomClientPromise;
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db(name);
  if (!global.taskloomIndexesPromise) {
    global.taskloomIndexesPromise = (async () => {
      await Promise.all([
        db.collection('lists').createIndex({ projectId: 1, position: 1 }),
        db.collection('tasks').createIndex({ projectId: 1, listId: 1, position: 1 }),
        db.collection('subtasks').createIndex({ taskId: 1, position: 1 }),
        db.collection('attachments').createIndex({ taskId: 1, createdAt: -1 }),
        db
          .collection('attachments')
          .createIndex(
            { taskId: 1, clientToken: 1 },
            { unique: true, partialFilterExpression: { clientToken: { $type: 'string' } } },
          ),
        db.collection('task_links').createIndex({ key: 1 }, { unique: true }),
        db.collection('project_task_links').createIndex({ key: 1 }, { unique: true }),
        db.collection('project_task_links').createIndex({ targetProjectId: 1 }),
        db.collection('import_batches').createIndex({ projectId: 1, createdAt: -1 }),
      ]);
    })().catch((error: unknown) => {
      global.taskloomIndexesPromise = undefined;
      throw error;
    });
  }
  await global.taskloomIndexesPromise;
  return db;
}
