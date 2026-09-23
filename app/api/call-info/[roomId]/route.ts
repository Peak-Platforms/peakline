import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  const supabase = createAdminClient();

  // Reusable link?
  const { data: link } = await supabase
    .from('client_links')
    .select('client_name, calls_remaining, minutes_remaining')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (link) {
    if (link.calls_remaining <= 0 || link.minutes_remaining <= 0) {
      return NextResponse.json(
        { error: 'limit_reached', message: 'This link has run out of calls.' },
        { status: 410 }
      );
    }
    return NextResponse.json({ type: 'reusable', clientName: link.client_name });
  }

  // One-time link?
  const { data: call } = await supabase
    .from('calls')
    .select('client_name, used')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (!call) {
    return NextResponse.json(
      { error: 'not_found', message: 'This link is invalid.' },
      { status: 404 }
    );
  }

  if (call.used) {
    return NextResponse.json(
      { error: 'already_used', message: 'This one-time link has already been used.' },
      { status: 410 }
    );
  }

  return NextResponse.json({ type: 'onetime', clientName: call.client_name });
}