import type { Instrumentation } from "next";

export async function register() {}

/** Any error a page, server action or API route doesn't handle is emailed to the Junbi team. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { alertError } = await import("./lib/alerts");
  await alertError(`${request.method} ${request.path.split("?")[0]}`, err, { Route: context.routePath, Kind: context.routeType });
};
