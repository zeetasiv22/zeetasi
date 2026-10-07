import "server-only";
import { ProviderError } from "./rapidapi-client";
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function apiError(error: unknown) {
  return json(
    { error: error instanceof ProviderError ? error.code : "INVALID_REQUEST" },
    error instanceof ProviderError ? error.status : 400,
  );
}
