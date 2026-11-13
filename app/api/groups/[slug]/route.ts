import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { deleteDailyRoom, getBranding, getGroupRoom, hostKeyMatches } from '@/lib/groups';

// Public: what the join page needs to show before anyone joins.
export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const room = await getGroupRoom(params.slug);
  if (!room) {
    return NextResponse.json(
      { error: 'not_found', message: 'This meeting link is not valid.' },
      { status: 404 }
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const branding = await getBranding(room.user_id);

  // A staff link carries ?host=<key>. A valid key makes the visitor a host.
  const key = new URL(req.url).searchParams.get('host');
  const isOwner = user?.id === room.user_id;
  const keyOk = hostKeyMatches(room, key);

  return NextResponse.json({
    name: room.name,
    maxParticipants: room.max_participants,
    isHost: isOwner || keyOk,
    isOwner,
    // True when a staff link was used but has since been reset.
    staffLinkExpired: !!key && !keyOk && !isOwner,
    branding,
  });
}

// Owner only: delete the room. Its link stops working for everyone.
export async function DELETE(
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

  const gone = await deleteDailyRoom(room.daily_room_name);
  if (!gone) {
    return NextResponse.json(
      { error: 'daily_error', message: 'Could not delete the room. Try again.' },
      { status: 502 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from('group_rooms').delete().eq('id', room.id);
  if (error) {
    console.error('Failed to delete group room row:', error.message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
