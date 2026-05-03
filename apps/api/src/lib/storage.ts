import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'

export const S3_BUCKET = process.env.S3_BUCKET ?? 'clm-documents'

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID ?? 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'minioadmin',
  },
  forcePathStyle: true,
})

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }))
  } catch {
    // Bucket doesn't exist — create it
    await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }))
  }
}
