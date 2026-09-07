import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const BASIC_MONTHLY_LIMIT = 10;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { clientName } = await req.json();
  if (!clientName || typeof clientName !== 'string') {
    return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
  }

  // Check tier and this month's usage before creating anything
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier || 'basic';

  if (tier === 'basic') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    if ((count || 0) >= BASIC_MONTHLY_LIMIT) {
      return NextResponse.json(
        { error: 'limit_reached', message: `You've used all ${BASIC_MONTHLY_LIMIT} calls this month.` },
        { status: 402 }
      );
    }
  }

  const roomName = 'call-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.DAILY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        exp: Math.round(Date.now() / 1000) + 60 * 60 * 6,
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

  // Log the call under this professional only — RLS ensures they only ever see their own
  const { error: dbError } = await supabase.from('calls').insert({
    user_id: user.id,
    client_name: clientName,
    room_url: room.url
  });

  if (dbError) {
    // Room was created successfully even if logging failed — still return the link
    console.error('Failed to log call:', dbError.message);
  }

  return NextResponse.json({ url: room.url });
}
