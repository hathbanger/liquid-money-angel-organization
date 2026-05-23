# visa-cli × Next.js — complete API route integration guide

Everything you need to leverage **all parts of `visa-cli`** from a Next.js App Router app via Route Handlers (`app/api/**/route.ts`).

**Version note:** written against `visa-cli` 2.2.x. Run `visa-cli --version` and `visa-cli <cmd> --help` to confirm flags haven't drifted.

---

## Table of contents

1. [Architecture](#1-architecture)
2. [Prerequisites](#2-prerequisites)
3. [Core library (`lib/visa-cli.ts`)](#3-core-library-libvisa-clits)
4. [Output modes — envelopes vs raw JSON vs TUI](#4-output-modes--envelopes-vs-raw-json-vs-tui)
5. [Route layout](#5-route-layout)
6. [Route Handler template](#6-route-handler-template)
7. [Command reference — every visa-cli surface](#7-command-reference--every-visa-cli-surface)
8. [Media persistence](#8-media-persistence)
9. [Database schema](#9-database-schema)
10. [Security](#10-security)
11. [Deployment](#11-deployment)
12. [Environment variables](#12-environment-variables)
13. [Error handling](#13-error-handling)
14. [Testing](#14-testing)
15. [Quick-start checklist](#15-quick-start-checklist)

---

## 1. Architecture

```
┌─────────────┐     POST /api/visa/*      ┌──────────────────────┐
│   Browser   │ ────────────────────────► │  Next.js Route Handler│
│  (client)   │ ◄──────────────────────── │  runtime: nodejs      │
└─────────────┘     JSON response         └──────────┬───────────┘
                                                       │ execFile (no shell)
                                                       ▼
                                            ┌──────────────────────┐
                                            │  visa-cli on PATH    │
                                            │  ~/.visa-mcp/ creds  │
                                            │  auth.visacli.sh     │
                                            └──────────┬───────────┘
                                                       │
                       ┌───────────────────────────────┼───────────────────────────────┐
                       ▼                               ▼                               ▼
                 Paid envelope                   Raw JSON                          TUI text
            (run-llm, generate *)            (config list, merchants)          (status, describe)
                       │                               │
                       ▼                               ▼
              fetch(urls) + re-host              return parsed JSON
              to Blob/S3/Supabase                to client
```

### Rules

| Rule | Why |
|------|-----|
| **Server only** | `visa-cli` holds payment credentials in `~/.visa-mcp/` |
| **`runtime = "nodejs"`** | Edge runtime cannot spawn subprocesses |
| **`execFile` + argv array** | Prevents shell injection on user prompts |
| **Auth every paid route** | Every generation call charges your Visa card |
| **Re-host media URLs** | Provider URLs (`*.fal.media`, etc.) are transient |
| **Never call from `"use client"`** | Browser has no CLI, no keychain, no enrollment |

---

## 2. Prerequisites

### Install & enroll (once per machine / container)

```bash
npm install -g visa-cli
visa-cli setup              # browser OAuth + attestation key
visa-cli status             # enrolled, cards, spend headroom
which visa-cli              # must resolve in the Next.js server process
visa-cli --version          # ≥ 2.0.2 recommended
```

### Smoke test (paid, ~$0.01)

```bash
visa-cli generate image "smoke test" --fast --json --yes
```

Expected stdout (one JSON line):

```json
{"success":true,"command":"generate.image","ts":"…","amount":0.01,"urls":["https://v3b.fal.media/…"]}
```

### Next.js deps

No npm package for visa-cli — it's a global binary. Optional storage:

```bash
pnpm add @vercel/blob          # Vercel Blob
# or @aws-sdk/client-s3, @supabase/supabase-js, etc.
```

---

## 3. Core library (`lib/visa-cli.ts`)

Single module that every API route imports. Never spawn the CLI inside route files directly.

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLI = process.env.VISA_CLI_PATH ?? "visa-cli";

/** Canonical paid-command envelope (run-llm, generate.*) */
export type VisaEnvelope = {
  success: boolean;
  command: string;
  ts: string;
  amount?: number;
  transactionId?: string;
  merchantName?: string;
  currency?: string;
  urls?: string[];
  filePath?: string;
  mime?: string;
  bytes?: number;
  text?: string;
  toolId?: string;
  error?: string;
  errorCode?: string;
};

export class VisaCliError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "TIMEOUT" | "PARSE" | "ENVELOPE" | "IO",
    public readonly stderr?: string,
  ) {
    super(message);
  }
}

type RunOpts = {
  stdin?: string;
  timeoutMs?: number;
  /** Append --json --yes (default true for paid commands) */
  envelope?: boolean;
  maxBuffer?: number;
};

/**
 * Spawn visa-cli. Returns parsed envelope OR raw stdout string.
 */
export async function runVisaCli(
  args: string[],
  opts: RunOpts = {},
): Promise<VisaEnvelope | string> {
  const envelope = opts.envelope ?? true;
  const fullArgs = [...args];

  if (envelope) {
    if (!fullArgs.includes("--json")) fullArgs.push("--json");
    if (!fullArgs.includes("--yes")) fullArgs.push("--yes");
  }

  let stdout: string;
  let stderr: string;

  try {
    const result = await execFileAsync(CLI, fullArgs, {
      timeout: opts.timeoutMs ?? 120_000,
      maxBuffer: opts.maxBuffer ?? 10 * 1024 * 1024,
      input: opts?.stdin,
      env: process.env,
    });
    stdout = result.stdout;
    stderr = result.stderr ?? "";
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    if (e.code === "ENOENT") {
      throw new VisaCliError(
        `visa-cli not found (set VISA_CLI_PATH)`,
        "NOT_FOUND",
      );
    }
    if (e.killed) {
      throw new VisaCliError(`visa-cli timed out`, "TIMEOUT", e.stderr);
    }
    throw new VisaCliError(e.message ?? "visa-cli io error", "IO", e.stderr);
  }

  if (stderr.trim()) {
    console.debug("[visa-cli stderr]", stderr.trim());
  }

  if (!envelope) {
    return stdout;
  }

  const line = stdout
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("{"));

  if (!line) {
    throw new VisaCliError(
      `no envelope in stdout (${stdout.length} bytes)`,
      "PARSE",
      stderr,
    );
  }

  const parsed = JSON.parse(line) as VisaEnvelope;
  if (!parsed.success) {
    throw new VisaCliError(
      parsed.error ?? "visa-cli command failed",
      "ENVELOPE",
      stderr,
    );
  }

  return parsed;
}

/** Parse raw JSON stdout (config list, merchants tools, etc.) */
export async function runVisaCliJson<T>(
  args: string[],
  opts?: Omit<RunOpts, "envelope">,
): Promise<T> {
  const stdout = (await runVisaCli(args, { ...opts, envelope: false })) as string;
  return JSON.parse(stdout) as T;
}

// ─── Typed helpers ───────────────────────────────────────────────────────────

export async function generateImage(opts: {
  prompt: string;
  tool?: string;
  fast?: boolean;
  quality?: "standard" | "high";
  imageRef?: string;
}) {
  const args = ["generate", "image", "-"];
  if (opts.fast) args.push("--fast");
  if (opts.tool) args.push("--tool", opts.tool);
  if (opts.quality) args.push("--quality", opts.quality);
  if (opts.imageRef) args.push("--image-ref", opts.imageRef);
  return runVisaCli(args, { stdin: opts.prompt }) as Promise<VisaEnvelope>;
}

export async function generateVideo(opts: {
  prompt: string;
  tool?: string;
  aspectRatio?: string;
  duration?: number;
}) {
  const args = ["generate", "video", "-"];
  if (opts.tool) args.push("--tool", opts.tool);
  if (opts.aspectRatio) args.push("--aspect-ratio", opts.aspectRatio);
  if (opts.duration != null) args.push("--duration", String(opts.duration));
  return runVisaCli(args, { stdin: opts.prompt, timeoutMs: 300_000 }) as Promise<VisaEnvelope>;
}

export async function generateMusic(opts: {
  prompt: string;
  tool?: string;
  instrumental?: boolean;
  duration?: number;
}) {
  const args = ["generate", "music", "-"];
  if (opts.tool) args.push("--tool", opts.tool);
  if (opts.instrumental) args.push("--instrumental");
  if (opts.duration != null) args.push("--duration", String(opts.duration));
  return runVisaCli(args, { stdin: opts.prompt, timeoutMs: 180_000 }) as Promise<VisaEnvelope>;
}

export async function generateSpeech(opts: {
  text: string;
  tool?: string;
  audioUrl?: string;
}) {
  const args = ["generate", "speech", "-"];
  if (opts.tool) args.push("--tool", opts.tool);
  if (opts.audioUrl) args.push("--audio-url", opts.audioUrl);
  return runVisaCli(args, { stdin: opts.text }) as Promise<VisaEnvelope>;
}

export async function generate3d(opts: { imageUrl: string; tool?: string }) {
  const args = ["generate", "3d", "-"];
  if (opts.tool) args.push("--tool", opts.tool);
  return runVisaCli(args, { stdin: opts.imageUrl, timeoutMs: 300_000 }) as Promise<VisaEnvelope>;
}

export async function runLlm(opts: {
  prompt: string;
  model?: string;
  tier?: "fast" | "reasoning" | "deep_reasoning" | "search" | "open_source" | "coding";
  system?: string;
  maxTokens?: number;
  temperature?: number;
  imageUrl?: string;
}) {
  const args = ["run-llm", "-"];
  if (opts.model) args.push("--model", opts.model);
  else if (opts.tier) args.push("--tier", opts.tier);
  if (opts.system) args.push("--system", opts.system);
  if (opts.maxTokens != null) args.push("--max-tokens", String(opts.maxTokens));
  if (opts.temperature != null) args.push("--temperature", String(opts.temperature));
  if (opts.imageUrl) args.push("--image-url", opts.imageUrl);
  return runVisaCli(args, { stdin: opts.prompt }) as Promise<VisaEnvelope>;
}

export async function listConfig() {
  return runVisaCliJson<{ config: Array<{ key: string; value: unknown; source: string }> }>(
    ["config", "list", "--json"],
    { envelope: false } as RunOpts,
  );
}

export async function getConfig(key: string) {
  const stdout = (await runVisaCli(["config", "get", key, "--raw"], {
    envelope: false,
  })) as string;
  return stdout.trim();
}

export async function setConfig(key: string, value: string) {
  return runVisaCli(["config", "set", key, value], { envelope: false });
}

export async function unsetConfig(key: string) {
  return runVisaCli(["config", "unset", key], { envelope: false });
}

export async function listMerchants() {
  return runVisaCliJson<{ merchants: unknown[] }>(["merchants", "list", "--json"]);
}

export async function listTools(opts?: {
  category?: "image" | "video" | "audio" | "3d" | "llm";
  query?: string;
  limit?: number;
  offset?: number;
}) {
  const args = ["merchants", "tools", "--json"];
  if (opts?.category) args.push("--category", opts.category);
  if (opts?.query) args.push("--query", opts.query);
  if (opts?.limit != null) args.push("--limit", String(opts.limit));
  if (opts?.offset != null) args.push("--offset", String(opts.offset));
  return runVisaCliJson<{ tools: CatalogTool[] }>(args);
}

export type CatalogTool = {
  id: string;
  name: string;
  description?: string;
  price_cents?: number;
  category?: string;
};

export async function listTokens() {
  return runVisaCliJson<{ tokens: unknown[] }>(["tokens", "list", "--json"]);
}

export async function createToken(opts: {
  label?: string;
  tools?: string[];
  dailyCapUsd?: number;
}) {
  const args = ["tokens", "create"];
  if (opts.label) args.push(opts.label);
  if (opts.tools?.length) args.push("--tools", opts.tools.join(","));
  if (opts.dailyCapUsd != null) args.push("--daily-cap", String(opts.dailyCapUsd));
  args.push("--json");
  return runVisaCliJson<{ token: unknown }>(args);
}

export async function revokeToken(id: string) {
  return runVisaCli(["tokens", "revoke", id], { envelope: false });
}

export async function submitFeedback(message: string) {
  return runVisaCli(["feedback", message], { envelope: false });
}
```

---

## 4. Output modes — envelopes vs raw JSON vs TUI

Not every command emits the canonical paid envelope. Route your parser accordingly.

| Mode | Commands | Parser |
|------|----------|--------|
| **Paid envelope** | `run-llm`, `generate image\|video\|music\|speech\|3d` | First `{…}` line → `VisaEnvelope` |
| **Raw JSON** | `config list --json`, `merchants list --json`, `merchants tools --json`, `tokens list --json`, `tokens create --json` | `JSON.parse(stdout)` |
| **Plain text** | `config get --raw` | Return trimmed string |
| **TUI / human** | `status`, `cards list`, `balance show`, `merchants describe`, `config biometric status` | **Avoid in API routes** — parse fragile. Use JSON equivalents where available. |
| **Interactive** | `setup`, `cards add`, `balance topup`, `config biometric off` | **Not for API routes** — need browser OAuth or Touch ID |

### Paid envelope shape

```typescript
{
  success: true,
  command: "generate.image" | "run-llm" | "generate.video" | …,
  ts: "2026-05-22T08:44:07.720Z",
  amount?: 0.04,
  transactionId?: "…",
  merchantName?: "FLUX Pro",
  urls?: ["https://v3b.fal.media/…"],   // media — download immediately
  filePath?: "/path/to/file",           // rare — local file written by CLI
  mime?: "image/jpeg",
  bytes?: 123456,
  text?: "LLM response text",           // run-llm
  error?: "…",                          // when success: false
  errorCode?: "…"
}
```

---

## 5. Route layout

Suggested App Router structure — one domain per route file:

```
app/api/visa/
├── llm/route.ts              POST  run-llm
├── generate/
│   ├── image/route.ts        POST
│   ├── video/route.ts        POST
│   ├── music/route.ts        POST
│   ├── speech/route.ts       POST
│   └── 3d/route.ts           POST
├── catalog/
│   ├── tools/route.ts        GET   merchants tools (model/media picker)
│   └── merchants/route.ts    GET   merchants list
├── config/
│   ├── route.ts              GET list | POST set/unset
│   └── [key]/route.ts        GET single key
├── tokens/
│   ├── route.ts              GET list | POST create
│   └── [id]/route.ts         DELETE revoke
├── account/
│   └── status/route.ts       GET   derived status from config list
└── feedback/route.ts         POST
```

Alternative: single proxy route `app/api/visa/route.ts` with `{ "command": "generate.image", "args": … }` — simpler to maintain, less RESTful.

---

## 6. Route Handler template

Every paid route follows this shape:

```typescript
// app/api/visa/generate/image/route.ts
import { NextResponse } from "next/server";
import { generateImage, VisaCliError } from "@/lib/visa-cli";
import { persistFromEnvelope } from "@/lib/persist-media";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  prompt: string;
  tool?: string;
  fast?: boolean;
  quality?: "standard" | "high";
  imageRef?: string;
  persist?: boolean; // default true — re-host to durable storage
};

export async function POST(req: Request) {
  // TODO: await requireAuth(req);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  if (body.prompt.length > 8000) {
    return NextResponse.json({ error: "prompt too long" }, { status: 400 });
  }

  try {
    const envelope = await generateImage(body);

    if (body.persist !== false && envelope.urls?.length) {
      const stored = await persistFromEnvelope(envelope, {
        kind: "image",
        prompt: body.prompt,
        tool: body.tool,
      });
      return NextResponse.json({
        success: true,
        command: envelope.command,
        amount: envelope.amount,
        url: stored.url,
        id: stored.id,
        mime: stored.mime,
        bytes: stored.bytes,
      });
    }

    return NextResponse.json({
      success: true,
      command: envelope.command,
      amount: envelope.amount,
      urls: envelope.urls,
      text: envelope.text,
      filePath: envelope.filePath,
    });
  } catch (err) {
    if (err instanceof VisaCliError) {
      const status =
        err.code === "TIMEOUT" ? 504 :
        err.code === "NOT_FOUND" ? 503 :
        502;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

### Read-only catalog route

```typescript
// app/api/visa/catalog/tools/route.ts
import { NextResponse } from "next/server";
import { listTools, VisaCliError } from "@/lib/visa-cli";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;

  try {
    const data = await listTools({
      category: category as "llm" | "image" | undefined,
      query: searchParams.get("q") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 100),
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof VisaCliError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

---

## 7. Command reference — every visa-cli surface

### Legend

| Suitability | Meaning |
|-------------|---------|
| ✅ API-ready | Spawn from route handler, parse JSON |
| ⚠️ Admin-only | Works but needs human interaction (Touch ID, browser) — expose only to trusted admins |
| ❌ Not for API | Setup/maintenance — run manually in terminal |
| 📋 Read-only | Safe, no spend |

---

### `setup` — first-time enrollment

```bash
visa-cli setup [--yes] [--hud] [--no-hud] [--check]
```

| | |
|---|---|
| Suitability | ❌ Not for API — opens browser for OAuth |
| Action | Run once manually: `visa-cli setup` |
| API alternative | Expose `/api/visa/account/status` that returns enrollment state from `config list --json` |

---

### `status` — account health

```bash
visa-cli status
```

| | |
|---|---|
| Suitability | ⚠️ TUI output — hard to parse |
| API alternative | Derive status from JSON sources |

```typescript
// app/api/visa/account/status/route.ts
const config = await listConfig();
const tools = await listTools({ category: "llm", limit: 5 });
return NextResponse.json({
  config: config.config,
  recentLlmTools: tools.tools,
});
```

Key config keys for a status dashboard:

| Key | Meaning |
|-----|---------|
| `account.enrolled` | `yes` / `no` |
| `spending.dailyLimit` | Daily cap |
| `spending.dailyRemaining` | Headroom left |
| `spending.dailySpent` | Spent today |
| `cards.count` | Enrolled cards |
| `cards.default` | Default card mask |
| `biometric.required` | Touch ID policy |
| `biometric.keyRegistered` | Attestation state |

---

### `cards` — payment cards

```bash
visa-cli cards list
visa-cli cards add
visa-cli cards remove <card-id> [-y]
visa-cli cards default <card-id>
```

| Command | Suitability | Notes |
|---------|-------------|-------|
| `list` | ⚠️ TUI | No `--json` flag |
| `add` | ❌ | Interactive card entry |
| `remove` | ⚠️ Admin | `-y` skips confirm; still sensitive |
| `default` | ⚠️ Admin | Changes default payment card |

For a settings UI, run `cards list` manually or wait for JSON support. Do not expose `add` via public API.

---

### `tokens` — API tokens for agents

```bash
visa-cli tokens list [--json]
visa-cli tokens create [label] [--tools ids] [--daily-cap usd] [--json]
visa-cli tokens revoke <id>
```

| Command | Suitability | Route |
|---------|-------------|-------|
| `list --json` | ✅ | `GET /api/visa/tokens` |
| `create --json` | ⚠️ Admin | `POST /api/visa/tokens` |
| `revoke` | ⚠️ Admin | `DELETE /api/visa/tokens/[id]` |

**Note:** token management may be restricted to certain account types.

Request body for create:

```json
{
  "label": "my-nextjs-app",
  "tools": ["fal-flux-pro", "or-claude-haiku"],
  "dailyCapUsd": 10
}
```

---

### `balance` — prepaid wallet

```bash
visa-cli balance show
visa-cli balance topup [-a usd]
visa-cli balance auto-topup show|disable
```

| Command | Suitability | Notes |
|---------|-------------|-------|
| `show` | ⚠️ TUI | Use `config get spending.dailyRemaining --raw` for headroom |
| `topup` | ❌ | Requires Touch ID |
| `auto-topup` | ⚠️ Admin | Read/disable only |

---

### `merchants` — tool catalog & generic runner

```bash
visa-cli merchants list [--json]
visa-cli merchants tools [--category] [--query] [--json] [--limit] [--offset]
visa-cli merchants describe <tool>
visa-cli merchants run <tool> [--json '{…}'] [--prompt "…"]
visa-cli merchants refresh
```

| Command | Suitability | Route |
|---------|-------------|-------|
| `list --json` | ✅ 📋 | `GET /api/visa/catalog/merchants` |
| `tools --json` | ✅ 📋 | `GET /api/visa/catalog/tools?category=llm` |
| `describe` | ⚠️ TUI | Cache tool metadata from `tools --json` instead |
| `run` | ⚠️ | Prefer `generate *` shortcuts; `run` uses TUI output for results |
| `refresh` | ❌ | MCP in-process hint — not applicable to Next.js |

**Tool categories:** `image`, `video`, `audio`, `3d`, `llm`

Example — model picker data:

```bash
visa-cli merchants tools --category llm --json
```

```json
{
  "tools": [
    { "id": "or-claude-haiku", "name": "Claude 3.5 Haiku", "price_cents": 0.005, "category": "llm" }
  ]
}
```

---

### `generate` — media shortcuts (preferred for API)

All accept stdin via `-` or `--stdin`. All support `--json --yes`.

#### `generate image`

```bash
visa-cli generate image [prompt] \
  [--fast] [--quality standard|high] [--tool <id>] [--image-ref <url>] \
  [--json] [--yes]
```

| Tool id | Price | Use |
|---------|-------|-----|
| `fal-flux-schnell` | $0.01 | drafts (`--fast`) |
| `fal-flux-pro` | $0.04 | default balanced |
| `fal-flux-pro-ultra` | $0.06 | hero / 2K |
| `fal-ideogram-v2` | $0.08 | text / logos |
| `fal-recraft-v3` | $0.05 | vector / flat |

POST body:

```json
{ "prompt": "a lobster on marble", "fast": true, "persist": true }
```

#### `generate video`

```bash
visa-cli generate video [prompt] \
  [--tool <id>] [--aspect-ratio 16:9] [--duration 5] \
  [--json] [--yes]
```

Use `maxDuration = 300` (5 min) on the route — video can take minutes.

#### `generate music`

```bash
visa-cli generate music [prompt] \
  [--tool <id>] [--instrumental] [--duration 30] \
  [--json] [--yes]
```

#### `generate speech`

```bash
visa-cli generate speech [text] \
  [--tool <id>] [--audio-url <voice-sample-url>] \
  [--json] [--yes]
```

#### `generate 3d`

```bash
visa-cli generate 3d [image-url] [--tool <id>] [--json] [--yes]
```

POST body:

```json
{ "imageUrl": "https://your-cdn.com/source.jpg", "persist": true }
```

---

### `run-llm` — chat completions

```bash
visa-cli run-llm [prompt] \
  [--tier fast|reasoning|deep_reasoning|search|open_source|coding] \
  [--model or-claude-haiku] \
  [--system "…" | @./path/to/file] \
  [--max-tokens n] [--temperature n] [--image-url url] \
  [--json] [--yes]
```

POST body:

```json
{
  "prompt": "Explain quantum tunneling in two sentences",
  "model": "or-claude-haiku",
  "system": "You are a concise physics tutor.",
  "maxTokens": 500,
  "temperature": 0.7
}
```

Response:

```json
{
  "success": true,
  "command": "run-llm",
  "amount": 0.000054,
  "merchantName": "Claude 3.5 Haiku",
  "text": "…"
}
```

Multi-turn chat (until native messages API lands): prepend prior turns into `--system` or the prompt block (see Brick's `chat.rs` pattern).

Vision input:

```json
{
  "prompt": "What's in this image?",
  "model": "or-gemini-nano-banana-pro",
  "imageUrl": "https://…"
}
```

Pipe long prompts on stdin in the lib — never interpolate into shell strings.

---

### `config` — settings

```bash
visa-cli config list [--json] [--dev] [--verbose]
visa-cli config get <key> [--raw] [--dev]
visa-cli config set <key> <value>
visa-cli config unset <key>
visa-cli config reset
visa-cli config biometric status|on|off
visa-cli config hud enable|disable|doctor [claude|shell|all]
visa-cli config shell-hud install|uninstall|…
visa-cli config statusline
```

| Command | Suitability | Route |
|---------|-------------|-------|
| `list --json` | ✅ 📋 | `GET /api/visa/config` |
| `get --raw` | ✅ 📋 | `GET /api/visa/config/[key]` |
| `set` | ⚠️ Admin | `POST /api/visa/config` |
| `unset` | ⚠️ Admin | `DELETE /api/visa/config/[key]` |
| `reset` | ❌ | Logs out — manual only |
| `biometric on/off` | ❌ / ⚠️ | Touch ID for `off` |
| `hud *`, `shell-hud *` | ❌ | Local shell integration — not for web API |

**Settable keys** (from `visa-cli config set --help`):

| Key | Type | Description |
|-----|------|-------------|
| `auth.serverUrl` | string | Auth server override (staging) |
| `ui.suppressBrowser` | boolean | Don't auto-open result URLs |
| `ui.suppressFeed` | boolean | Don't submit to public feed |
| `tools.meta` | boolean | Show meta-tools (restart required) |
| `tools.discover` | boolean | Show dynamic catalog tools |
| `merchants.discover` | string | `"all"`, `"off"`, or comma slugs |
| `credit.sessionCapCents` | number | Session cap $0.10–$100 |

---

### `feedback`

```bash
visa-cli feedback [message]
```

| | |
|---|---|
| Suitability | ✅ |
| Route | `POST /api/visa/feedback` `{ "message": "…" }` |

---

### `update` / `uninstall`

```bash
visa-cli update
visa-cli uninstall [client] [--all] [--scope global|project]
```

| | |
|---|---|
| Suitability | ❌ Not for API — system maintenance, run in terminal |

---

## 8. Media persistence

Provider URLs in envelopes are **transient**. Always re-host before returning to the client.

```typescript
// lib/persist-media.ts
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import type { VisaEnvelope } from "./visa-cli";

export async function persistFromEnvelope(
  envelope: VisaEnvelope,
  meta: { kind: string; prompt?: string; tool?: string },
) {
  const sourceUrl = envelope.urls?.[0] ?? envelope.filePath;
  if (!sourceUrl) {
    throw new Error("nothing to persist — no urls or filePath");
  }

  const res = await fetch(sourceUrl.startsWith("http") ? sourceUrl : `file://${sourceUrl}`);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);

  const bytes = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") ?? guessMime(meta.kind);
  const ext = extFromMime(mime);
  const id = randomUUID();

  const blob = await put(`${meta.kind}/${id}.${ext}`, bytes, {
    access: "public",
    contentType: mime,
  });

  // TODO: INSERT INTO visa_generations (id, kind, prompt, tool, storage_url, amount, …)

  return { id, url: blob.url, mime, bytes: bytes.length, sourceUrl };
}

function guessMime(kind: string) {
  if (kind === "music" || kind === "speech") return "audio/mpeg";
  if (kind === "video") return "video/mp4";
  if (kind === "3d") return "model/gltf-binary";
  return "image/jpeg";
}

function extFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("gltf")) return "glb";
  return "jpg";
}
```

**Local dev fallback:** write to `public/generated/` (gitignore it).

**Storage options:** Vercel Blob, Supabase Storage, S3/R2, Fly Volume.

---

## 9. Database schema

Track generations for gallery, billing audit, and dedup.

```sql
create table visa_generations (
  id              uuid primary key default gen_random_uuid(),
  command         text not null,           -- generate.image, run-llm, …
  kind            text,                    -- image, video, music, speech, 3d, llm
  prompt          text,
  tool_id         text,
  model           text,
  storage_url     text,
  storage_key     text,
  mime            text,
  bytes           integer,
  amount_usd      numeric(12, 8),
  transaction_id  text,
  source_urls     jsonb,
  response_text   text,                    -- run-llm text field
  success         boolean not null default true,
  error           text,
  user_id         text,                    -- your app's user
  created_at      timestamptz not null default now()
);

create index visa_generations_user_created_idx
  on visa_generations (user_id, created_at desc);

create index visa_generations_command_idx
  on visa_generations (command);
```

---

## 10. Security

### Required

- **Authenticate** every route that can spend money (`run-llm`, `generate *`, `merchants run`).
- **Rate limit** per user/IP — respect `spending.dailyRemaining`.
- **Validate input** server-side (prompt length, allowed tool ids from catalog).
- **`execFile` only** — never `` exec(`visa-cli … ${prompt}`) ``.
- **Admin gate** config mutations, token create/revoke, card changes.
- **Never expose** `~/.visa-mcp/` paths or raw stderr to clients.

### Tool allowlisting

Fetch catalog once, cache 5–15 min, reject unknown `tool`/`model` ids:

```typescript
const ALLOWED = new Set((await listTools()).tools.map((t) => t.id));
if (body.tool && !ALLOWED.has(body.tool)) {
  return NextResponse.json({ error: "unknown tool" }, { status: 400 });
}
```

### Cost logging

Log on every paid response:

```typescript
console.info("[visa-cli]", {
  command: envelope.command,
  amount: envelope.amount,
  transactionId: envelope.transactionId,
  userId: session.userId,
});
```

---

## 11. Deployment

| Host | Direct spawn in API route? | Notes |
|------|---------------------------|-------|
| **Local dev** | ✅ | `visa-cli` on PATH; set `VISA_CLI_PATH` if nvm PATH differs |
| **Fly.io / Docker / VPS** | ✅ | Install CLI in image; mount secrets for `~/.visa-mcp` |
| **Vercel serverless** | ❌ | No stable PATH, no keychain, cold starts |

### Vercel → Fly sidecar pattern

```
Next.js (Vercel)  ──HTTPS + API key──►  visa-api (Fly)
                                         spawn visa-cli locally
                                         return JSON
```

The Vercel route becomes a thin proxy:

```typescript
const res = await fetch(`${process.env.VISA_API_URL}/v1/generate/image`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.VISA_API_KEY}`,
  },
  body: JSON.stringify(body),
});
return NextResponse.json(await res.json(), { status: res.status });
```

### Docker (Fly) sketch

```dockerfile
FROM node:22-bookworm
RUN npm install -g visa-cli
# Copy pre-enrolled ~/.visa-mcp from secrets at runtime
WORKDIR /app
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

Run `visa-cli setup --yes` once in a secure bootstrap step with injected credentials.

---

## 12. Environment variables

```bash
# CLI binary (when PATH differs between shell and Next.js process)
VISA_CLI_PATH=/usr/local/bin/visa-cli

# Sidecar proxy (Vercel production)
VISA_API_URL=https://visa-api.internal.fly.dev
VISA_API_KEY=…

# Storage (pick one)
BLOB_READ_WRITE_TOKEN=…
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
S3_BUCKET=…
SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…

# Optional staging auth server
# Set via visa-cli config set auth.serverUrl https://staging.auth.visacli.sh
```

Credentials live at:

```
~/.visa-mcp/settings.json
~/.visa-mcp/          # attestation keys (platform-specific)
```

Never commit these. Mount as Fly secrets or Docker volume.

---

## 13. Error handling

| Condition | HTTP | Client message |
|-----------|------|----------------|
| `VisaCliError NOT_FOUND` | 503 | "visa-cli unavailable" |
| `VisaCliError TIMEOUT` | 504 | "request timed out" |
| `VisaCliError ENVELOPE` | 502 | `envelope.error` |
| `VisaCliError PARSE` | 502 | "unexpected cli output" |
| Missing auth | 401 | "unauthorized" |
| Bad input | 400 | validation message |
| Unknown tool | 400 | "unknown tool" |
| Daily cap exceeded | 402 or 429 | "daily spend limit reached" |

Check headroom before batch jobs:

```typescript
const remaining = await getConfig("spending.dailyRemaining");
if (Number(remaining) <= 0) {
  return NextResponse.json({ error: "daily limit reached" }, { status: 429 });
}
```

---

## 14. Testing

### Unit tests (no CLI spawn)

```typescript
import { parseEnvelopeLine } from "@/lib/visa-cli";

test("parses envelope", () => {
  const line = '{"success":true,"command":"run-llm","text":"hi"}';
  expect(parseEnvelopeLine(line).text).toBe("hi");
});
```

### Integration tests (spawns real CLI — costs money)

```typescript
// tests/visa-cli.integration.test.ts — run manually or in CI with secrets
import { generateImage } from "@/lib/visa-cli";

test("generate image", async () => {
  const env = await generateImage({ prompt: "red dot", fast: true });
  expect(env.success).toBe(true);
  expect(env.urls?.[0]).toMatch(/^https:/);
}, 120_000);
```

### Route tests (mock lib)

```typescript
vi.mock("@/lib/visa-cli", () => ({
  generateImage: vi.fn().mockResolvedValue({
    success: true,
    command: "generate.image",
    urls: ["https://example.com/x.jpg"],
    amount: 0.01,
  }),
}));
```

---

## 15. Quick-start checklist

```
Setup
- [ ] npm install -g visa-cli && visa-cli setup
- [ ] visa-cli status — enrolled, cards, spend headroom
- [ ] visa-cli generate image "test" --fast --json --yes — envelope works

Next.js
- [ ] Copy lib/visa-cli.ts from §3
- [ ] Copy lib/persist-media.ts from §8
- [ ] Add app/api/visa/generate/image/route.ts from §6
- [ ] Add app/api/visa/catalog/tools/route.ts from §6
- [ ] Add app/api/visa/llm/route.ts (same pattern as image, call runLlm)
- [ ] export const runtime = "nodejs" on every route
- [ ] export const maxDuration = 120 (300 for video/3d)
- [ ] Auth middleware on all paid routes
- [ ] VISA_CLI_PATH in .env.local if which visa-cli fails from dev server

Storage
- [ ] Wire persistFromEnvelope to Blob/S3/Supabase
- [ ] Create visa_generations table (§9)
- [ ] gitignore public/generated/ if using local fallback

Production
- [ ] Fly sidecar if deploying frontend to Vercel
- [ ] Mount ~/.visa-mcp secrets in container
- [ ] Rate limits + cost logging
```

---

## Appendix: client fetch examples

```typescript
// Generate image
const res = await fetch("/api/visa/generate/image", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "sunset over mountains", fast: true }),
});
const { url, amount } = await res.json();

// Chat
const res = await fetch("/api/visa/llm", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Explain recursion simply",
    model: "or-claude-haiku",
  }),
});
const { text, amount } = await res.json();

// Model picker
const res = await fetch("/api/visa/catalog/tools?category=llm");
const { tools } = await res.json();

// Account dashboard
const res = await fetch("/api/visa/config");
const { config } = await res.json();
```

---

## Related

- Brick subprocess reference: `src-tauri/src/cli.rs`
- Cursor skill (shorter): `~/.agents/skills/visa-cli-nextjs-images/`
- Product spec (full UI mapping): `PRD.md`
