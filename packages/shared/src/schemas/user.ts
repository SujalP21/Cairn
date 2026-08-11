import { z } from "zod";

// Mirrors GitHub's own rule: alphanumerics and single hyphens, max 39 chars.
export const username = z
  .string()
  .trim()
  .min(3, "must be at least 3 characters")
  .max(39, "must be at most 39 characters")
  .regex(
    /^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/,
    "may only contain letters, numbers and single hyphens"
  );

// Normalise *before* validating. Chaining `.trim()` after `z.email()` would
// apply it only once the value had already passed the format check, so a
// pasted or autofilled address with a stray space would be rejected rather
// than cleaned up.
export const email = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email("must be a valid email address")
);

export const password = z
  .string()
  .min(8, "must be at least 8 characters")
  .max(200, "must be at most 200 characters");

export const signupSchema = z.object({
  username,
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "is required"),
});

// Every field optional, but at least one must be present.
export const updateProfileSchema = z
  .object({
    email: email.optional(),
    password: password.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "provide at least one field to update",
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
