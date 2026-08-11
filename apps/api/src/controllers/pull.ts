import { promises as fs } from "node:fs";
import path from "node:path";
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getBucket } from "../config/aws-config";
import { getRepoPaths } from "../config/repoPaths";
import { logger } from "../lib/logger";

export async function pullRepo(): Promise<void> {
  const { repoPath, commitsPath } = getRepoPaths();

  try {
    const bucket = getBucket();
    const s3 = getS3Client();

    const data = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "commits/" })
    );

    const objects = data.Contents ?? [];

    if (objects.length === 0) {
      logger.info("Nothing to pull: no commits found in S3.");
      return;
    }

    for (const object of objects) {
      const key = object.Key;

      // Skip the zero-byte "folder" markers some tools create.
      if (!key || key.endsWith("/")) continue;

      const commitDir = path.join(
        commitsPath,
        path.dirname(key).split("/").pop() ?? ""
      );

      await fs.mkdir(commitDir, { recursive: true });

      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );

      if (!response.Body) continue;

      const body = await response.Body.transformToByteArray();
      await fs.writeFile(path.join(repoPath, key), Buffer.from(body));
    }

    logger.info(`All commits pulled from S3 (${objects.length} objects).`);
  } catch (err) {
    logger.error({ err }, "Unable to pull");
    process.exitCode = 1;
  }
}
