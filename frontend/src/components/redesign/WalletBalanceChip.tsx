"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { useOperatorAddress } from "@/hooks/useAuth";
import { useLastGoodBalance, balanceAgo } from "@/hooks/useLastGoodBalance";
import { BRIDGE_CHAINS } from "@/lib/bridge";
import { getAgonBalanceTarget, type AgonNetworkKey } from "@/lib/agon/network";

/// The operator's payment-token balance, shown in the nav. On Agon routes the
/// selected network is the source of truth for the chain and token. Legacy
/// ArcRun routes retain their wallet-chain behavior, but an unknown wallet
/// chain has no fallback target. Two renders because the top bar has no room
/// on phones:
///   - `chip` (default): compact nav chip, shown from sm up.
///   - `row`: full-width row for the mobile drawer.
export function WalletBalanceChip({ variant = "chip", networkKey }: { variant?: "chip" | "row"; networkKey?: AgonNetworkKey }) {
  const { address: wagmiAddress } = useAccount();
  const { address: opAddress, isSignedIn } = useOperatorAddress();
  const address = (wagmiAddress ?? opAddress) as `0x${string}` | undefined;

  const chainId = useChainId();
  const target = useMemo(() => {
    if (networkKey) return getAgonBalanceTarget(networkKey);
    const chain = BRIDGE_CHAINS.find((candidate) => candidate.id === chainId);
    return chain ? {
      chainId: chain.id,
      tokenAddress: chain.usdcAddress,
      code: chain.code,
      symbol: "USDC",
      decimals: 6,
      label: chain.label,
    } : null;
  }, [chainId, networkKey]);

  const { data } = useReadContract({
    abi: erc20Abi,
    address: target?.tokenAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: target?.chainId as never,
    query: { enabled: Boolean(address && target), refetchInterval: 15_000 },
  });

  // Ride out RPC hiccups: fall back to the last-known-good balance (with its age)
  // when the live read has no value yet, instead of blanking to "—".
  const cacheKey = address && target ? `arcrun:bal:${target.chainId}:${target.tokenAddress}:${address.toLowerCase()}` : null;
  const { value, staleSeconds } = useLastGoodBalance(cacheKey, typeof data === "bigint" ? data : undefined);

  if (!isSignedIn || !address) return null;
  if (!target) {
    return (
      <span
        className="hidden items-center gap-2 border border-[color:var(--hairline-strong)] bg-canvas px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 sm:inline-flex"
        title="The selected network has no configured payment-token balance target."
      >
        <span>NO BALANCE READ</span>
      </span>
    );
  }
  const display = value != null ? Number(formatUnits(value, target.decimals)).toFixed(2) : "—";
  const stale = staleSeconds != null;
  const staleTitle = stale ? ` (as of ${balanceAgo(staleSeconds)} · RPC busy)` : "";

  if (variant === "row") {
    return (
      <div className="flex items-center justify-between border-b border-[color:var(--hairline)] py-3 font-mono text-[12px] uppercase tracking-[0.16em] last:border-0">
        <span className="text-ink-3">BALANCE</span>
        <span className="text-ink">
          {stale ? "~" : ""}{display} <span className="text-ink-3">{target.code} {target.symbol}</span>
          {stale ? <span className="ml-2 normal-case tracking-normal text-[10px]" style={{ color: "var(--warn)" }}>as of {balanceAgo(staleSeconds)}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <span
      className="hidden items-center gap-2 border border-[color:var(--hairline-strong)] bg-canvas px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink sm:inline-flex"
      title={`your ${target.symbol} balance on ${target.label}${staleTitle}`}
    >
      <span aria-hidden className="text-ink-3">{target.code}</span>
      <span>{stale ? "~" : ""}{display} {target.symbol}</span>
    </span>
  );
}
