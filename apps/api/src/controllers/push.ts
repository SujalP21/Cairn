import { promises as fs } from "node:fs";
import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getBucket } from "../config/aws-config";
import { getRepoPaths } from "../config/repoPaths";
import { logger } from "../lib/logger";

export async function pushRepo(): Promise<void> {
  const { commitsPath } = getRepoPaths();

  try {
    const bucket = getBucket();
    const s3 = getS3Client();
    const commitDirs = await fs.readdir(commitsPath);

    for (const commitDir of commitDirs) {
      const commitPath = path.join(commitsPath, commitDir);
      const files = await fs.readdir(commitPath);

      for (const file of files) {
        const fileContent = await fs.readFile(path.join(commitPath, file));

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: `commits/${commitDir}/${file}`,
            Body: fileContent,
          })
        );
      }
    }

    logger.info("All commits pushed to S3.");
  } catch (err) {
    logger.error({ err }, "Error pushing to S3");
    process.exitCode = 1;
  }
}
