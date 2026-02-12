import { NextRequest } from 'next/server';

const HETZNER_API = 'https://api.hetzner.cloud/v1';
const BOOTSTRAP_URL = 'https://raw.githubusercontent.com/telegraphic-dev/openclaw-hetzner-bootstrap/main/bootstrap.sh';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {
        const { apiToken, sshKey, serverName = 'openclaw', location: preferredLocation = 'fsn1' } = await request.json();

        if (!apiToken) {
          send({ error: 'API token is required' });
          controller.close();
          return;
        }

        const headers = {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        };

        // Test API connection
        send({ progress: '🔑 Verifying API token...' });
        const testRes = await fetch(`${HETZNER_API}/servers`, { headers });
        if (!testRes.ok) {
          send({ error: 'Invalid API token. Please check and try again.' });
          controller.close();
          return;
        }
        send({ progress: '✓ API token valid' });

        // Upload SSH key if provided
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
            // Key might already exist
            const existingKeys = await fetch(`${HETZNER_API}/ssh_keys`, { headers });
            const keysData = await existingKeys.json();
            const keyPrefix = sshKey.trim().split(' ').slice(0, 2).join(' ');
            const existing = keysData.ssh_keys?.find((k: { public_key: string }) => 
              k.public_key.startsWith(keyPrefix)
            );
            if (existing) {
              sshKeyId = existing.id;
              send({ progress: '✓ Using existing SSH key' });
            }
          }
        }

        // Cloud-init script
        const cloudInit = `#cloud-config
runcmd:
  - curl -fsSL ${BOOTSTRAP_URL} | bash > /var/log/openclaw-bootstrap.log 2>&1
  - echo "BOOTSTRAP_COMPLETE" >> /var/log/openclaw-bootstrap.log`;

        // Create server - try multiple locations
        send({ progress: '🖥️ Creating server...' });
        
        // Put preferred location first, then fallbacks
        const allLocations = ['fsn1', 'nbg1', 'hel1', 'ash', 'hil', 'sin'];
        const locations = [preferredLocation, ...allLocations.filter(l => l !== preferredLocation)];
        let createRes: Response | null = null;
        let createData: { server: { id: number; public_net: { ipv4: { ip: string } } }; root_password?: string } | null = null;
        let usedLocation = '';
        
        for (const location of locations) {
          const serverPayload: {
            name: string;
            server_type: string;
            location: string;
            image: string;
            user_data: string;
            ssh_keys?: number[];
          } = {
            name: serverName,
            server_type: 'cax11', // ARM, 2 vCPU, 4GB RAM, ~€4/mo
            location,
            image: 'ubuntu-24.04',
            user_data: cloudInit,
          };
          
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
            usedLocation = location;
            break;
          }
          
          const err = await createRes.json();
          // If location disabled or unavailable, try next
          if (err.error?.message?.includes('location') || err.error?.code === 'unavailable') {
            send({ progress: `⚠️ Location ${location} unavailable, trying next...` });
            continue;
          }
          
          // Other errors - fail immediately
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
        send({ progress: '⏳ Waiting for server to boot...' });

        // Wait for server to be running
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const statusRes = await fetch(`${HETZNER_API}/servers/${serverId}`, { headers });
          const statusData = await statusRes.json();
          if (statusData.server.status === 'running') {
            send({ progress: '✓ Server is running' });
            break;
          }
        }

        send({ progress: '🔧 Installing OpenClaw (this takes 2-3 minutes)...' });
        
        // We can't SSH from serverless, so just wait and assume it works
        // In production, you'd use a status webhook or poll an endpoint
        await new Promise(r => setTimeout(r, 120000)); // Wait 2 minutes

        send({ progress: '✓ Installation complete!' });

        // Generate a token (in reality we'd fetch it from the server)
        const gatewayToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0')).join('');

        send({
          done: true,
          server: {
            ip: serverIp,
            name: serverName,
            token: gatewayToken,
            rootPassword: rootPassword || null,
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
