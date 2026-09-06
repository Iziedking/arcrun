import type { MarketCapability, MarketProtocol, MarketProtocolState } from "../types.ts";

const PROTOCOL_ALIASES: Record<string, MarketProtocol> = {
  a2a: "A2A",
  mcp: "MCP",
  x402: "X402",
  b402: "X402",
  mpp: "MPP",
  erc8183: "ERC8183",
  "erc-8183": "ERC8183",
};

export function normalizeMarketProtocol(value: unknown): MarketProtocol | null {
  if (typeof value !== "string") return null;
  return PROTOCOL_ALIASES[value.trim().toLowerCase()] ?? null;
}

function stateFor(protocol: MarketProtocol, commerceBlockers: readonly string[]): { state: MarketProtocolState; reason: string } {
  if (protocol === "ERC8183" && commerceBlockers.length === 0) {
    return { state: "hireable", reason: "The provider passed the current payment and execution checks." };
  }
  if (protocol === "ERC8183") {
    return { state: "advertised", reason: "The provider advertises ERC-8183; run payment readiness checks before funding." };
  }
  if (protocol === "A2A" || protocol === "MCP") {
    return { state: "advertised", reason: "The provider advertises a callable agent interface; endpoint freshness is checked separately." };
  }
  return { state: "advertised", reason: "The provider advertises a payment face; Agon does not infer that payment or delivery is enabled." };
}

export function deriveMarketCapabilities(
  services: readonly { name: string; endpoint: string; version: string | null }[],
  commerceBlockers: readonly string[] = ["readiness_not_checked"],
): MarketCapability[] {
  const seen = new Set<MarketProtocol>();
  const capabilities: MarketCapability[] = [];
  for (const service of services) {
    const protocol = normalizeMarketProtocol(service.name);
    if (!protocol || seen.has(protocol)) continue;
    seen.add(protocol);
    const { state, reason } = stateFor(protocol, commerceBlockers);
    capabilities.push({ protocol, endpoint: service.endpoint, version: service.version, state, reason });
  }
  return capabilities;
}

export function protocolsFromValues(values: readonly unknown[]): MarketProtocol[] {
  return [...new Set(values.map(normalizeMarketProtocol).filter((value): value is MarketProtocol => value !== null))];
}
