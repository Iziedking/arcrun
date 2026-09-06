import assert from "node:assert/strict";
import test from "node:test";
import { deriveMarketCapabilities, normalizeMarketProtocol, protocolsFromValues } from "./capabilities.ts";

test("normalizes the Studio protocol faces without inventing a provider capability", () => {
  assert.equal(normalizeMarketProtocol("A2A"), "A2A");
  assert.equal(normalizeMarketProtocol("b402"), "X402");
  assert.equal(normalizeMarketProtocol("erc-8183"), "ERC8183");
  assert.equal(normalizeMarketProtocol("unknown-protocol"), null);
  assert.deepEqual(protocolsFromValues(["A2A", "A2A", "MPP", "unknown"]), ["A2A", "MPP"]);
});

test("keeps advertised, reachable and hireable evidence separate", () => {
  const services = [
    { name: "A2A", endpoint: "https://provider.example/a2a", version: "1" },
    { name: "ERC8183", endpoint: "https://provider.example/status", version: "1" },
    { name: "X402", endpoint: "https://provider.example/x402", version: "1" },
  ];
  const pending = deriveMarketCapabilities(services);
  assert.deepEqual(pending.map((item) => item.state), ["advertised", "advertised", "advertised"]);
  const ready = deriveMarketCapabilities(services, []);
  assert.equal(ready.find((item) => item.protocol === "ERC8183")?.state, "hireable");
  assert.equal(ready.find((item) => item.protocol === "A2A")?.state, "advertised");
});
