import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  const supabase = createAdminClient();

  // Reusable link — decrement calls_remaining atomically
  const { data: link } = await supabase
    .from('client_links')
    .select('id, room_url, calls_remaining, minutes_remaining')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (link) {
    if (link.calls_remaining <= 0 || link.minutes_remaining <= 0) {
      return NextResponse.json(
        { error: 'limit_reached', message: 'This link has run out of calls.' },
        { status: 410 }
      );
    }

    const { error: updateError } = await supabase
      .from('client_links')
      .update({ calls_remaining: link.calls_remaining - 1 })
      .eq('id', link.id)
      .gt('calls_remaining', 0); // guards against a race on simultaneous joins

    if (updateError) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    return NextResponse.json({ roomUrl: link.room_url });
  }

  // One-time link — mark used, only if not already used (prevents replay)
  const { data: call } = await supabase
    .from('calls')
    .select('id, room_url, used')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (!call) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (call.used) {
    return NextResponse.json({ error: 'already_used' }, { status: 410 });
  }

  const { error: markError } = await supabase
    .from('calls')
    .update({ used: true })
    .eq('id', call.id)
    .eq('used', false); // guards against a double-click race

  if (markError) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ roomUrl: call.room_url });
}