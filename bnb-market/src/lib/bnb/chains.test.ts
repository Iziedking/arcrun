import assert from "node:assert/strict";
import test from "node:test";

import { BNB_MAINNET_ID, BNB_TESTNET_ID, DEFAULT_BNB_CHAIN, getBnbNetwork, resolveBnbChain } from "./chains.ts";

test("BNB Testnet is the default market context", () => {
  assert.equal(DEFAULT_BNB_CHAIN, BNB_TESTNET_ID);
  assert.equal(getBnbNetwork(DEFAULT_BNB_CHAIN).id, BNB_TESTNET_ID);
});

test("explicit network links override the testnet default", () => {
  assert.equal(resolveBnbChain("bnb-mainnet"), BNB_MAINNET_ID);
  assert.equal(resolveBnbChain("56"), BNB_MAINNET_ID);
  assert.equal(resolveBnbChain("bnb-testnet"), BNB_TESTNET_ID);
  assert.equal(resolveBnbChain("unknown"), BNB_TESTNET_ID);
});
