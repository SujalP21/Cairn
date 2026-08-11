import mongoose, {
  type InferSchemaType,
  type Model,
  type Schema,
} from "mongoose";

/**
 * Registers a Mongoose model, reusing it if it already exists.
 *
 * Mongoose's model registry is process-global while the module registry is not,
 * so re-importing a model file — test files, watch-mode reloads, serverless
 * re-entry — would otherwise throw OverwriteModelError.
 *
 * Reading `mongoose.models[name]` directly returns the registry's loosely typed
 * index signature, and unioning that with the precise model type leaves every
 * method uncallable. Narrowing here keeps call sites fully typed.
 */
export function defineModel<TSchema extends Schema>(
  name: string,
  schema: TSchema
): Model<InferSchemaType<TSchema>> {
  type Doc = InferSchemaType<TSchema>;

  const existing = mongoose.models[name] as Model<Doc> | undefined;

  return existing ?? mongoose.model<Doc>(name, schema as Schema<Doc>);
}
