/** @purpose Spawn visa-cli server-side and parse paid-command JSON envelopes. */
import { spawn } from 'node:child_process';

const CLI = process.env.VISA_CLI_PATH ?? 'visa-cli';

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
    public readonly code: 'NOT_FOUND' | 'TIMEOUT' | 'PARSE' | 'ENVELOPE' | 'IO',
    public readonly stderr?: string,
  ) {
    super(message);
  }
}

type RunOpts = {
  stdin?: string;
  timeoutMs?: number;
  envelope?: boolean;
  maxBuffer?: number;
};

export async function runVisaCli(
  args: string[],
  opts: RunOpts = {},
): Promise<VisaEnvelope | string> {
  const envelope = opts.envelope ?? true;
  const fullArgs = [...args];

  if (envelope) {
    if (!fullArgs.includes('--json')) fullArgs.push('--json');
    if (!fullArgs.includes('--yes')) fullArgs.push('--yes');
  }

  let stdout: string;
  let stderr: string;

  try {
    ({ stdout, stderr } = await spawnVisaCli(fullArgs, opts.stdin, opts.timeoutMs ?? 120_000, opts.maxBuffer ?? 10 * 1024 * 1024));
  } catch (err: unknown) {
    if (err instanceof VisaCliError) throw err;
    throw new VisaCliError((err as Error).message ?? 'visa-cli io error', 'IO');
  }

  if (stderr.trim()) {
    console.debug('[visa-cli stderr]', stderr.trim());
  }

  if (!envelope) {
    return stdout;
  }

  const line = stdout
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('{'));

  if (!line) {
    throw new VisaCliError(`no envelope in stdout (${stdout.length} bytes)`, 'PARSE', stderr);
  }

  const parsed = JSON.parse(line) as VisaEnvelope;
  if (!parsed.success) {
    throw new VisaCliError(parsed.error ?? 'visa-cli command failed', 'ENVELOPE', stderr);
  }

  return parsed;
}

export async function generateImage(opts: {
  prompt: string;
  tool?: string;
  fast?: boolean;
  quality?: 'standard' | 'high';
  imageRef?: string;
}) {
  const args = ['generate', 'image', '-'];
  if (opts.fast) args.push('--fast');
  if (opts.tool) args.push('--tool', opts.tool);
  if (opts.quality) args.push('--quality', opts.quality);
  if (opts.imageRef) args.push('--image-ref', opts.imageRef);
  return runVisaCli(args, { stdin: opts.prompt }) as Promise<VisaEnvelope>;
}

export type ConfigEntry = {
  key: string;
  value: unknown;
  source?: { kind: string };
  hint?: string;
};

export type ConfigListResponse = {
  config: ConfigEntry[];
  statusError?: string | null;
};

export async function listConfig(): Promise<ConfigListResponse> {
  const stdout = (await runVisaCli(['config', 'list', '--json'], { envelope: false })) as string;
  return JSON.parse(stdout) as ConfigListResponse;
}

/** Strip ANSI escapes from CLI output so we can regex over text reliably. */
function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\u001b\[[0-9;]*m/g, '');
}

export type BalanceSummary = {
  balance: number | null;
  currency: string;
  recent: Array<{ ts: string; delta: number; balance: number; reason: string }>;
};

export async function getBalance(): Promise<BalanceSummary> {
  const stdout = stripAnsi(
    (await runVisaCli(['balance', 'show'], { envelope: false, timeoutMs: 30_000 })) as string,
  );
  const balanceMatch = stdout.match(/Balance:\s*\$([0-9]+\.?[0-9]*)/i);
  const balance = balanceMatch ? parseFloat(balanceMatch[1]) : null;

  const recent: BalanceSummary['recent'] = [];
  const rowRe =
    /^\s*(20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+(-?\$[0-9]+\.?[0-9]*)\s+\$([0-9]+\.?[0-9]*)\s+(\S.*?)\s{2,}(\S.*)$/gm;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(stdout)) !== null) {
    const delta = parseFloat(match[2].replace('$', ''));
    const bal = parseFloat(match[3]);
    if (Number.isFinite(delta) && Number.isFinite(bal)) {
      recent.push({ ts: match[1], delta, balance: bal, reason: match[4].trim() });
      if (recent.length >= 8) break;
    }
  }

  return { balance, currency: 'USD', recent };
}

export type AccountStatus = {
  enrolled: boolean;
  email: string | null;
  balance: number | null;
  currency: string;
  spending: {
    dailyLimit: number | null;
    dailySpent: number | null;
    dailyRemaining: number | null;
    maxPerTxn: number | null;
  };
  cards: {
    count: number;
    default: { brand: string; last4: string } | null;
  };
  biometric: {
    required: boolean;
    keyRegistered: boolean;
    deviceAvailable: boolean;
  };
  cliVersion: string | null;
  recent: BalanceSummary['recent'];
};

function findKey(entries: ConfigEntry[], key: string): unknown {
  return entries.find((e) => e.key === key)?.value;
}

export async function getAccountStatus(): Promise<AccountStatus> {
  const [{ config }, balance] = await Promise.all([listConfig(), getBalance().catch(() => null)]);

  const cardsDefault = findKey(config, 'cards.default') as
    | { brand: string; last4: string }
    | undefined;

  // Email is not exposed by visa-cli config today; surface from env if available.
  const email =
    (findKey(config, 'account.email') as string | undefined) ?? process.env.VISA_USER_EMAIL ?? null;

  return {
    enrolled: Boolean(findKey(config, 'account.enrolled')),
    email,
    balance: balance?.balance ?? null,
    currency: balance?.currency ?? 'USD',
    spending: {
      dailyLimit: (findKey(config, 'spending.dailyLimit') as number | undefined) ?? null,
      dailySpent: (findKey(config, 'spending.dailySpent') as number | undefined) ?? null,
      dailyRemaining: (findKey(config, 'spending.dailyRemaining') as number | undefined) ?? null,
      maxPerTxn: (findKey(config, 'spending.maxPerTxn') as number | undefined) ?? null,
    },
    cards: {
      count: (findKey(config, 'cards.count') as number | undefined) ?? 0,
      default: cardsDefault ?? null,
    },
    biometric: {
      required: Boolean(findKey(config, 'biometric.required')),
      keyRegistered: Boolean(findKey(config, 'biometric.keyRegistered')),
      deviceAvailable: Boolean(findKey(config, 'biometric.deviceAvailable')),
    },
    cliVersion: (findKey(config, 'client.version') as string | undefined) ?? null,
    recent: balance?.recent ?? [],
  };
}

function spawnVisaCli(
  args: string[],
  stdin: string | undefined,
  timeoutMs: number,
  maxBuffer: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(CLI, args, { env: process.env });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (err?: VisaCliError, result?: { stdout: string; stderr: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(result!);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(new VisaCliError('visa-cli timed out', 'TIMEOUT', stderr));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
      if (stdout.length > maxBuffer) {
        child.kill('SIGTERM');
        finish(new VisaCliError('visa-cli stdout exceeded maxBuffer', 'IO', stderr));
      }
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        finish(new VisaCliError('visa-cli not found (set VISA_CLI_PATH)', 'NOT_FOUND'));
      } else {
        finish(new VisaCliError(err.message ?? 'visa-cli io error', 'IO', stderr));
      }
    });

    child.on('close', (code) => {
      if (code !== 0 && !stdout.includes('{')) {
        finish(new VisaCliError(`visa-cli exited with code ${code}`, 'IO', stderr));
        return;
      }
      finish(undefined, { stdout, stderr });
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}
