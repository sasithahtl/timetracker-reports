import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '../../../lib/database';
import { verifySessionToken, getSessionSecret } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value || '';
    const session = await verifySessionToken(token, getSessionSecret());
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const connection = await getConnection();
    try {
      const [result] = await connection.execute(
        'UPDATE tt_users SET password = MD5(?) WHERE id = ? AND password = MD5(?) AND status = 1',
        [newPassword, session.sub, currentPassword]
      );
      const ok = typeof result === 'object' && result !== null && 'affectedRows' in result ? (result as any).affectedRows > 0 : false;
      if (!ok) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    } finally {
      await connection.end();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}


