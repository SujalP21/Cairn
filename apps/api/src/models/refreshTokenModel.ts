import { defineModel } from "../lib/defineModel";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// Refresh tokens are opaque random strings, never JWTs. Only their SHA-256
// digest is stored, so a database leak does not hand out usable sessions.
const RefreshTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Let MongoDB reap expired rows so the collection does not grow without bound.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenAttrs = InferSchemaType<typeof RefreshTokenSchema>;
export type RefreshTokenDocument = HydratedDocument<RefreshTokenAttrs>;

const RefreshToken = defineModel("RefreshToken", RefreshTokenSchema);

export default RefreshToken;
