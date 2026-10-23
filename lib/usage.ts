import { createAdminClient } from '@/lib/supabase-admin';

export const STARTER_MONTHLY_MINUTES = 200;
// A call that is already running when the monthly minutes run out is allowed to
// finish. The room's expiry is set to the minutes left plus this grace window.
export const STARTER_GRACE_MINUTES = 10;

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

type CallRecord = {
  id: string;
  daily_room_name: string | null;
  duration_seconds: number | null;
  created_at: string;
};

// Sums this month's call time for one professional, in seconds.
// Call length comes from Daily's meetings API. Once a call has clearly ended,
// its length is saved on the call row so it is only looked up once.
export async function getSecondsUsedThisMonth(userId: string): Promise<number> {
  const admin = createAdminClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await admin
    .from('calls')
    .select('id, daily_room_name, duration_seconds, created_at')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  if (error || !data) {
    console.error('Usage lookup failed:', error?.message);
    return 0;
  }

  const rows = data as CallRecord[];
  let total = 0;
  const pending: CallRecord[] = [];

  for (const row of rows) {
    if (row.duration_seconds !== null) {
      total += row.duration_seconds;
    } else if (row.daily_room_name) {
      pending.push(row);
    }
  }

  const looked = await Promise.all(pending.map(async (row) => {
    try {
      const res = await fetch(
        'https://api.daily.co/v1/meetings?room=' + encodeURIComponent(row.daily_room_name!),
        { headers: { Authorization: 'Bearer ' + process.env.DAILY_API_KEY } }
      );
      if (!res.ok) return { row, seconds: 0, final: false };

      const body = await res.json();
      const meetings: Array<{ duration?: number; ongoing?: boolean }> = Array.isArray(body?.data) ? body.data : [];
      const seconds = meetings.reduce((sum, m) => sum + (typeof m.duration === 'number' ? m.duration : 0), 0);
      const ongoing = meetings.some((m) => m.ongoing === true);
      // The room expires within six hours of creation, so after that nothing
      // more can be added. Before that, a finished meeting is also final.
      const roomOver = Date.now() - new Date(row.created_at).getTime() > SIX_HOURS_MS;
      const final = !ongoing && (roomOver || meetings.length > 0);
      return { row, seconds, final };
    } catch (err) {
      console.error('Daily meetings lookup failed:', err);
      return { row, seconds: 0, final: false };
    }
  }));

  for (const { row, seconds, final } of looked) {
    total += seconds;
    if (final) {
      await admin.from('calls').update({ duration_seconds: seconds }).eq('id', row.id);
    }
  }

  return total;
}
