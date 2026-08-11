import { promises as fs } from "node:fs";
import path from "node:path";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getBucket, getS3Client } from "../../config/aws-config";
import { logger } from "../../lib/logger";
import { listObjects } from "../objects";
import { requireRepo } from "../paths";
import { listBranches, readBranch } from "../refs";

/**
 * Uploads objects and refs to S3.
 *
 * Objects are immutable and content-addressed, so anything already in the
 * bucket under the same key is byte-identical and can be skipped — which makes
 * a second push cost roughly nothing.
 */
export async function pushRepo(): Promise<void> {
  try {
    const repo = await requireRepo();
    const bucket = getBucket();
    const s3 = getS3Client();

    const hashes = await listObjects(repo);

    if (hashes.length === 0) {
      logger.warn("Nothing to push — no objects in this repository.");
      return;
    }

    let uploaded = 0;
    let skipped = 0;

    for (const hash of hashes) {
      const key = `objects/${hash.slice(0, 2)}/${hash.slice(2)}`;

      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        skipped += 1;
        continue;
      } catch {
        // Not present; upload below.
      }

      const body = await fs.readFile(
        path.join(repo.objectsPath, hash.slice(0, 2), hash.slice(2))
      );

      await s3.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body })
      );
      uploaded += 1;
    }

    // Refs are mutable and always overwritten — they are how a clone knows
    // where each branch now points.
    for (const branch of await listBranches(repo)) {
      const commit = await readBranch(repo, branch);
      if (!commit) continue;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `refs/heads/${branch}`,
          Body: Buffer.from(`${commit}\n`),
        })
      );
    }

    logger.info(
      `Pushed ${uploaded} new object(s), ${skipped} already present, ` +
        `and updated ${(await listBranches(repo)).length} ref(s).`
    );
  } catch (err) {
    logger.error({ err }, "Error pushing to S3");
    process.exitCode = 1;
  }
}
