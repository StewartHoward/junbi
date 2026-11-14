"use server";

import { marketingUnsubscribe } from "@/data/marketing";

export async function marketingUnsubscribeAction(token: string): Promise<{ done: boolean }> {
  return { done: await marketingUnsubscribe(token) };
}
