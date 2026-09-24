import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  const supabase = createAdminClient();

  // Reusable link — check eligibility only, don't consume yet
  const { data: link } = await supabase
    .from('client_links')
    .select('room_url, calls_remaining, minutes_remaining')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (link) {
    if (link.calls_remaining <= 0 || link.minutes_remaining <= 0) {
      return NextResponse.json(
        { error: 'limit_reached', message: 'This link has run out of calls.' },
        { status: 410 }
      );
    }
    return NextResponse.json({ roomUrl: link.room_url });
  }

  // One-time link — check eligibility only, don't mark used yet
  const { data: call } = await supabase
    .from('calls')
    .select('room_url, used')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (!call) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (call.used) {
    return NextResponse.json({ error: 'already_used' }, { status: 410 });
  }

  return NextResponse.json({ roomUrl: call.room_url });
}