import { defineModel } from "../lib/defineModel";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      // Excluded from query results unless explicitly requested with
      // `.select("+password")`, so it cannot leak through a forgotten projection.
      select: false,
    },
    repositories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Repository",
      },
    ],
    followedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    starRepos: [
      {
        type: Schema.Types.ObjectId,
        ref: "Repository",
      },
    ],
  },
  { timestamps: true }
);

export type UserAttrs = InferSchemaType<typeof UserSchema>;
export type UserDocument = HydratedDocument<UserAttrs>;

const User = defineModel("User", UserSchema);

export default User;
