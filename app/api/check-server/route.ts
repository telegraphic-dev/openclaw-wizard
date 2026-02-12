/**
 * Check Server API Route
 * 
 * Validates a Hetzner API token and checks if a server with
 * the given name already exists. This is used to:
 * 
 * 1. Validate the API token before proceeding
 * 2. Detect existing servers to skip provisioning
 * 3. Allow resuming if the wizard was interrupted
 * 
 * @example Request:
 * POST /api/check-server
 * { "apiToken": "...", "serverName": "my-openclaw" }
 * 
 * @example Response (new server):
 * { "valid": true, "exists": false }
 * 
 * @example Response (existing server):
 * { "valid": true, "exists": true, "server": { "ip": "...", ... } }
 */
import { NextRequest, NextResponse } from 'next/server';

/** Hetzner Cloud API base URL */
const HETZNER_API = 'https://api.hetzner.cloud/v1';

/**
 * POST handler to validate token and check for existing servers.
 */
export async function POST(request: NextRequest) {
  try {
    const { apiToken, serverName = 'my-openclaw' } = await request.json();

    if (!apiToken) {
      return NextResponse.json({ valid: false, error: 'API token is required' });
    }

    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // Check API token and look for existing server
    const res = await fetch(`${HETZNER_API}/servers`, { headers });
    
    if (!res.ok) {
      return NextResponse.json({ valid: false, error: 'Invalid API token' });
    }

    const data = await res.json();
    const existingServer = data.servers?.find((s: { name: string }) => s.name === serverName);

    if (existingServer) {
      const serverIp = existingServer.public_net?.ipv4?.ip;
      
      if (existingServer.status === 'running' && serverIp) {
        return NextResponse.json({
          valid: true,
          exists: true,
          server: {
            ip: serverIp,
            name: existingServer.name,
            serverId: existingServer.id,
            isExisting: true,
            token: '(see instructions below)',
          },
        });
      }
    }

    // No existing server, token is valid
    return NextResponse.json({ valid: true, exists: false });
    
  } catch (error) {
    return NextResponse.json({ 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
