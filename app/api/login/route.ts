import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '../../../lib/database';
import { createSessionToken, getSessionSecret } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const login = String(body.login || '').trim();
    const password = String(body.password || '');

    if (!login || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const connection = await getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT id, login, name, role_id FROM tt_users WHERE login = ? AND password = MD5(?) AND status = 1 LIMIT 1',
        [login, password]
      );
      const user = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { id: number; login: string; name: string; role_id: number | null }) : null;
      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const now = Math.floor(Date.now() / 1000);
      const exp = now + 60 * 60 * 24 * 7; // 7 days
      const token = await createSessionToken(
        { sub: Number(user.id), login: user.login, name: user.name || user.login, role_id: user.role_id ?? null, iat: now, exp },
        getSessionSecret()
      );

      const response = NextResponse.json({ ok: true, user: { id: user.id, login: user.login, name: user.name, role_id: user.role_id } });
      response.cookies.set('session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.log('Invalid request', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}


