// app/api/network-info/route.ts
import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal && !alias.address.startsWith('127.')) {
          ips.push(alias.address);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ips,
      primaryIp: ips[0] || 'localhost'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
