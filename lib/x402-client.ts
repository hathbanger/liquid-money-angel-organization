/**
 * @purpose Lazy server-side x402 v2 buyer client. Builds a singleton x402Client
 * + payment-wrapped fetch on first use, backed by an EVM signer derived from
 * EVM_PRIVATE_KEY. Registered with the `eip155:*` wildcard so it answers any
 * EVM-network seller (Base Sepolia, Base mainnet, etc.).
 *
 * Why module-level singleton:
 *   The signer + client are pure JS objects with no per-request state, but
 *   they're non-trivial to construct (account derivation, scheme registration).
 *   Reusing the same instance across requests avoids re-running that on every
 *   /api/buy invocation.
 *
 * Required env:
 *   EVM_PRIVATE_KEY        — 0x-prefixed 32-byte hex of the buyer wallet
 *   X402_SELLER_URL_BASE   — base URL of the x402-protected seller (no trailing /)
 *
 * Optional:
 *   X402_MAX_AMOUNT_USDC   — soft ceiling on a single payment (string USDC),
 *                            checked against the seller's payment requirements
 *                            in the buy route before signing.
 */

import { x402Client, x402HTTPClient, wrapFetchWithPayment } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

export class X402ConfigError extends Error {
  constructor(message: string, public readonly code: 'MISSING_KEY' | 'MISSING_SELLER' | 'BAD_KEY') {
    super(message);
    this.name = 'X402ConfigError';
  }
}

interface X402Buyer {
  client: x402Client;
  http: x402HTTPClient;
  fetch: ReturnType<typeof wrapFetchWithPayment>;
  sellerBase: string;
  account: ReturnType<typeof privateKeyToAccount>;
}

let cached: X402Buyer | null = null;

function readSellerBase(): string {
  const raw = process.env.X402_SELLER_URL_BASE?.trim();
  if (!raw) {
    throw new X402ConfigError(
      'X402_SELLER_URL_BASE is not set. Add the x402-protected seller base URL to .env (e.g. https://seller.example.com).',
      'MISSING_SELLER',
    );
  }
  return raw.replace(/\/+$/, '');
}

function readPrivateKey(): `0x${string}` {
  const raw = process.env.EVM_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new X402ConfigError(
      'EVM_PRIVATE_KEY is not set. Add a 0x-prefixed 32-byte hex private key to .env (Base Sepolia funded wallet for testnet).',
      'MISSING_KEY',
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new X402ConfigError(
      'EVM_PRIVATE_KEY must be 0x-prefixed 32-byte hex (66 chars total).',
      'BAD_KEY',
    );
  }
  return raw as `0x${string}`;
}

export function getX402Buyer(): X402Buyer {
  if (cached) return cached;

  const sellerBase = readSellerBase();
  const account = privateKeyToAccount(readPrivateKey());

  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });

  const http = new x402HTTPClient(client);
  const paid = wrapFetchWithPayment(fetch, client);

  cached = { client, http, fetch: paid, sellerBase, account };
  return cached;
}

export function isX402Configured(): { ok: boolean; reason?: string } {
  try {
    readPrivateKey();
    readSellerBase();
    return { ok: true };
  } catch (err) {
    if (err instanceof X402ConfigError) return { ok: false, reason: err.message };
    return { ok: false, reason: (err as Error).message };
  }
}
