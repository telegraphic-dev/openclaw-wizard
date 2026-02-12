/**
 * @file Cleanup/deletion guide page.
 *
 * Accessible at /cleanup — provides step-by-step instructions for users
 * who want to delete their OpenClaw server and stop Hetzner billing.
 *
 * This is a static server component (no client-side interactivity needed).
 */

/** GitHub issues URL for support links. */
const GITHUB_ISSUES = 'https://github.com/telegraphic-dev/openclaw-wizard/issues';

/**
 * CleanupPage — guides users through server deletion.
 *
 * Covers:
 * 1. Backing up OpenClaw configuration (optional)
 * 2. Deleting the server from Hetzner Console
 * 3. Cleaning up SSH keys and API tokens
 * 4. Billing explanation (hourly, stops on deletion)
 */
export default function CleanupPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">🗑️ Deleting Your Server</h1>
          <p className="text-slate-400">How to remove your OpenClaw server and stop billing</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-8 shadow-xl space-y-6">

          {/* Permanent deletion warning */}
          <div className="bg-amber-900/30 border border-amber-500 rounded-lg p-4">
            <h3 className="font-bold mb-2 text-amber-300">⚠️ This is permanent</h3>
            <p className="text-slate-300 text-sm">
              Deleting your server will permanently remove all data on it. Make sure to backup
              anything important (like your OpenClaw configuration) before proceeding.
            </p>
          </div>

          {/* Step 1: Backup */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Step 1: Backup Your Data (Optional)</h2>
            <p className="text-slate-300">
              If you want to keep your OpenClaw configuration for a future server, save it first:
            </p>
            <code className="block bg-slate-900 p-3 rounded text-green-400 text-sm">
              scp openclaw@YOUR_IP:~/.openclaw/config.yaml ./openclaw-backup.yaml
            </code>
          </div>

          {/* Step 2: Delete the server */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Step 2: Delete the Server</h2>
            <ol className="list-decimal list-inside text-slate-300 space-y-3">
              <li>
                Go to <a href="https://console.hetzner.cloud/" target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 underline">Hetzner Cloud Console</a>
              </li>
              <li>Select your project</li>
              <li>Click on your server (e.g., &quot;my-openclaw&quot;)</li>
              <li>Scroll down and click <strong className="text-red-400">Delete</strong></li>
              <li>Type the server name to confirm</li>
              <li>Click <strong className="text-red-400">Delete server</strong></li>
            </ol>
          </div>

          {/* Step 3: Optional cleanup */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Step 3: Clean Up (Optional)</h2>
            <p className="text-slate-300">
              You may also want to remove these from Hetzner Console:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1 text-sm">
              <li>Security → SSH Keys → Delete any keys you uploaded</li>
              <li>Security → API Tokens → Delete the &quot;OpenClaw&quot; token (if not already done)</li>
            </ul>
          </div>

          {/* Billing info */}
          <div className="bg-slate-700 rounded-lg p-4">
            <h3 className="font-bold mb-2">💰 About Billing</h3>
            <p className="text-slate-300 text-sm">
              Hetzner bills hourly. As soon as you delete the server, billing stops.
              You&apos;ll only be charged for the time the server was running (prorated to the hour).
            </p>
            <p className="text-slate-400 text-sm mt-2">
              Example: If you ran a CAX11 server for 3 days, you&apos;d pay approximately €0.38
              (72 hours × €0.0053/hour).
            </p>
          </div>

          <div className="text-center pt-4">
            <a
              href="/"
              className="inline-block bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              ← Back to Setup Wizard
            </a>
          </div>
        </div>

        {/* Footer with support link */}
        <p className="text-center text-slate-500 text-sm mt-8">
          Questions? Open an issue on <a href={GITHUB_ISSUES} className="text-orange-400 underline">GitHub</a>
        </p>
      </div>
    </main>
  );
}
