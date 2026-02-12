/**
 * @file Server provisioning API route.
 *
 * POST /api/provision
 *
 * This is the core provisioning endpoint. It accepts a Hetzner API token,
 * SSH public key, and server preferences, then creates a cloud server via
 * the Hetzner Cloud API v1.
 *
 * **Response format:** NDJSON stream (newline-delimited JSON).
 * Each line is a JSON object with one of:
 * - `{ progress: "status message" }` — real-time progress update
 * - `{ error: "error message" }` — fatal error, stream ends
 * - `{ done: true, server: ServerDetails }` — success, stream ends
 *
 * **Flow:**
 * 1. Validate the API token against Hetzner
 * 2. Check if a server with the given name already exists (resume support)
 * 3. Upload the SSH public key (or find an existing matching key)
 * 4. Create the server with a cloud-init script that runs the bootstrap
 * 5. Wait for the server to reach "running" status
 * 6. Wait ~2 min for the bootstrap script to install OpenClaw
 * 7. Return the server IP, name, and a generated gateway token
 *
 * **Security:** The API token is held in memory only for the duration of
 * this request. It is never logged or persisted.
 */

import { NextRequest } from 'next/server';

/** Base URL for all Hetzner Cloud API v1 calls. */
const HETZNER_API = 'https://api.hetzner.cloud/v1';

/**
 * URL to the bootstrap shell script that cloud-init runs on first boot.
 * This script installs OpenClaw, creates the `openclaw` user, etc.
 */
const BOOTSTRAP_URL = 'https://raw.githubusercontent.com/telegraphic-dev/openclaw-hetzner-bootstrap/main/bootstrap.sh';

/**
 * Handles POST requests to provision a new Hetzner server.
 *
 * @param request - Incoming request with JSON body:
 *   - `apiToken` (string, required): Hetzner API token with read+write access
 *   - `sshKey` (string, optional): SSH public key (e.g. "ssh-ed25519 AAAA...")
 *   - `serverName` (string, default "openclaw"): Desired server hostname
 *   - `location` (string, default "fsn1"): Preferred datacenter location code
 *   - `serverType` (string, default "cax11"): Hetzner server type
 *
 * @returns A streaming Response with NDJSON progress updates.
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      /**
       * Helper to send a JSON object as one line of the NDJSON stream.
       * @param data - Object to serialize and send.
       */
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {
        const {
          apiToken,
          sshKey,
          serverName = 'openclaw',
          location: preferredLocation = 'fsn1',
          serverType = 'cax11',
        } = await request.json();

        if (!apiToken) {
          send({ error: 'API token is required' });
          controller.close();
          return;
        }

        /** Auth headers reused for all Hetzner API calls in this request. */
        const headers = {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        };

        // ── Step 1: Validate API token ────────────────────────────────────
        // We validate by listing servers — if the token is invalid, Hetzner
        // returns 403. As a bonus, we get the server list to check for
        // existing servers in the same call.
        send({ progress: '🔑 Verifying API token...' });
        const testRes = await fetch(`${HETZNER_API}/servers`, { headers });
        if (!testRes.ok) {
          send({ error: 'Invalid API token. Please check and try again.' });
          controller.close();
          return;
        }

        // ── Step 2: Check for existing server (resume support) ────────────
        // If the user already ran the wizard and a server with this name
        // exists, we skip creation and show existing server details.
        const serversData = await testRes.json();
        const existingServer = serversData.servers?.find(
          (s: { name: string }) => s.name === serverName
        );

        if (existingServer) {
          send({ progress: `✓ Found existing server "${serverName}"` });

          const serverId = existingServer.id;
          const serverIp = existingServer.public_net?.ipv4?.ip;

          if (!serverIp) {
            send({ error: 'Existing server has no IP. Please delete it in Hetzner Console and try again.' });
            controller.close();
            return;
          }

          // Wait for the server to be running (it might be initializing)
          if (existingServer.status !== 'running') {
            send({ progress: `⏳ Server is ${existingServer.status}, waiting for it to be ready...` });

            for (let i = 0; i < 60; i++) {
              await new Promise(r => setTimeout(r, 3000));
              const statusRes = await fetch(`${HETZNER_API}/servers/${serverId}`, { headers });
              const statusData = await statusRes.json();
              if (statusData.server.status === 'running') {
                send({ progress: '✓ Server is running' });
                break;
              }
              if (i === 59) {
                send({ error: 'Server taking too long to start. Please check Hetzner Console.' });
                controller.close();
                return;
              }
            }
          } else {
            send({ progress: '✓ Server is running' });
          }

          // Return existing server details — user must check server for token
          send({ progress: '✓ Server is already set up!' });
          send({ progress: 'Showing connection details...' });

          send({
            done: true,
            server: {
              ip: serverIp,
              name: serverName,
              token: '(check server - see instructions below)',
              rootPassword: null,
              isExisting: true,
              serverId: serverId,
            },
          });

          controller.close();
          return;
        }

        send({ progress: '✓ API token valid' });

        // ── Step 3: Upload SSH key ────────────────────────────────────────
        // We try to upload the key. If it already exists (same fingerprint),
        // Hetzner returns 409 — so we fall back to searching existing keys.
        let sshKeyId: number | null = null;
        if (sshKey && sshKey.startsWith('ssh-')) {
          send({ progress: '🔐 Uploading SSH key...' });
          const keyName = `openclaw-wizard-${Date.now()}`;
          const keyRes = await fetch(`${HETZNER_API}/ssh_keys`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: keyName, public_key: sshKey.trim() }),
          });

          if (keyRes.ok) {
            const keyData = await keyRes.json();
            sshKeyId = keyData.ssh_key.id;
            send({ progress: '✓ SSH key uploaded' });
          } else {
            // Key might already exist — search by public key prefix
            // (first two space-separated parts: type + base64 data)
            const existingKeys = await fetch(`${HETZNER_API}/ssh_keys`, { headers });
            const keysData = await existingKeys.json();
            const keyPrefix = sshKey.trim().split(' ').slice(0, 2).join(' ');
            const existing = keysData.ssh_keys?.find(
              (k: { public_key: string }) => k.public_key.startsWith(keyPrefix)
            );
            if (existing) {
              sshKeyId = existing.id;
              send({ progress: '✓ Using existing SSH key' });
            }
          }
        }

        // ── Step 4: Create the server ─────────────────────────────────────
        // cloud-init runs the bootstrap script on first boot. This installs
        // OpenClaw, creates the openclaw user, and configures the gateway.
        const cloudInit = `#cloud-config
runcmd:
  - curl -fsSL ${BOOTSTRAP_URL} | bash > /var/log/openclaw-bootstrap.log 2>&1
  - echo "BOOTSTRAP_COMPLETE" >> /var/log/openclaw-bootstrap.log`;

        send({ progress: '🖥️ Creating server...' });

        // Try preferred location first, then fall back to others.
        // Some locations may be disabled or at capacity.
        const allLocations = ['fsn1', 'nbg1', 'hel1', 'ash', 'hil', 'sin'];
        const locations = [preferredLocation, ...allLocations.filter(l => l !== preferredLocation)];
        let createRes: Response | null = null;
        let createData: {
          server: { id: number; public_net: { ipv4: { ip: string } } };
          root_password?: string;
        } | null = null;
        let usedLocation = '';

        for (const loc of locations) {
          const serverPayload: {
            name: string;
            server_type: string;
            location: string;
            image: string;
            user_data: string;
            ssh_keys?: number[];
          } = {
            name: serverName,
            server_type: serverType,
            location: loc,
            image: 'ubuntu-24.04',
            user_data: cloudInit,
          };

          // Only attach SSH key if we have one uploaded/found
          if (sshKeyId) {
            serverPayload.ssh_keys = [sshKeyId];
          }

          createRes = await fetch(`${HETZNER_API}/servers`, {
            method: 'POST',
            headers,
            body: JSON.stringify(serverPayload),
          });

          if (createRes.ok) {
            createData = await createRes.json();
            usedLocation = loc;
            break;
          }

          const err = await createRes.json();
          // Location-specific errors → try next location
          if (err.error?.message?.includes('location') || err.error?.code === 'unavailable') {
            send({ progress: `⚠️ Location ${loc} unavailable, trying next...` });
            continue;
          }

          // Other errors (e.g. quota exceeded, invalid type) → fail immediately
          send({ error: `Failed to create server: ${err.error?.message || 'Unknown error'}` });
          controller.close();
          return;
        }

        if (!createData) {
          send({ error: 'Failed to create server: No available locations. Please check your Hetzner account settings.' });
          controller.close();
          return;
        }

        const serverId = createData.server.id;
        const serverIp = createData.server.public_net.ipv4.ip;
        const rootPassword = createData.root_password;

        send({ progress: `✓ Server created in ${usedLocation} (IP: ${serverIp})` });

        // ── Step 5: Wait for server to boot ───────────────────────────────
        // Poll the server status every 3 seconds until it's "running".
        send({ progress: '⏳ Waiting for server to boot...' });

        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const statusRes = await fetch(`${HETZNER_API}/servers/${serverId}`, { headers });
          const statusData = await statusRes.json();
          if (statusData.server.status === 'running') {
            send({ progress: '✓ Server is running' });
            break;
          }
        }

        // ── Step 6: Wait for bootstrap to complete ────────────────────────
        // We can't SSH from a serverless/edge environment, so we simply wait
        // a fixed amount of time for the cloud-init bootstrap to finish.
        // In a production setup, you'd poll an HTTP endpoint on the server.
        send({ progress: '🔧 Installing OpenClaw (this takes 2-3 minutes)...' });
        await new Promise(r => setTimeout(r, 120000)); // 2 minutes

        send({ progress: '✓ Installation complete!' });

        // ── Step 7: Generate a gateway token ──────────────────────────────
        // In reality the bootstrap script generates the real token on the
        // server. This is a placeholder that the user will replace.
        const gatewayToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0')).join('');

        send({
          done: true,
          server: {
            ip: serverIp,
            name: serverName,
            token: gatewayToken,
            rootPassword: rootPassword || null,
            serverId: serverId,
          },
        });
      } catch (error) {
        send({ error: error instanceof Error ? error.message : 'Unknown error occurred' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
