import { promises as fs } from "node:fs";
import path from "node:path";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getBucket, getS3Client } from "../../config/aws-config";
import { logger } from "../../lib/logger";
import { objectExists } from "../objects";
import { requireRepo } from "../paths";
import { writeBranch } from "../refs";

/** Lists every key under a prefix, following the pagination token. */
async function listAllKeys(
  s3: ReturnType<typeof getS3Client>,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );

    for (const object of page.Contents ?? []) {
      if (object.Key && !object.Key.endsWith("/")) keys.push(object.Key);
    }

    token = page.NextContinuationToken;
  } while (token);

  return keys;
}

export async function pullRepo(): Promise<void> {
  try {
    const repo = await requireRepo();
    const bucket = getBucket();
    const s3 = getS3Client();

    const objectKeys = await listAllKeys(s3, bucket, "objects/");

    if (objectKeys.length === 0) {
      logger.info("Nothing to pull — no objects found in S3.");
      return;
    }

    let downloaded = 0;
    let skipped = 0;

    for (const key of objectKeys) {
      const hash = key.replace("objects/", "").replace("/", "");

      // Content-addressed, so an object we already hold is identical by
      // definition and there is nothing to fetch.
      if (await objectExists(repo, hash)) {
        skipped += 1;
        continue;
      }

      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      if (!response.Body) continue;

      const target = path.join(
        repo.objectsPath,
        hash.slice(0, 2),
        hash.slice(2)
      );
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(
        target,
        Buffer.from(await response.Body.transformToByteArray())
      );

      downloaded += 1;
    }

    let refs = 0;
    for (const key of await listAllKeys(s3, bucket, "refs/heads/")) {
      const branch = key.replace("refs/heads/", "");

      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      if (!response.Body) continue;

      await writeBranch(
        repo,
        branch,
        (await response.Body.transformToString()).trim()
      );
      refs += 1;
    }

    logger.info(
      `Pulled ${downloaded} new object(s), ${skipped} already present, ` +
        `and updated ${refs} ref(s). Run "cairn checkout <branch>" to apply them.`
    );
  } catch (err) {
    logger.error({ err }, "Unable to pull");
    process.exitCode = 1;
  }
}
