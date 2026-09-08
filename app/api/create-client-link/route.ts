import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const DEFAULT_CALLS = 10;
const DEFAULT_MINUTES = 300;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { clientName, calls, minutes } = await req.json();
  if (!clientName || typeof clientName !== 'string') {
    return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
  }

  const callsAllotment = Number.isInteger(calls) && calls > 0 ? calls : DEFAULT_CALLS;
  const minutesAllotment = Number.isInteger(minutes) && minutes > 0 ? minutes : DEFAULT_MINUTES;

  const roomName = 'client-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.DAILY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        max_participants: 2,
        enable_recording: false
      }
    })
  });

  if (!dailyRes.ok) {
    const err = await dailyRes.json().catch(() => ({}));
    console.error('Daily API error:', dailyRes.status, JSON.stringify(err));
    return NextResponse.json({ error: err.error || err.info || 'Could not create room' }, { status: 502 });
  }

  const room = await dailyRes.json();

  const { data: link, error: dbError } = await supabase
    .from('client_links')
    .insert({
      user_id: user.id,
      client_name: clientName,
      daily_room_name: roomName,
      room_url: room.url,
      calls_remaining: callsAllotment,
      minutes_remaining: minutesAllotment
    })
    .select()
    .single();

  if (dbError) {
    console.error('Failed to save client link:', dbError.message);
    return NextResponse.json({ error: 'Room created but could not be saved' }, { status: 500 });
  }

  return NextResponse.json({ link });
}
