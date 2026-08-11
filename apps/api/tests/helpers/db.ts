import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll } from "vitest";

let mongod: MongoMemoryServer | null = null;

/**
 * Boots a real MongoDB in-process for the calling test file, wipes every
 * collection between tests, and tears it down at the end.
 *
 * Using a real server rather than mocks is deliberate: the bugs this codebase
 * has actually had — visibility filters, populate, unique indexes, select:false
 * — all live in query behaviour that a mock would happily fake.
 */
export function useTestDatabase(): void {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri("cairn_test"));

    // Unique indexes are only enforced once built; without this, duplicate
    // username tests would pass for the wrong reason.
    await Promise.all(
      Object.values(mongoose.connection.models).map((model) =>
        model.createIndexes()
      )
    );
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;

    await Promise.all(
      Object.values(collections).map((collection) => collection.deleteMany({}))
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
    mongod = null;
  });
}
