import { NextRequest, NextResponse } from 'next/server';

const HETZNER_API = 'https://api.hetzner.cloud/v1';

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

    // Request console access
    const res = await fetch(`${HETZNER_API}/servers/${serverId}/actions/request_console`, {
      method: 'POST',
      headers,
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || 'Failed to request console' });
    }

    const data = await res.json();
    
    // The response contains wss_url and password
    return NextResponse.json({
      success: true,
      wssUrl: data.wss_url,
      password: data.password,
      // Try to construct a browser console URL
      consoleUrl: `https://console.hetzner.cloud/servers/${serverId}/console`,
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
