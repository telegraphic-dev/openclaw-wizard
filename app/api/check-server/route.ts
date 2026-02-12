import { NextRequest, NextResponse } from 'next/server';

const HETZNER_API = 'https://api.hetzner.cloud/v1';

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
