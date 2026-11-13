import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  cleanPersonName,
  createGroupToken,
  getBranding,
  getGroupPlan,
  getGroupRoom,
  getHeadcount,
} from '@/lib/groups';

// Hands out a pass into the room.
//
// The host (the signed-in owner) can always get in. Everyone else is let in only
// while a meeting is under way, which is what stops a standing link from being
// used when the business isn't there. The first person into an empty room is
// therefore always the host. Once the last person leaves, the room locks again.
export async function POST(
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

  // Groups switched off for the owner (for example the plan ended): room is closed.
  const plan = await getGroupPlan(room.user_id);
  if (!plan) {
    return NextResponse.json(
      { error: 'not_available', message: 'This meeting room is not available right now.' },
      { status: 403 }
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isHost = user?.id === room.user_id;

  const body = await req.json().catch(() => ({}));
  let name = cleanPersonName(body?.name);

  if (!isHost) {
    if (!name) {
      return NextResponse.json(
        { error: 'name_required', message: 'Enter your name to join.' },
        { status: 400 }
      );
    }

    const headcount = await getHeadcount(room.daily_room_name);
    if (headcount === null) {
      return NextResponse.json(
        { error: 'daily_error', message: 'Could not reach the meeting. Try again.' },
        { status: 502 }
      );
    }
    if (headcount === 0) {
      return NextResponse.json({ waiting: true });
    }
    if (headcount >= room.max_participants) {
      return NextResponse.json(
        { error: 'full', message: 'This meeting is full.' },
        { status: 409 }
      );
    }
  } else if (!name) {
    const branding = await getBranding(room.user_id);
    name = cleanPersonName(branding.displayName) || 'Host';
  }

  const token = await createGroupToken({
    roomName: room.daily_room_name,
    userName: name,
    isHost,
    hostUserId: isHost ? user!.id : undefined,
  });

  if (!token) {
    return NextResponse.json(
      { error: 'daily_error', message: 'Could not join the meeting. Try again.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ roomUrl: room.room_url, token, isHost });
}
