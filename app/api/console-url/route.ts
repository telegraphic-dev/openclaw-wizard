/**
 * @file API route to request a Hetzner VNC console URL for a server.
 *
 * POST /api/console-url
 *
 * This endpoint requests a WebSocket-based VNC console session from Hetzner,
 * which can be used to access a server's terminal directly in the browser.
 * Currently not used in the main wizard flow, but available as a fallback
 * for debugging server issues when SSH isn't working.
 *
 * @returns JSON with console access details:
 *   - `{ success: true, wssUrl, password, consoleUrl }` on success
 *   - `{ error: "..." }` on failure
 */

import { NextRequest, NextResponse } from 'next/server';

/** Base URL for Hetzner Cloud API v1. */
const HETZNER_API = 'https://api.hetzner.cloud/v1';

/**
 * Requests a VNC console session for a Hetzner server.
 *
 * @param request - POST body with:
 *   - `apiToken` (string, required): Hetzner API token
 *   - `serverId` (number, required): Hetzner server ID
 *
 * @returns JSON with WebSocket URL, password, and browser console link.
 */
export async function POST(request: NextRequest) {
  try {
    const { apiToken, serverId } = await request.json();

    if (!apiToken || !serverId) {
      return NextResponse.json({ error: 'API token and server ID required' });
    }

    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // Request a console session — Hetzner returns a WebSocket URL and
    // a one-time password for VNC authentication.
    const res = await fetch(`${HETZNER_API}/servers/${serverId}/actions/request_console`, {
      method: 'POST',
      headers,
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || 'Failed to request console' });
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      /** WebSocket URL for direct VNC connection. */
      wssUrl: data.wss_url,
      /** One-time password for VNC auth. */
      password: data.password,
      /** Convenience link to Hetzner's browser-based console. */
      consoleUrl: `https://console.hetzner.cloud/servers/${serverId}/console`,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
