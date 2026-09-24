import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  // Check reusable links first
  const { data: link } = await supabase
    .from('client_links')
    .select('room_url, user_id')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (link) {
    if (link.user_id !== user.id) {
      return NextResponse.json({ error: 'not_your_link' }, { status: 403 });
    }
    return NextResponse.json({ roomUrl: link.room_url });
  }

  // Then one-time calls
  const { data: call } = await supabase
    .from('calls')
    .select('room_url, user_id')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (!call) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (call.user_id !== user.id) {
    return NextResponse.json({ error: 'not_your_link' }, { status: 403 });
  }

  return NextResponse.json({ roomUrl: call.room_url });
}