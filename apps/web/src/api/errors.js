/**
 * Pulls a human-readable message out of an axios error.
 *
 * The API always answers failures with
 *   { error: { code, message, details? }, requestId? }
 * so this is the one place that shape is decoded. Falls back sensibly for
 * network failures and anything that did not come from our API.
 */
export function getErrorMessage(err, fallback = "Something went wrong.") {
  const body = err?.response?.data;

  if (body?.error?.message) {
    return body.error.message;
  }

  if (err?.code === "ERR_NETWORK") {
    return "Cannot reach the server. Is the API running?";
  }

  return err?.message ?? fallback;
}

/**
 * Field-level validation problems, as
 *   { "body.email": "must be a valid email address" }
 * Empty when the failure was not a validation error.
 */
export function getFieldErrors(err) {
  const details = err?.response?.data?.error?.details;

  if (!Array.isArray(details)) {
    return {};
  }

  return Object.fromEntries(
    details.map(({ field, message }) => [
      // Handlers care about "email", not "body.email".
      String(field).replace(/^(body|params|query)\./, ""),
      message,
    ])
  );
}
