// Shared helpers for the Director "Invite guest" feature.
// Everything here runs on the server only. The Daily API key never reaches a browser.

import { NextResponse } from 'next/server';

export const MAX_GUESTS = Number(process.env.DIRECTOR_MAX_GUESTS || 3);
export const GUEST_LINK_HOURS = 2;
export const GUEST_ROOM_PREFIX = 'g-';

const DAILY = 'https://api.daily.co/v1';

// The Supabase project the Director signs in against (public address, same as director.html).
const DIRECTOR_SUPABASE_URL =
  process.env.DIRECTOR_SUPABASE_URL || 'https://hvqzrdlbtfezwuveincs.supabase.co';

export const RTMP_INGEST_BASE = process.env.RTMP_INGEST_BASE || 'rtmp://live.xsen.fun:1935/live';
export const GUEST_BASE_URL = process.env.GUEST_BASE_URL || 'https://app.getpeaklink.com';

// ---------- CORS (director.html lives on a different address than this server) ----------

export function corsHeaders(req: Request): Record<string, string> {
  const allowed = (process.env.DIRECTOR_ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const origin = req.headers.get('origin') || '';
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function preflight(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export function json(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

// ---------- Station sign-in: same check the Director itself uses ----------

export async function verifyStation(school: string, password: string): Promise<boolean> {
  const key = process.env.DIRECTOR_SUPABASE_ANON_KEY;
  if (!key || !school || !password) return false;
  try {
    const r = await fetch(`${DIRECTOR_SUPABASE_URL}/rest/v1/rpc/director_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_school: school.toUpperCase(), p_password: password }),
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return !!j && !j.error;
  } catch {
    return false;
  }
}

// Parse and sanity-check the fields every route needs.
export function cleanSchool(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return /^[a-z0-9]{1,32}$/.test(s) ? s : null;
}

// ---------- Daily helpers ----------

export function dailyHeaders() {
  return {
    Authorization: 'Bearer ' + process.env.DAILY_API_KEY,
    'Content-Type': 'application/json',
  };
}

export async function dailyGet(path: string) {
  return fetch(DAILY + path, { headers: dailyHeaders() });
}

export async function dailyPost(path: string, body?: unknown) {
  return fetch(DAILY + path, {
    method: 'POST',
    headers: dailyHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function dailyDelete(path: string) {
  return fetch(DAILY + path, { method: 'DELETE', headers: dailyHeaders() });
}

// Room names look like  g-<station>-<random>   e.g. g-demolink-k7q2x9
export function parseGuestRoom(room: unknown, school: string): { suffix: string } | null {
  if (typeof room !== 'string') return null;
  const prefix = `${GUEST_ROOM_PREFIX}${school}-`;
  if (!room.startsWith(prefix)) return null;
  const suffix = room.slice(prefix.length);
  return /^[a-z0-9]{4,16}$/.test(suffix) ? { suffix } : null;
}

export function streamKeyFor(school: string, suffix: string) {
  return `${school}_src_${suffix}`;
}

// How many guest rooms this station has open right now.
export async function countActiveGuests(school: string): Promise<number> {
  const r = await dailyGet('/rooms?limit=100');
  if (!r.ok) return 0;
  const body = await r.json().catch(() => ({}));
  const now = Math.floor(Date.now() / 1000);
  const prefix = `${GUEST_ROOM_PREFIX}${school}-`;
  return (body.data || []).filter(
    (room: any) => room.name?.startsWith(prefix) && (!room.config?.exp || room.config.exp > now)
  ).length;
}

// Used by the guest call page: is this a live guest room, and what is its Daily address?
export async function getGuestRoomUrl(roomId: string): Promise<string | null> {
  if (!roomId.startsWith(GUEST_ROOM_PREFIX) || !/^[a-z0-9-]{1,64}$/.test(roomId)) return null;
  const r = await dailyGet(`/rooms/${roomId}`);
  if (!r.ok) return null;
  const room = await r.json().catch(() => null);
  return room?.url || null;
}
