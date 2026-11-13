import { createAdminClient } from '@/lib/supabase-admin';

// Server-side helpers for Peak Link Groups (standing multi-person rooms).
// Never import this into anything that runs in the browser.

// Each person's pass into a group room lasts this long, then they are disconnected.
// Same six-hour ceiling the 1:1 rooms use.
export const GROUP_SESSION_HOURS = 6;
const GROUP_NAME_MAX = 60;
const PERSON_NAME_MAX = 40;

const DAILY_API = 'https://api.daily.co/v1';
const DEFAULT_ACCENT = '#F2A93B';

export type GroupPlan = { maxRooms: number; maxParticipants: number };

export type GroupRoom = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  daily_room_name: string;
  room_url: string;
  max_participants: number;
  created_at: string;
};

function dailyHeaders() {
  return {
    Authorization: 'Bearer ' + process.env.DAILY_API_KEY,
    'Content-Type': 'application/json',
  };
}

export function cleanGroupName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, ' ').trim().slice(0, GROUP_NAME_MAX);
}

export function cleanPersonName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, ' ').trim().slice(0, PERSON_NAME_MAX);
}

// "Acme Dental" -> "acme-dental-x7k2q9". The random ending keeps a standing
// link from being guessed from the business name.
export function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20)
    .replace(/-+$/g, '');
  const random = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return (base ? base + '-' : '') + random;
}

// Returns the account's Groups limits, or null if Groups is not turned on for it.
export async function getGroupPlan(userId: string): Promise<GroupPlan | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('group_plans')
    .select('max_rooms, max_participants')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return { maxRooms: data.max_rooms, maxParticipants: data.max_participants };
}

export async function getGroupRoom(slug: string): Promise<GroupRoom | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('group_rooms').select('*').eq('slug', slug).maybeSingle();
  return (data as GroupRoom) || null;
}

export async function getBranding(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, business_name, accent_color, photo_url, show_branding')
    .eq('id', userId)
    .maybeSingle();

  return {
    displayName: (profile?.display_name as string) || null,
    businessName: (profile?.business_name as string) || null,
    accentColor: (profile?.accent_color as string) || DEFAULT_ACCENT,
    photoUrl: (profile?.photo_url as string) || null,
    showBranding: (profile?.show_branding as boolean) ?? true,
  };
}

// Creates the standing Daily room. It is private: nobody gets in without a pass
// (meeting token) from our own server, so the raw Daily address is useless on its own.
// It has no expiry, which is what makes the link permanent.
export async function createDailyGroupRoom(roomName: string, maxParticipants: number) {
  const res = await fetch(DAILY_API + '/rooms', {
    method: 'POST',
    headers: dailyHeaders(),
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        max_participants: maxParticipants,
        enable_screenshare: true,
        // Always route through Daily's servers, never peer-to-peer. The meeting
        // screen only downloads video for the people on screen, and Daily can
        // only do that in this mode. (0.5 is Daily's own default; set here so a
        // domain-wide change made for the 1:1 rooms can't affect group rooms.)
        sfu_switchover: 0.5,
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Daily API error (group room):', res.status, JSON.stringify(body));
    return { ok: false as const, error: (body.info || body.error || 'Could not create room') as string };
  }
  return { ok: true as const, url: body.url as string };
}

export async function deleteDailyRoom(roomName: string): Promise<boolean> {
  const res = await fetch(DAILY_API + '/rooms/' + encodeURIComponent(roomName), {
    method: 'DELETE',
    headers: dailyHeaders(),
  });
  // 404 means it is already gone, which is the result we wanted.
  return res.ok || res.status === 404;
}

// How many people are in the room right now, or null if Daily could not be asked.
export async function getHeadcount(roomName: string): Promise<number | null> {
  try {
    const res = await fetch(DAILY_API + '/rooms/' + encodeURIComponent(roomName) + '/presence', {
      headers: dailyHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.total_count === 'number' ? body.total_count : null;
  } catch (err) {
    console.error('Daily presence lookup failed:', err);
    return null;
  }
}

// A pass into one room for one person. Hosts get owner rights (mute, remove, end).
export async function createGroupToken(opts: {
  roomName: string;
  userName: string;
  isHost: boolean;
  hostUserId?: string;
}): Promise<string | null> {
  const seconds = GROUP_SESSION_HOURS * 60 * 60;
  const res = await fetch(DAILY_API + '/meeting-tokens', {
    method: 'POST',
    headers: dailyHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        is_owner: opts.isHost,
        user_name: opts.userName,
        ...(opts.isHost && opts.hostUserId ? { user_id: opts.hostUserId } : {}),
        exp: Math.round(Date.now() / 1000) + seconds,
        // Nobody stays connected past the session ceiling, so a tab left open
        // overnight cannot keep the room (and the bill) running.
        eject_after_elapsed: seconds,
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.token !== 'string') {
    console.error('Daily API error (meeting token):', res.status, JSON.stringify(body));
    return null;
  }
  return body.token;
}
