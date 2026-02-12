/**
 * @file Main wizard page — the heart of the OpenClaw Setup Wizard.
 *
 * This is a single-page, multi-step wizard implemented as a client component.
 * It guides users through:
 *   1. Intro — explains what they'll get and what they need
 *   2. Hetzner Account — links to Hetzner registration
 *   3. API Token — collects and validates a Hetzner API token
 *   4. SSH Key — collects SSH public key and server preferences
 *   5. Provisioning — streams real-time progress from /api/provision
 *   6. Done — shows connection details and next steps
 *
 * The wizard can also detect an existing server (by name) and skip straight
 * to the "Done" step, making it safe to reload or re-run.
 *
 * @module page
 */
'use client';

import { useState } from 'react';

/**
 * All possible wizard steps, in order.
 * The step determines which UI panel is rendered.
 */
type Step = 'intro' | 'hetzner-account' | 'api-token' | 'ssh-key' | 'provisioning' | 'done';

/** Ordered array of steps — used for the progress indicator. */
const STEPS: Step[] = ['intro', 'hetzner-account', 'api-token', 'ssh-key', 'provisioning', 'done'];

/**
 * GitHub repository URL — used for the "star" CTA and support links.
 */
const GITHUB_REPO = 'https://github.com/telegraphic-dev/openclaw-wizard';
const GITHUB_ISSUES = `${GITHUB_REPO}/issues`;

// ─── Reusable Components ────────────────────────────────────────────────────

/**
 * An expandable/collapsible details panel.
 * Used throughout the wizard to provide optional context (e.g. "Why Hetzner?")
 * without cluttering the main flow.
 *
 * @param props.title - The always-visible header text.
 * @param props.children - Content revealed when expanded.
 */
function Details({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-slate-400 hover:text-slate-300"
      >
        <span className="text-sm">{title}</span>
        <span className="text-lg">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-slate-400 text-sm space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Server details returned after provisioning or detection.
 *
 * @property ip - Public IPv4 address of the server.
 * @property name - Hetzner server name (e.g. "my-openclaw").
 * @property token - Gateway token (or placeholder if existing server).
 * @property rootPassword - Root password (only for new servers without SSH key).
 * @property isExisting - True if the server was found already running.
 * @property serverId - Hetzner server ID (for console-url API).
 */
interface ServerDetails {
  ip: string;
  name: string;
  token: string;
  rootPassword?: string | null;
  isExisting?: boolean;
  serverId?: number;
}

// ─── Main Wizard Component ──────────────────────────────────────────────────

/**
 * Wizard — the main exported component rendered at `/`.
 *
 * State management is simple useState hooks (no external state library needed
 * for a linear wizard flow). Each step renders conditionally based on `step`.
 */
export default function Wizard() {
  // ── Wizard state ──────────────────────────────────────────────────────────

  /** Current wizard step. Controls which panel is visible. */
  const [step, setStep] = useState<Step>('intro');

  /** Hetzner API token entered by the user. Never persisted to disk/server. */
  const [apiToken, setApiToken] = useState('');

  /** User's SSH public key (e.g. ssh-ed25519 AAAA...). */
  const [sshKey, setSshKey] = useState('');

  /** Desired server hostname in Hetzner. Used to detect existing servers. */
  const [serverName, setServerName] = useState('my-openclaw');

  /** Preferred datacenter location code (e.g. fsn1, hel1, ash). */
  const [location, setLocation] = useState('fsn1');

  /** Hetzner server type (e.g. cax11 for ARM, cx22 for x86). */
  const [serverType, setServerType] = useState('cax11');

  /** Array of progress messages shown during provisioning (streamed from API). */
  const [progress, setProgress] = useState<string[]>([]);

  /** Error message to display, or empty string if no error. */
  const [error, setError] = useState('');

  /** Server connection details, populated after provisioning or detection. */
  const [serverDetails, setServerDetails] = useState<ServerDetails | null>(null);

  /** True while the API token is being validated against Hetzner. */
  const [checking, setChecking] = useState(false);

  // ── API Interactions ──────────────────────────────────────────────────────

  /**
   * Validates the API token and checks if a server with `serverName` already exists.
   *
   * Flow:
   * 1. POST to /api/check-server with the token and server name
   * 2. If a running server is found → jump straight to "done" step
   * 3. If token is valid but no server → advance to "ssh-key" step
   * 4. If token is invalid → show error
   *
   * @param token - The Hetzner API token to validate.
   */
  const checkExistingServer = async (token: string) => {
    setChecking(true);
    setError('');

    try {
      const res = await fetch('/api/check-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken: token, serverName }),
      });

      const data = await res.json();

      if (data.exists && data.server) {
        // Server already exists — skip provisioning entirely
        setServerDetails(data.server);
        setStep('done');
      } else if (data.valid) {
        // Token works, no existing server — proceed to SSH key step
        setStep('ssh-key');
      } else {
        setError(data.error || 'Invalid API token');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check server');
    }

    setChecking(false);
  };

  /**
   * Starts the server provisioning process by calling /api/provision.
   *
   * The API returns an NDJSON stream (one JSON object per line). Each object
   * can contain:
   * - `{ progress: "message" }` — a status update to append to the log
   * - `{ error: "message" }` — an error that halts provisioning
   * - `{ done: true, server: {...} }` — provisioning complete
   *
   * The stream is consumed using a ReadableStream reader, which lets us
   * show real-time progress without WebSockets or polling.
   */
  const startProvisioning = async () => {
    setStep('provisioning');
    setProgress(['Starting provisioning...']);
    setError('');

    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken, sshKey, serverName, location, serverType }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream');

      // Read the NDJSON stream chunk by chunk
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Each chunk may contain multiple newline-delimited JSON objects
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.progress) {
              setProgress(prev => [...prev, data.progress]);
            }
            if (data.error) {
              setError(data.error);
              return;
            }
            if (data.done) {
              setServerDetails(data.server);
              setStep('done');
            }
          } catch {
            // Ignore malformed JSON lines (e.g. partial chunks)
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Page header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">🦞 OpenClaw Setup Wizard</h1>
          <p className="text-slate-400">Get your AI agent running in 5 minutes</p>
        </div>

        {/* ── Step progress indicator ────────────────────────────────────── */}
        <div className="flex justify-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step === s ? 'bg-orange-500' :
                  STEPS.indexOf(step) > i
                    ? 'bg-green-500' : 'bg-slate-700'}`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-1 bg-slate-700" />}
            </div>
          ))}
        </div>

        {/* ── Wizard panels ─────────────────────────────────────────────── */}
        <div className="bg-slate-800 rounded-xl p-8 shadow-xl">

          {/* ─── Step: Intro ─────────────────────────────────────────────── */}
          {step === 'intro' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Welcome!</h2>
              <p className="text-slate-300">
                This wizard will help you set up your own OpenClaw AI agent on a Hetzner cloud server.
              </p>
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="font-bold mb-2">What you&apos;ll get:</h3>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Your own private AI agent server</li>
                  <li>Secure connection via SSH</li>
                  <li>Connect to Telegram, WhatsApp, etc.</li>
                  <li>Costs ~€4/month</li>
                </ul>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="font-bold mb-2">What you&apos;ll need:</h3>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>A Hetzner account (we&apos;ll help you create one)</li>
                  <li>A credit card for Hetzner billing</li>
                  <li>About 10 minutes</li>
                </ul>
              </div>

              <Details title="ℹ️ Why Hetzner? Is it safe?">
                <p>
                  <strong>Hetzner</strong> is a German cloud provider founded in 1997. They&apos;re one of Europe&apos;s
                  largest hosting companies with data centers in Germany, Finland, and the USA.
                </p>
                <p>
                  ✓ GDPR compliant & ISO 27001 certified<br/>
                  ✓ Used by 100,000+ customers worldwide<br/>
                  ✓ Transparent pricing, no hidden fees<br/>
                  ✓ Data stays in your chosen region
                </p>
                <p>
                  Your server is <strong>yours</strong> — we just help you set it up. You have full root access
                  and can delete it anytime from the Hetzner Console.
                </p>
              </Details>

              <button
                onClick={() => setStep('hetzner-account')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition"
              >
                Let&apos;s Start →
              </button>
            </div>
          )}

          {/* ─── Step: Hetzner Account ───────────────────────────────────── */}
          {step === 'hetzner-account' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Step 1: Create Hetzner Account</h2>
              <p className="text-slate-300">
                Hetzner is a reliable European cloud provider with great prices.
              </p>
              <div className="bg-slate-700 rounded-lg p-4">
                <ol className="list-decimal list-inside text-slate-300 space-y-3">
                  <li>Click the button below to open Hetzner</li>
                  <li>Click &quot;Register&quot; to create an account</li>
                  <li>Verify your email</li>
                  <li>Add a payment method</li>
                  <li>Come back here when done</li>
                </ol>
              </div>
              <a
                href="https://console.hetzner.cloud/projects"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-center transition"
              >
                Open Hetzner Console ↗
              </a>

              <Details title="ℹ️ What happens when I create an account?">
                <p>
                  You&apos;ll create an account on <strong>hetzner.cloud</strong> (Hetzner&apos;s cloud platform).
                  This is separate from this wizard — Hetzner is the company that will host your server.
                </p>
                <p>
                  You&apos;ll need to verify your identity with a credit card or PayPal. Hetzner may
                  put a small temporary hold (~€1) to verify the payment method.
                </p>
                <p>
                  <strong>Billing:</strong> You only pay for what you use. The CAX11 server costs
                  ~€3.85/month. You can delete it anytime and billing stops immediately.
                </p>
              </Details>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('intro')}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('api-token')}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  I have an account →
                </button>
              </div>
            </div>
          )}

          {/* ─── Step: API Token ──────────────────────────────────────────── */}
          {step === 'api-token' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Step 2: Create API Token</h2>
              <p className="text-slate-300">
                We need an API token to create your server automatically.
              </p>
              <div className="bg-slate-700 rounded-lg p-4">
                <ol className="list-decimal list-inside text-slate-300 space-y-3">
                  <li>In Hetzner Console, select your project (or create one)</li>
                  <li>Go to <strong>Security</strong> in the left menu</li>
                  <li>Click <strong>API Tokens</strong> tab</li>
                  <li>Click <strong>Generate API Token</strong></li>
                  <li>Give it a name like &quot;OpenClaw&quot;</li>
                  <li>Select <strong>Read & Write</strong> permissions</li>
                  <li>Copy the token and paste it below</li>
                </ol>
              </div>
              <div className="bg-amber-900/50 border border-amber-500 rounded-lg p-4">
                <p className="text-amber-200 text-sm">
                  🔒 Your token is only used to create the server and is never stored.
                </p>
              </div>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste your API token here"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500"
              />
              <Details title="ℹ️ What is an API token?">
                <p>
                  An API token is like a password that allows this wizard to create a server on your behalf.
                  It&apos;s scoped to your Hetzner project and can only manage resources within that project.
                </p>
                <p>
                  <strong>Security note:</strong> This token is only sent directly to Hetzner&apos;s API.
                  We never store it on our servers. After setup, you should delete the token from
                  Hetzner Console for security.
                </p>
                <p>
                  The token needs &quot;Read &amp; Write&quot; permission so we can create the server
                  and upload your SSH key.
                </p>
              </Details>

              {error && (
                <div className="bg-red-900/50 border border-red-500 rounded-lg p-3">
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}
              <div className="flex gap-4">
                <button
                  onClick={() => setStep('hetzner-account')}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => checkExistingServer(apiToken)}
                  disabled={!apiToken || checking}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  {checking ? 'Checking...' : 'Next →'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step: SSH Key & Server Config ───────────────────────────── */}
          {step === 'ssh-key' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Step 3: SSH Key</h2>
              <p className="text-slate-300">
                Your SSH key is required to securely connect to your server.
              </p>
              <div className="bg-slate-700 rounded-lg p-4">
                <p className="text-slate-300 mb-3">On your computer, open Terminal and run:</p>
                <code className="block bg-slate-900 p-3 rounded text-green-400 text-sm">
                  cat ~/.ssh/id_ed25519.pub
                </code>
                <p className="text-slate-400 text-sm mt-2">
                  If you don&apos;t have one, run: <code className="text-green-400">ssh-keygen -t ed25519</code>
                </p>
              </div>
              <input
                type="text"
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                placeholder="ssh-ed25519 AAAA... (paste your public key)"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 font-mono text-sm"
              />

              {/* Server configuration options */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Server Name</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="my-openclaw"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Location</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white"
                  >
                    <option value="fsn1">🇩🇪 Falkenstein</option>
                    <option value="nbg1">🇩🇪 Nuremberg</option>
                    <option value="hel1">🇫🇮 Helsinki</option>
                    <option value="ash">🇺🇸 Ashburn</option>
                    <option value="hil">🇺🇸 Hillsboro</option>
                    <option value="sin">🇸🇬 Singapore</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Server Size</label>
                <select
                  value={serverType}
                  onChange={(e) => setServerType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white"
                >
                  <optgroup label="ARM (Ampere) — Best value">
                    <option value="cax11">CAX11 — 2 vCPU, 4 GB RAM, 40 GB — €3.85/mo ⭐</option>
                    <option value="cax21">CAX21 — 4 vCPU, 8 GB RAM, 80 GB — €7.25/mo</option>
                    <option value="cax31">CAX31 — 8 vCPU, 16 GB RAM, 160 GB — €14.25/mo</option>
                    <option value="cax41">CAX41 — 16 vCPU, 32 GB RAM, 320 GB — €28.45/mo</option>
                  </optgroup>
                  <optgroup label="x86 (Intel/AMD) — Shared">
                    <option value="cx22">CX22 — 2 vCPU, 4 GB RAM, 40 GB — €4.35/mo</option>
                    <option value="cx32">CX32 — 4 vCPU, 8 GB RAM, 80 GB — €8.15/mo</option>
                    <option value="cx42">CX42 — 8 vCPU, 16 GB RAM, 160 GB — €16.15/mo</option>
                    <option value="cx52">CX52 — 16 vCPU, 32 GB RAM, 320 GB — €32.15/mo</option>
                  </optgroup>
                  <optgroup label="x86 (AMD) — Dedicated">
                    <option value="ccx13">CCX13 — 2 vCPU, 8 GB RAM, 80 GB — €12.99/mo</option>
                    <option value="ccx23">CCX23 — 4 vCPU, 16 GB RAM, 160 GB — €25.99/mo</option>
                    <option value="ccx33">CCX33 — 8 vCPU, 32 GB RAM, 240 GB — €51.99/mo</option>
                  </optgroup>
                </select>
                <p className="text-slate-500 text-xs mt-1">CAX11 is recommended for most users</p>
              </div>

              <Details title="ℹ️ What happens when I click Create Server?">
                <p>We&apos;ll use your API token to:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Upload your SSH key (if provided) to Hetzner</li>
                  <li>Create a new server with Ubuntu 24.04</li>
                  <li>Run a bootstrap script that installs OpenClaw</li>
                  <li>Create an &apos;openclaw&apos; user for you to log in with</li>
                </ol>
                <p>
                  The whole process takes about 2-3 minutes. Your server will be ready to use
                  as soon as it&apos;s done.
                </p>
                <p>
                  <strong>Location:</strong> Choose a location close to you for lower latency.
                  European locations (Falkenstein, Nuremberg) are often cheapest.
                </p>
              </Details>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('api-token')}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  onClick={startProvisioning}
                  disabled={!apiToken || !sshKey}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  🚀 Create Server
                </button>
              </div>
            </div>
          )}

          {/* ─── Step: Provisioning (streaming progress) ─────────────────── */}
          {step === 'provisioning' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Creating Your Server...</h2>
              <p className="text-slate-300">
                This usually takes 2-3 minutes. Please don&apos;t close this page.
              </p>
              {/* Terminal-style progress log */}
              <div className="bg-slate-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
                {progress.map((line, i) => (
                  <div key={i} className="text-green-400">
                    {line}
                  </div>
                ))}
                {!error && <div className="animate-pulse text-orange-400">▊</div>}
              </div>
              {error && (
                <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
                  <p className="text-red-200">{error}</p>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => {
                        setError('');
                        setProgress(['Resuming...']);
                        startProvisioning();
                      }}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                      🔄 Resume / Retry
                    </button>
                    <button
                      onClick={() => {
                        setError('');
                        setProgress([]);
                        setStep('ssh-key');
                      }}
                      className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                      ← Change Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Step: Done (success page) ───────────────────────────────── */}
          {step === 'done' && serverDetails && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold">Your Server is Ready!</h2>
              </div>

              {/* Server connection info */}
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 space-y-3">
                <div>
                  <span className="text-slate-400">Server IP:</span>
                  <code className="ml-2 text-green-400">{serverDetails.ip}</code>
                </div>
                {!serverDetails.isExisting && (
                  <div>
                    <span className="text-slate-400">Gateway Token:</span>
                    <code className="ml-2 text-green-400 break-all">{serverDetails.token}</code>
                  </div>
                )}
              </div>

              {/* Instructions for retrieving token from existing server */}
              {serverDetails.isExisting && (
                <div className="bg-amber-900/30 border border-amber-500 rounded-lg p-4">
                  <h3 className="font-bold mb-2">📋 Get Your Token</h3>
                  <p className="text-slate-300 text-sm mb-2">
                    Connect to your server and run:
                  </p>
                  <code className="block bg-slate-900 p-2 rounded text-green-400 text-sm">
                    cat ~/.openclaw/config.yaml | grep token
                  </code>
                  <p className="text-slate-400 text-xs mt-2">
                    Or check the gateway logs for the token
                  </p>
                </div>
              )}

              {/* SSH connection instructions */}
              <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4">
                <h3 className="font-bold mb-2">🖥️ Connect via SSH</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Open Terminal on your computer and run:
                </p>
                <code className="block bg-slate-900 p-3 rounded text-green-400 text-sm">
                  ssh openclaw@{serverDetails.ip}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`ssh openclaw@${serverDetails.ip}`);
                  }}
                  className="text-blue-400 text-xs mt-2 hover:underline"
                >
                  📋 Copy SSH command
                </button>
              </div>

              {/* Post-connect next steps */}
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="font-bold mb-3">Next Steps (after connecting):</h3>
                <ol className="list-decimal list-inside text-slate-300 space-y-3">
                  <li>
                    Configure your channels (Telegram, etc.):
                    <code className="block bg-slate-900 p-2 rounded mt-1 text-green-400 text-sm">
                      openclaw onboard
                    </code>
                  </li>
                  <li>
                    Start the gateway:
                    <code className="block bg-slate-900 p-2 rounded mt-1 text-green-400 text-sm">
                      sudo systemctl start openclaw-gateway
                    </code>
                  </li>
                </ol>
              </div>

              {/* Web UI access via SSH tunnel */}
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="font-bold mb-2">Access the Web UI:</h3>
                <p className="text-slate-300 text-sm mb-2">Run this on your computer:</p>
                <code className="block bg-slate-900 p-2 rounded text-green-400 text-sm">
                  ssh -L 18789:127.0.0.1:18789 openclaw@{serverDetails.ip}
                </code>
                <p className="text-slate-300 text-sm mt-2">
                  Then open <a href="http://127.0.0.1:18789" className="text-orange-400 underline">http://127.0.0.1:18789</a>
                </p>
              </div>

              {/* Security reminder: delete the API token */}
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <h3 className="font-bold mb-2 text-red-300">🔒 Security: Delete Your API Token</h3>
                <p className="text-slate-300 text-sm mb-2">
                  The API token is no longer needed. Delete it from Hetzner Console for security:
                </p>
                <ol className="list-decimal list-inside text-slate-400 text-sm space-y-1">
                  <li>Go to <a href="https://console.hetzner.cloud/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Hetzner Console</a></li>
                  <li>Select your project → Security → API Tokens</li>
                  <li>Delete the &quot;OpenClaw&quot; token</li>
                </ol>
                <p className="text-slate-400 text-xs mt-2">
                  You can always create a new token if needed later.
                </p>
              </div>

              {/* ⭐ Star the repo CTA */}
              <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 rounded-lg p-4 text-center">
                <h3 className="font-bold mb-2">⭐ Enjoying OpenClaw?</h3>
                <p className="text-slate-300 text-sm mb-3">
                  If this wizard helped you get set up, consider starring the repo — it helps others find the project!
                </p>
                <a
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                  ⭐ Star on GitHub
                </a>
              </div>

              <a
                href="/cleanup"
                className="block text-center text-slate-400 text-sm hover:text-slate-300 underline"
              >
                📖 How to delete your server later
              </a>

              <button
                onClick={() => {
                  const text = `OpenClaw Server
IP: ${serverDetails.ip}
Token: ${serverDetails.token}
SSH: ssh openclaw@${serverDetails.ip}`;
                  navigator.clipboard.writeText(text);
                }}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition"
              >
                📋 Copy Details to Clipboard
              </button>
            </div>
          )}
        </div>

        {/* Footer with source and support links */}
        <p className="text-center text-slate-500 text-sm mt-8">
          <a href={GITHUB_REPO} className="text-slate-400 hover:text-slate-300 underline">View Source</a>
          {' · '}
          <a href={GITHUB_ISSUES} className="text-orange-400 underline">Need Help?</a>
        </p>
      </div>
    </main>
  );
}
