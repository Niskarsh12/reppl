import "server-only";
import { isQlooConfigured } from "../qloo/client";
import { demoProvider } from "./demo/provider";
import { qlooProvider } from "./qloo/provider";
import type { DiscoveryProvider } from "./types";

/**
 * Resolves the active discovery backend. Qloo is used whenever `QLOO_API_KEY`
 * is set; `DISCOVERY_PROVIDER=demo` forces the illustrative catalogue. The UI
 * consumes the same event stream either way.
 */
export function getDiscoveryProvider(): DiscoveryProvider {
  const choice = process.env.DISCOVERY_PROVIDER?.trim();
  if (choice === "demo") return demoProvider;
  if (choice === "qloo" || isQlooConfigured()) return qlooProvider;
  return demoProvider;
}
