import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

// Everything here resolves lazily: the module is loaded during CLI startup, at
// which point .env may not have been read yet, and commands that never touch S3
// (init/add/commit) must work with no AWS configuration at all.
export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
  }

  return client;
}

export function getBucket(): string {
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error(
      "S3_BUCKET is not set. Copy apps/api/.env.example to apps/api/.env and fill it in."
    );
  }

  return bucket;
}
