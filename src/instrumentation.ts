import type { Instrumentation } from "next";

export async function register() {}

/** Any error a page, server action or API route doesn't handle is emailed to the Junbi team. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Written as an "if" block (not an early return) so the edge build drops the Node-only alert code.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { alertError } = await import("./lib/alerts");
    await alertError(`${request.method} ${request.path.split("?")[0]}`, err, { Route: context.routePath, Kind: context.routeType });
  }
};
