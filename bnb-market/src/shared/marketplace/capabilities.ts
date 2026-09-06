import type { Category, MarketCapability, MarketOutcomeMatch, MarketProtocol, MarketProtocolState } from "../types.ts";

const PROTOCOL_ALIASES: Record<string, MarketProtocol> = {
  a2a: "A2A",
  mcp: "MCP",
  x402: "X402",
  b402: "X402",
  mpp: "MPP",
  erc8183: "ERC8183",
  "erc-8183": "ERC8183",
};

const OUTCOME_MATCHES: Readonly<Record<Category, readonly string[]>> = {
  rebalancing: ["rebalanc", "liquidity position", "lp range", "range keeper", "price range", "resets positions", "concentrated lp"],
  "grid-trading": ["grid trading", "grid strategy", "grid order", "grid agent"],
  "yield-optimisation": ["yield", "apr", "apy", "liquidity to the best"],
  "health-factor": ["health factor", "liquidation", "collateral", "venus position"],
};

export function inferOutcomeMatches(name: string, description: string): MarketOutcomeMatch[] {
  const source = `${name} ${description}`.trim().toLowerCase();
  return (Object.entries(OUTCOME_MATCHES) as [Category, readonly string[]][])
    .filter(([, terms]) => terms.some((term) => source.includes(term)))
    .map(([category]) => ({
      category,
      source: "description" as const,
      reason: "This outcome match comes from provider-supplied name and description text. It is not a provider-declared category or verification.",
    }));
}

export function providerOutcomeMatch(category: Category): MarketOutcomeMatch {
  return { category, source: "provider", reason: "The provider declared this category in the ERC-8004 registration metadata." };
}

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
