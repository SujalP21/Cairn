import { defineModel } from "../lib/defineModel";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const RepositorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    content: [
      {
        type: String,
      },
    ],
    visibility: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    issues: [
      {
        type: Schema.Types.ObjectId,
        ref: "Issue",
      },
    ],
  },
  { timestamps: true }
);

export type RepositoryAttrs = InferSchemaType<typeof RepositorySchema>;
export type RepositoryDocument = HydratedDocument<RepositoryAttrs>;

const Repository = defineModel("Repository", RepositorySchema);

export default Repository;
