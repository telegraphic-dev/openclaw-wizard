'use client';

import { useState } from 'react';

type Step = 'intro' | 'hetzner-account' | 'api-token' | 'ssh-key' | 'provisioning' | 'done';

interface ServerDetails {
  ip: string;
  name: string;
  token: string;
}

export default function Wizard() {
  const [step, setStep] = useState<Step>('intro');
  const [apiToken, setApiToken] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [serverName, setServerName] = useState('my-openclaw');
  const [location, setLocation] = useState('fsn1');
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [serverDetails, setServerDetails] = useState<ServerDetails | null>(null);

  const startProvisioning = async () => {
    setStep('provisioning');
    setProgress(['Starting provisioning...']);
    setError('');

    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken, sshKey, serverName, location }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
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
          } catch {}
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">🦞 OpenClaw Setup Wizard</h1>
          <p className="text-slate-400">Get your AI agent running in 5 minutes</p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          {['intro', 'hetzner-account', 'api-token', 'ssh-key', 'provisioning', 'done'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step === s ? 'bg-orange-500' : 
                  ['intro', 'hetzner-account', 'api-token', 'ssh-key', 'provisioning', 'done'].indexOf(step) > i 
                    ? 'bg-green-500' : 'bg-slate-700'}`}>
                {i + 1}
              </div>
              {i < 5 && <div className="w-8 h-1 bg-slate-700" />}
            </div>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl p-8 shadow-xl">
          {/* Step: Intro */}
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
              <button
                onClick={() => setStep('hetzner-account')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition"
              >
                Let&apos;s Start →
              </button>
            </div>
          )}

          {/* Step: Hetzner Account */}
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

          {/* Step: API Token */}
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
              <div className="flex gap-4">
                <button
                  onClick={() => setStep('hetzner-account')}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('ssh-key')}
                  disabled={!apiToken}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step: SSH Key */}
          {step === 'ssh-key' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Step 3: SSH Key (Optional)</h2>
              <p className="text-slate-300">
                An SSH key lets you securely connect to your server.
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
                    <option value="fsn1">🇩🇪 Falkenstein, Germany</option>
                    <option value="nbg1">🇩🇪 Nuremberg, Germany</option>
                    <option value="hel1">🇫🇮 Helsinki, Finland</option>
                    <option value="ash">🇺🇸 Ashburn, USA</option>
                    <option value="hil">🇺🇸 Hillsboro, USA</option>
                    <option value="sin">🇸🇬 Singapore</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setStep('api-token')}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  onClick={startProvisioning}
                  disabled={!apiToken}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition"
                >
                  🚀 Create Server
                </button>
              </div>
            </div>
          )}

          {/* Step: Provisioning */}
          {step === 'provisioning' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Creating Your Server...</h2>
              <p className="text-slate-300">
                This usually takes 2-3 minutes. Please don&apos;t close this page.
              </p>
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
                  <button
                    onClick={() => setStep('api-token')}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && serverDetails && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold">Your Server is Ready!</h2>
              </div>
              
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 space-y-3">
                <div>
                  <span className="text-slate-400">Server IP:</span>
                  <code className="ml-2 text-green-400">{serverDetails.ip}</code>
                </div>
                <div>
                  <span className="text-slate-400">Gateway Token:</span>
                  <code className="ml-2 text-green-400 break-all">{serverDetails.token}</code>
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="font-bold mb-3">Next Steps:</h3>
                <ol className="list-decimal list-inside text-slate-300 space-y-3">
                  <li>
                    Open Terminal and connect:
                    <code className="block bg-slate-900 p-2 rounded mt-1 text-green-400 text-sm">
                      ssh openclaw@{serverDetails.ip}
                    </code>
                  </li>
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

        <p className="text-center text-slate-500 text-sm mt-8">
          Need help? Join the <a href="https://discord.gg/openclaw" className="text-orange-400 underline">OpenClaw Discord</a>
        </p>
      </div>
    </main>
  );
}
