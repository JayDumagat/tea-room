"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useMemo, useEffect, useRef, useState } from "react";
import styles from "./virtual-office.module.css";

type AvatarKey = "mint" | "sunset" | "violet";
type ActionState = "stand" | "sit" | "lay";

type Position = {
  x: number;
  z: number;
};

type Profile = {
  name: string;
  avatar: AvatarKey;
};

type Presence = Profile & {
  id: string;
  action?: ActionState;
  message: string;
  position: Position;
};

type AvatarStyle = {
  id: AvatarKey;
  label: string;
  primary: string;
  secondary: string;
};

const OfficeScene = dynamic(() => import("@/components/office-scene"), {
  ssr: false,
  loading: () => <div className={styles.sceneLoading}>Loading 3D office...</div>,
});

const AVATARS: AvatarStyle[] = [
  {
    id: "mint",
    label: "Mint",
    primary: "#34d399",
    secondary: "#ecfeff",
  },
  {
    id: "sunset",
    label: "Sunset",
    primary: "#fb7185",
    secondary: "#fff7ed",
  },
  {
    id: "violet",
    label: "Violet",
    primary: "#8b5cf6",
    secondary: "#eef2ff",
  },
];

const PROFILE_KEY = "tea-room-profile";
const SESSION_KEY = "tea-room-session";
const ROOM_ID = "main";
const PRESENCE_API_PATH = "/api/presence";
const CHAT_RADIUS = 3.3;
const HEARTBEAT_MS = 350;
const MOVE_SPEED = 2.8;
const ROOM_LIMIT = 12;
const SPAWN_POINTS: Position[] = [
  { x: -9, z: 6 },
  { x: 9, z: 6 },
  { x: -9, z: -6 },
  { x: 9, z: -6 },
  { x: 0, z: 0 },
];
const ACTIONS: { id: ActionState; label: string }[] = [
  { id: "stand", label: "Stand" },
  { id: "sit", label: "Sit" },
  { id: "lay", label: "Lay down" },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function distanceBetween(first: Position, second: Position) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function hashString(value: string) {
  return value.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}

function getSpawnPoint(seed: string) {
  return SPAWN_POINTS[hashString(seed) % SPAWN_POINTS.length];
}

function getStoredProfile() {
  if (typeof window === "undefined") {
    return {
      name: "",
      avatar: AVATARS[0].id,
    } satisfies Profile;
  }

  const stored = window.localStorage.getItem(PROFILE_KEY);

  if (!stored) {
    return {
      name: "",
      avatar: AVATARS[0].id,
    } satisfies Profile;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<Profile>;

    return {
      name: parsed.name ?? "",
      avatar: parsed.avatar ?? AVATARS[0].id,
    } satisfies Profile;
  } catch {
    window.localStorage.removeItem(PROFILE_KEY);
    return {
      name: "",
      avatar: AVATARS[0].id,
    } satisfies Profile;
  }
}

function getSessionId() {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const existingSessionId = window.sessionStorage.getItem(SESSION_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = window.crypto?.randomUUID() ?? `session-${window.performance.now().toString(36)}`;
  window.sessionStorage.setItem(SESSION_KEY, nextSessionId);
  return nextSessionId;
}

export default function VirtualOffice() {
  const [sessionId] = useState(getSessionId);
  const initialProfile = useMemo(() => getStoredProfile(), []);
  const [draftName, setDraftName] = useState(initialProfile.name);
  const [draftAvatar, setDraftAvatar] = useState<AvatarKey>(initialProfile.avatar);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [position, setPosition] = useState<Position>(() => getSpawnPoint(sessionId));
  const [action, setAction] = useState<ActionState>("stand");
  const [messageInput, setMessageInput] = useState("");
  const [message, setMessage] = useState("");
  const [peers, setPeers] = useState<Presence[]>([]);
  const pressedKeys = useRef(new Set<string>());
  const heartbeatRef = useRef<{
    profile: Profile | null;
    position: Position;
    message: string;
    action: ActionState;
  }>({
    profile: null,
    position,
    message,
    action,
  });
  const clearMessageTimeoutRef = useRef<number | null>(null);

  const refreshPeers = useCallback(() => {
    void (async () => {
      try {
        const search = new URLSearchParams({ room: ROOM_ID });
        const response = await fetch(`${PRESENCE_API_PATH}?${search.toString()}`, { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { players: Presence[] };
        setPeers(payload.players.filter((presence) => presence.id !== sessionId));
      } catch {}
    })();
  }, [sessionId]);

  const updatePresence = useCallback(
    (nextProfile: Profile, nextPosition: Position, nextMessage: string, nextAction: ActionState) => {
      void (async () => {
        try {
          const response = await fetch(PRESENCE_API_PATH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              room: ROOM_ID,
              presence: {
                id: sessionId,
                name: nextProfile.name,
                avatar: nextProfile.avatar,
                message: nextMessage,
                action: nextAction,
                position: nextPosition,
              },
            }),
          });

          if (!response.ok) {
            return;
          }

          const payload = (await response.json()) as { players: Presence[] };
          setPeers(payload.players.filter((presence) => presence.id !== sessionId));
        } catch {}
      })();
    },
    [sessionId],
  );

  const removePresence = useCallback(() => {
    void (async () => {
      try {
        const response = await fetch(PRESENCE_API_PATH, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: ROOM_ID, id: sessionId }),
          keepalive: true,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { players: Presence[] };
        setPeers(payload.players.filter((presence) => presence.id !== sessionId));
      } catch {}
    })();
  }, [sessionId]);

  useEffect(() => {
    heartbeatRef.current = { profile, position, message, action };
  }, [action, message, position, profile]);

  useEffect(() => {
    refreshPeers();
    const interval = window.setInterval(refreshPeers, HEARTBEAT_MS * 2);

    return () => {
      window.clearInterval(interval);
      setPeers([]);
    };
  }, [refreshPeers]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const tick = () => {
      const latest = heartbeatRef.current;

      if (latest.profile) {
        updatePresence(latest.profile, latest.position, latest.message, latest.action);
      }
    };

    tick();
    const interval = window.setInterval(tick, HEARTBEAT_MS);
    const handleBeforeUnload = () => {
      removePresence();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      removePresence();
    };
  }, [profile, removePresence, updatePresence]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const activeKeys = pressedKeys.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      if (event.key === "1" || event.key === "2" || event.key === "3") {
        const index = Number(event.key) - 1;
        const nextAction = ACTIONS[index]?.id;

        if (nextAction) {
          setAction(nextAction);
          updatePresence(profile, heartbeatRef.current.position, heartbeatRef.current.message, nextAction);
          event.preventDefault();
        }

        return;
      }

      if (!event.key.startsWith("Arrow")) {
        return;
      }

      activeKeys.add(event.key);
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.key.startsWith("Arrow")) {
        return;
      }

      activeKeys.delete(event.key);
    };

    let animationFrame = 0;
    let previous = performance.now();

    const update = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      let horizontal = 0;
      let vertical = 0;

      if (activeKeys.has("ArrowLeft")) {
        horizontal -= MOVE_SPEED * delta;
      }

      if (activeKeys.has("ArrowRight")) {
        horizontal += MOVE_SPEED * delta;
      }

      if (activeKeys.has("ArrowUp")) {
        vertical -= MOVE_SPEED * delta;
      }

      if (activeKeys.has("ArrowDown")) {
        vertical += MOVE_SPEED * delta;
      }

      if (horizontal !== 0 || vertical !== 0) {
        setPosition((currentPosition) => ({
          x: clamp(currentPosition.x + horizontal, -ROOM_LIMIT, ROOM_LIMIT),
          z: clamp(currentPosition.z + vertical, -ROOM_LIMIT, ROOM_LIMIT),
        }));
      }

      animationFrame = window.requestAnimationFrame(update);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    animationFrame = window.requestAnimationFrame(update);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.cancelAnimationFrame(animationFrame);
      activeKeys.clear();
    };
  }, [profile, updatePresence]);

  useEffect(() => {
    return () => {
      if (clearMessageTimeoutRef.current) {
        window.clearTimeout(clearMessageTimeoutRef.current);
      }
    };
  }, []);

  const localPresence = profile
    ? {
        id: sessionId,
        name: profile.name,
        avatar: profile.avatar,
        action,
        position,
        message,
      }
    : null;
  const everyone = localPresence ? [localPresence, ...peers] : peers;
  const nearbyPeers = peers.filter((peer) => distanceBetween(peer.position, position) <= CHAT_RADIUS);

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = draftName.trim().slice(0, 24);

    if (!trimmedName) {
      return;
    }

    const nextProfile = {
      name: trimmedName,
      avatar: draftAvatar,
    } satisfies Profile;
    const spawnPoint = getSpawnPoint(sessionId);

    setProfile(nextProfile);
    setPosition(spawnPoint);
    setAction("stand");
    setMessage("");
    setMessageInput("");
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    updatePresence(nextProfile, spawnPoint, "", "stand");
  };

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      return;
    }

    const trimmedMessage = messageInput.trim().slice(0, 80);

    if (!trimmedMessage) {
      return;
    }

    setMessage(trimmedMessage);
    setMessageInput("");
    updatePresence(profile, position, trimmedMessage, action);

    if (clearMessageTimeoutRef.current) {
      window.clearTimeout(clearMessageTimeoutRef.current);
    }

    clearMessageTimeoutRef.current = window.setTimeout(() => {
      setMessage("");
      updatePresence(profile, heartbeatRef.current.position, "", heartbeatRef.current.action);
    }, 8000);
  };

  const handleResetProfile = () => {
    removePresence();
    setProfile(null);
    setAction("stand");
    setMessage("");
    setMessageInput("");
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Tea Room</p>
          <h1>Virtual office for quick coworking chats</h1>
          <p>
            Join the room, pick a character, move with the arrow keys, switch poses, and share a short
            message. Chat bubbles only appear when avatars are close to each other.
          </p>
        </div>

        <form className={styles.card} onSubmit={handleJoin}>
          <label className={styles.field}>
            <span>Your name</span>
            <input
              maxLength={24}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Enter your display name"
              value={draftName}
            />
          </label>

          <div className={styles.avatarPicker}>
            <span>Choose your character</span>
            <div className={styles.avatarGrid}>
              {AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  className={`${styles.avatarCard} ${draftAvatar === avatar.id ? styles.avatarCardActive : ""}`}
                  onClick={() => setDraftAvatar(avatar.id)}
                  type="button"
                >
                  <span
                    aria-hidden
                    className={styles.avatarPreview}
                    style={{
                      background: `linear-gradient(180deg, ${avatar.secondary} 0%, ${avatar.primary} 60%)`,
                    }}
                  />
                  <strong>{avatar.label}</strong>
                </button>
              ))}
            </div>
          </div>

          <button className={styles.primaryButton} type="submit">
            {profile ? "Update presence" : "Enter the office"}
          </button>
        </form>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Room status</h2>
            {profile ? <button onClick={handleResetProfile}>Change profile</button> : null}
          </div>
          <ul className={styles.statsList}>
            <li>
              <span>Room sync</span>
              <strong>Next.js presence API</strong>
            </li>
            <li>
              <span>Nearby coworkers</span>
              <strong>{profile ? nearbyPeers.length : 0}</strong>
            </li>
            <li>
              <span>Total visitors in this room</span>
              <strong>{everyone.length}</strong>
            </li>
          </ul>
          <p className={styles.muted}>
            Tip: open this site in another browser or tab to test multiplayer presence.
          </p>
        </div>

        <form className={styles.card} onSubmit={handleSendMessage}>
          <div className={styles.cardHeader}>
            <h2>Send a chat bubble</h2>
            <span>{profile ? "Visible only when close" : "Join the office first"}</span>
          </div>
          <label className={styles.field}>
            <span>Message</span>
            <input
              disabled={!profile}
              maxLength={80}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder="Say hello to nearby teammates"
              value={messageInput}
            />
          </label>
          <button className={styles.secondaryButton} disabled={!profile} type="submit">
            Post bubble
          </button>
        </form>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Avatar action</h2>
            <span>{profile ? "1 = stand · 2 = sit · 3 = lay down" : "Join the office first"}</span>
          </div>
          <div className={styles.actionGrid}>
            {ACTIONS.map((nextAction) => (
              <button
                key={nextAction.id}
                className={`${styles.avatarCard} ${action === nextAction.id ? styles.avatarCardActive : ""}`}
                disabled={!profile}
                onClick={() => {
                  setAction(nextAction.id);
                  if (profile) {
                    updatePresence(profile, position, message, nextAction.id);
                  }
                }}
                type="button"
              >
                <strong>{nextAction.label}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sceneCard}>
        <div className={styles.sceneHeader}>
          <div>
            <h2>3D office</h2>
            <p>
              {profile
                ? "Use arrow keys to move around the larger office. Camera follows once you move past its focus range."
                : "Enter the office to begin."}
            </p>
          </div>
          <div className={styles.legend}>
            <span className={styles.legendDot} />
            <span>White ring marks your avatar</span>
          </div>
        </div>
        <div className={styles.sceneViewport}>
          <OfficeScene localId={sessionId} localPosition={position} players={everyone} roomLimit={ROOM_LIMIT} />
        </div>
      </section>
    </main>
  );
}
