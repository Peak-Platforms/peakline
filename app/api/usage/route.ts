import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getSecondsUsedThisMonth, STARTER_MONTHLY_MINUTES } from '@/lib/usage';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const seconds = await getSecondsUsedThisMonth(user.id);
  return NextResponse.json({
    minutesUsed: Math.ceil(seconds / 60),
    minutesLimit: STARTER_MONTHLY_MINUTES,
  });
}
