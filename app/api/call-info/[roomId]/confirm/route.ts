import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  const supabase = createAdminClient();

  // Reusable link
  const { data: link } = await supabase
    .from('client_links')
    .select('id, calls_remaining')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (link) {
    const { error } = await supabase
      .from('client_links')
      .update({ calls_remaining: link.calls_remaining - 1 })
      .eq('id', link.id)
      .gt('calls_remaining', 0);

    if (error) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // One-time link
  const { data: call } = await supabase
    .from('calls')
    .select('id, used')
    .eq('daily_room_name', roomId)
    .maybeSingle();

  if (!call) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('calls')
    .update({ used: true })
    .eq('id', call.id)
    .eq('used', false);

  if (error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}