import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

type TypedHandler<TBody, TParams> = (
  req: Request<TParams, unknown, TBody>,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async route handler.
 *
 * Two jobs. First, Express 4 does not catch rejections from async handlers — an
 * unhandled one hangs the request until it times out — so this forwards them to
 * the error middleware, which is what replaces the per-handler try/catch blocks.
 *
 * Second, it carries the request body type. Express types `req.body` as `any`,
 * which erases everything the Zod schemas know. Declaring the matching input
 * type here turns the `validate()` middleware's runtime guarantee into a
 * compile-time one:
 *
 *   export const signup = asyncHandler<SignupInput>(async (req, res) => {
 *     const { username } = req.body; // string, not any
 *   });
 */
export function asyncHandler<TBody = unknown, TParams = ParamsDictionary>(
  fn: TypedHandler<TBody, TParams>
): RequestHandler {
  const handler: TypedHandler<TBody, TParams> = (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };

  // The generic body/params types are narrower than Express's `any`, so the
  // conversion needs the two-step widening. validate() is what makes it true.
  return handler as unknown as RequestHandler;
}
