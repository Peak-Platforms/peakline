import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import {
  cleanGroupName,
  createDailyGroupRoom,
  deleteDailyRoom,
  getGroupPlan,
  makeSlug,
} from '@/lib/groups';

// The signed-in professional's group rooms, and whether Groups is turned on for them.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const plan = await getGroupPlan(user.id);
  const admin = createAdminClient();
  const { data: rooms } = await admin
    .from('group_rooms')
    .select('id, name, slug, max_participants, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    enabled: !!plan,
    maxRooms: plan?.maxRooms ?? 0,
    maxParticipants: plan?.maxParticipants ?? 0,
    rooms: rooms || [],
  });
}

// Create a standing group room.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const plan = await getGroupPlan(user.id);
  if (!plan) {
    return NextResponse.json(
      { error: 'groups_not_enabled', message: 'Groups is not turned on for this account.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = cleanGroupName(body?.name);
  if (!name) {
    return NextResponse.json({ error: 'name_required', message: 'Give the room a name first.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from('group_rooms')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if ((count || 0) >= plan.maxRooms) {
    return NextResponse.json(
      {
        error: 'room_limit',
        message:
          plan.maxRooms === 1
            ? 'Your plan includes one group room. Delete it first to make a new one.'
            : `Your plan includes ${plan.maxRooms} group rooms.`,
      },
      { status: 409 }
    );
  }

  const slug = makeSlug(name);
  const dailyRoomName = 'grp-' + slug;

  const daily = await createDailyGroupRoom(dailyRoomName, plan.maxParticipants);
  if (!daily.ok) {
    return NextResponse.json({ error: 'daily_error', message: daily.error }, { status: 502 });
  }

  const { data: room, error: dbError } = await admin
    .from('group_rooms')
    .insert({
      user_id: user.id,
      name,
      slug,
      daily_room_name: dailyRoomName,
      room_url: daily.url,
      max_participants: plan.maxParticipants,
    })
    .select('id, name, slug, max_participants, created_at')
    .single();

  if (dbError || !room) {
    console.error('Failed to save group room:', dbError?.message);
    // Don't leave a room behind at Daily that nothing points to.
    await deleteDailyRoom(dailyRoomName).catch(() => {});
    return NextResponse.json({ error: 'save_failed', message: 'Could not save the room. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ room });
}
