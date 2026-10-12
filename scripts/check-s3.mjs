/** Run: npm run s3:check — probes the configured S3 bucket without disclosing credentials. */
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Same preference as Next.js: .env.local before .env; existing process env wins.
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const bucket = process.env.TASKLOOM_S3_BUCKET || process.env.AWS_BUCKET || process.env.S3_BUCKET;
const region = process.env.AWS_DEFAULT_REGION || process.env.S3_REGION || process.env.AWS_REGION;
const endpoint = process.env.TASKLOOM_S3_ENDPOINT || process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT;
const forcePathStyle = (process.env.AWS_USE_PATH_STYLE_ENDPOINT || process.env.S3_FORCE_PATH_STYLE) === 'true';

function errorDetails(error) {
  const code = error?.name || error?.code || error?.cause?.code || 'UnknownError';
  const http = error?.$metadata?.httpStatusCode;
  return `${code}${http ? ` (HTTP ${http})` : ''}`;
}

if (!bucket || !region) {
  console.error('Missing AWS_BUCKET or AWS_DEFAULT_REGION.');
  process.exitCode = 1;
} else {
  try {
    if (endpoint) {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('AWS_ENDPOINT must be a clean HTTP(S) S3 API URL.');
      }
      if (/(^|\.)rustfs\.test$/i.test(url.hostname) && url.pathname !== '/') {
        throw new Error('Use AWS_ENDPOINT=https://rustfs.test without /insure360. The bucket belongs in AWS_BUCKET.');
      }
    }
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) throw new Error('Provide both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
    const client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle,
      ...(accessKeyId && secretAccessKey ? {
        credentials: { accessKeyId, secretAccessKey, ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}) },
      } : {}),
      maxAttempts: 1,
    });
    console.log(`S3 bucket: ${bucket} | Region: ${region} | Path-style: ${forcePathStyle} | API host: ${endpoint ? new URL(endpoint).host : '(AWS default)'}`);
    if (new URL(endpoint || 'https://s3.amazonaws.com').hostname === 'lerd-rustfs') {
      console.warn('Lerd internal hostname detected. For host-run Node, add TASKLOOM_S3_ENDPOINT=http://127.0.0.1:9000 to .env.local.');
    }
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log('PASS: bucket accessible');
    const Key = `taskloom/diagnostics/${randomUUID()}.txt`;
    try {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key, Body: Buffer.from('taskloom-s3-check\n'), ContentType: 'text/plain' }));
      console.log('PASS: PutObject');
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key }));
      const body = await result.Body?.transformToString();
      if (body !== 'taskloom-s3-check\n') throw new Error('Downloaded diagnostic object differs from upload.');
      console.log('PASS: GetObject');
    } finally {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key })).then(
        () => console.log('PASS: DeleteObject'),
        error => console.warn(`Cleanup failed: ${errorDetails(error)}`),
      );
    }
    await client.destroy();
  } catch (error) {
    console.error(`FAIL: ${errorDetails(error)}`);
    // Only fixed troubleshooting tips, not raw URLs or SDK exception messages.
    console.error('Check: endpoint accessibility from host-run Node, bucket existence, RustFS region, credentials, and port mapping.');
    if ((endpoint || '').includes('lerd-rustfs')) {
      console.error('Set TASKLOOM_S3_ENDPOINT=http://127.0.0.1:9000 in .env.local; Lerd injects a container-network AWS_ENDPOINT.');
    }
    if (error?.cause?.code) console.error(`Underlying connection code: ${String(error.cause.code)}`);
    process.exitCode = 1;
  }
}
