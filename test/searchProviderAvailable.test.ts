import { describe, expect, test } from "bun:test";
import type TokenRingApp from "@tokenring-ai/app";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import { isSearchProviderAvailable } from "../rpc/research.ts";

function appWith(services: Record<string, unknown>): Pick<TokenRingApp, "services"> {
  const registry = new KeyedRegistry<any>();
  for (const [name, service] of Object.entries(services)) registry.set(name, service);
  return { services: registry } as Pick<TokenRingApp, "services">;
}

describe("isSearchProviderAvailable", () => {
  test("is false without the websearch plugin", () => {
    expect(isSearchProviderAvailable(appWith({}))).toBe(false);
  });

  test("is false when websearch has no providers", () => {
    expect(isSearchProviderAvailable(appWith({ WebSearchService: { getAvailableProviders: () => [] } }))).toBe(false);
  });

  test("is true once a provider is registered", () => {
    expect(isSearchProviderAvailable(appWith({ WebSearchService: { getAvailableProviders: () => ["serper"] } }))).toBe(true);
  });
});
