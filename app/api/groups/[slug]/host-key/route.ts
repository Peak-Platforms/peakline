import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getGroupRoom, makeHostKey } from '@/lib/groups';

// Owner only: replace the room's staff link with a new one. The old staff link
// stops working at once. The public guest link is not affected.
export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const room = await getGroupRoom(params.slug);
  if (!room) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (room.user_id !== user.id) {
    return NextResponse.json({ error: 'not_your_room' }, { status: 403 });
  }

  const hostKey = makeHostKey();
  const admin = createAdminClient();
  const { error } = await admin.from('group_rooms').update({ host_key: hostKey }).eq('id', room.id);
  if (error) {
    console.error('Failed to reset staff link:', error.message);
    return NextResponse.json(
      { error: 'server_error', message: 'Could not reset the staff link. Try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ hostKey });
}
