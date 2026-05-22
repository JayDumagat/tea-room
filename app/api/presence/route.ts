import { NextResponse } from "next/server";

type AvatarKey = "mint" | "sunset" | "violet";
type ActionState = "stand" | "sit" | "lay";

type Position = {
  x: number;
  z: number;
};

type Presence = {
  id: string;
  name: string;
  avatar: AvatarKey;
  action: ActionState;
  message: string;
  position: Position;
  updatedAt: number;
};

const PRESENCE_TTL_MS = 12000;
const ROOM_LIMIT = 12;

declare global {
  var teaRoomPresence: Map<string, Map<string, Presence>> | undefined;
}

const roomStore = globalThis.teaRoomPresence ?? new Map<string, Map<string, Presence>>();
globalThis.teaRoomPresence = roomStore;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeRoom(value: unknown) {
  if (typeof value !== "string") {
    return "main";
  }

  const trimmed = value.trim().slice(0, 64);
  return trimmed || "main";
}

function normalizePresence(value: unknown): Presence | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<Presence>;
  const avatar = candidate.avatar === "sunset" || candidate.avatar === "violet" ? candidate.avatar : "mint";
  const action =
    candidate.action === "sit" || candidate.action === "lay" || candidate.action === "stand"
      ? candidate.action
      : "stand";

  if (typeof candidate.id !== "string" || !candidate.id.trim()) {
    return null;
  }

  return {
    id: candidate.id.trim().slice(0, 100),
    name: typeof candidate.name === "string" ? candidate.name.trim().slice(0, 24) || "Guest" : "Guest",
    avatar,
    action,
    message: typeof candidate.message === "string" ? candidate.message.trim().slice(0, 80) : "",
    position: {
      x: clamp(Number(candidate.position?.x) || 0, -ROOM_LIMIT, ROOM_LIMIT),
      z: clamp(Number(candidate.position?.z) || 0, -ROOM_LIMIT, ROOM_LIMIT),
    },
    updatedAt: Date.now(),
  };
}

function getRoom(room: string) {
  const existing = roomStore.get(room);

  if (existing) {
    return existing;
  }

  const created = new Map<string, Presence>();
  roomStore.set(room, created);
  return created;
}

function pruneRoom(room: Map<string, Presence>) {
  const now = Date.now();

  for (const [id, presence] of room.entries()) {
    if (now - presence.updatedAt > PRESENCE_TTL_MS) {
      room.delete(id);
    }
  }
}

function playersResponse(room: Map<string, Presence>) {
  return NextResponse.json({
    players: Array.from(room.values()),
  });
}

export async function GET(request: Request) {
  const roomName = normalizeRoom(new URL(request.url).searchParams.get("room"));
  const room = getRoom(roomName);
  pruneRoom(room);
  return playersResponse(room);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { room?: unknown; presence?: unknown }
    | null;

  if (!payload) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roomName = normalizeRoom(payload.room);
  const presence = normalizePresence(payload.presence);

  if (!presence) {
    return NextResponse.json({ error: "Invalid presence payload." }, { status: 400 });
  }

  const room = getRoom(roomName);
  pruneRoom(room);
  room.set(presence.id, presence);
  return playersResponse(room);
}

export async function DELETE(request: Request) {
  const payload = (await request.json().catch(() => null)) as { room?: unknown; id?: unknown } | null;

  if (!payload || typeof payload.id !== "string") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roomName = normalizeRoom(payload.room);
  const room = getRoom(roomName);
  pruneRoom(room);
  room.delete(payload.id.trim());
  return playersResponse(room);
}
