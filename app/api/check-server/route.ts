/**
 * @file API route to validate a Hetzner API token and detect existing servers.
 *
 * POST /api/check-server
 *
 * Called when the user submits their API token in the wizard (step 2 → step 3).
 * It serves two purposes:
 * 1. Validates the token by making a test call to Hetzner's API
 * 2. Checks if a server with the expected name already exists
 *
 * If a running server is found, the wizard can skip straight to the "done"
 * step instead of re-provisioning. This makes the wizard idempotent — users
 * can safely revisit it without creating duplicate servers.
 *
 * @returns JSON response:
 *   - `{ valid: false, error: "..." }` — token is invalid
 *   - `{ valid: true, exists: false }` — token works, no existing server
 *   - `{ valid: true, exists: true, server: { ip, name, serverId, ... } }` — server found
 */

import { NextRequest, NextResponse } from 'next/server';

/** Base URL for Hetzner Cloud API v1. */
const HETZNER_API = 'https://api.hetzner.cloud/v1';

/**
 * Validates a Hetzner API token and optionally detects an existing server.
 *
 * @param request - POST body with:
 *   - `apiToken` (string, required): The Hetzner API token to validate
 *   - `serverName` (string, default "my-openclaw"): Server name to search for
 *
 * @returns JSON with validation result and optional server details.
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

    // List all servers — this both validates the token and gives us the
    // server list to search for an existing server in a single API call.
    const res = await fetch(`${HETZNER_API}/servers`, { headers });

    if (!res.ok) {
      return NextResponse.json({ valid: false, error: 'Invalid API token' });
    }

    const data = await res.json();

    // Search for a server matching the expected name
    const existingServer = data.servers?.find(
      (s: { name: string }) => s.name === serverName
    );

    if (existingServer) {
      const serverIp = existingServer.public_net?.ipv4?.ip;

      // Only report as "existing" if it's actually running with an IP
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

    // Token is valid, no usable existing server found
    return NextResponse.json({ valid: true, exists: false });
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
