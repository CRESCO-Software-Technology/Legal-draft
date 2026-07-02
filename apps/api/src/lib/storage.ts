import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { FastifyReply } from 'fastify'

export const S3_BUCKET = process.env.S3_BUCKET ?? 'clm-documents'

// Prefer S3_* env vars (used by the production Cloud Run deploy + docker-compose)
// and fall back to AWS_* so this still works against real AWS S3 if anyone wires
// it up that way.
const accessKeyId = process.env.S3_ACCESS_KEY     ?? process.env.AWS_ACCESS_KEY_ID     ?? 'minioadmin'
const secretAccessKey = process.env.S3_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? 'minioadmin'
const region = process.env.S3_REGION ?? process.env.AWS_REGION ?? 'us-east-1'
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false'

const s3ClientConfig = {
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle,
  // GCS via the S3-compat XML API rejects the AWS-specific
  // `x-amz-checksum-crc32` / `x-amz-sdk-checksum-algorithm` headers the
  // v3 SDK adds by default — the headers end up in the signed-headers
  // list but GCS strips them, producing SignatureDoesNotMatch. Force the
  // SDK to only compute checksums when an operation strictly requires it.
  requestChecksumCalculation: 'WHEN_REQUIRED' as const,
  responseChecksumValidation: 'WHEN_REQUIRED' as const,
}

export const s3 = new S3Client({
  ...s3ClientConfig,
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
})

let presignClient: S3Client | null = null

function getPresignClient(): S3Client {
  if (!presignClient) {
    presignClient = new S3Client({
      ...s3ClientConfig,
      // Presigned URLs must target the host the browser can reach. When the API
      // talks to MinIO on localhost but users download from a public domain,
      // set S3_PUBLIC_ENDPOINT to that public URL (often an nginx proxy).
      endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    })
  }
  return presignClient
}

function isLoopbackEndpoint(endpoint: string): boolean {
  try {
    const host = new URL(endpoint).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local')
  } catch {
    return false
  }
}

/** True when presigned URLs would point at a host only the API can reach. */
export function needsS3DownloadProxy(): boolean {
  if (process.env.S3_PUBLIC_ENDPOINT) return false
  return isLoopbackEndpoint(process.env.S3_ENDPOINT ?? 'http://localhost:9000')
}

export async function getPresignedObjectUrl(
  command: GetObjectCommand,
  expiresIn = 3600,
): Promise<string> {
  const internalEndpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000'
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT ?? internalEndpoint
  const client = publicEndpoint === internalEndpoint ? s3 : getPresignClient()
  return getSignedUrl(client, command, { expiresIn })
}

export async function streamS3Object(
  command: GetObjectCommand,
  reply: FastifyReply,
  filename?: string,
): Promise<void> {
  const obj = await s3.send(command)
  const name = filename ?? command.input.Key?.split('/').pop() ?? 'download'
  reply.header('Content-Type', obj.ContentType ?? 'application/octet-stream')
  reply.header('Content-Disposition', `attachment; filename="${name}"`)
  if (obj.ContentLength != null) reply.header('Content-Length', obj.ContentLength)
  return reply.send(obj.Body)
}

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }))
  } catch {
    // Bucket doesn't exist — create it
    await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }))
  }
}
