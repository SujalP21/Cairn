import { defineModel } from "../lib/defineModel";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { ISSUE_STATUSES } from "@cairn/shared";

const IssueSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      // Shared with the client so the two cannot disagree about valid states.
      enum: ISSUE_STATUSES,
      default: "open",
    },
    repository: {
      type: Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export type IssueAttrs = InferSchemaType<typeof IssueSchema>;
export type IssueDocument = HydratedDocument<IssueAttrs>;

const Issue = defineModel("Issue", IssueSchema);

export default Issue;
