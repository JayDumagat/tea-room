"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import styles from "./virtual-office.module.css";

type AvatarKey = "mint" | "sunset" | "violet";
type ActionState = "stand" | "sit" | "lay" | "wave";

type Position = {
  x: number;
  z: number;
};

type Presence = {
  id: string;
  name: string;
  avatar: AvatarKey;
  action?: ActionState;
  message: string;
  position: Position;
};

type AvatarStyle = {
  id: AvatarKey;
  primary: string;
  secondary: string;
  accent: string;
};

const AVATARS: AvatarStyle[] = [
  {
    id: "mint",
    primary: "#34d399",
    secondary: "#ecfeff",
    accent: "#064e3b",
  },
  {
    id: "sunset",
    primary: "#fb7185",
    secondary: "#fff7ed",
    accent: "#881337",
  },
  {
    id: "violet",
    primary: "#8b5cf6",
    secondary: "#eef2ff",
    accent: "#312e81",
  },
];

const CHAT_RADIUS = 3.3;
const CAMERA_DEAD_ZONE_X = 3.8;
const CAMERA_DEAD_ZONE_Z = 2.6;
// Tuned alongside local movement speed for responsive follow without jitter.
const CAMERA_FOLLOW_SPEED = 5.6;
const CAMERA_RESPAWN_THRESHOLD = 3.5;
const CAMERA_BOUNDARY_OFFSET = 1.2;
const CAMERA_HEIGHT = 8.5;
const CAMERA_Z_OFFSET = 7.5;
const HEAD_BOB_FREQUENCY = 3;
const HEAD_BOB_STRENGTH = 0.015;
const HEAD_WAVE_LOOK_FREQUENCY = 4;
const HEAD_WAVE_LOOK_STRENGTH = 0.3;
const WAVE_ARM_BASE_ROTATION = 0.9;
const WAVE_ARM_SWING_FREQUENCY = 11;
const WAVE_ARM_SWING_STRENGTH = 0.45;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function distanceBetween(first: Position, second: Position) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function Desk({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[2.2, 0.16, 1.1]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {[-0.9, 0.9].flatMap((x) =>
        [-0.4, 0.4].map((z) => (
          <mesh key={`${x}-${z}`} castShadow position={[x, 0.2, z]}>
            <boxGeometry args={[0.1, 0.4, 0.1]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        )),
      )}
      <mesh castShadow position={[0, 0.62, 0]}>
        <boxGeometry args={[0.8, 0.45, 0.05]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh castShadow position={[0, 0.22, 0.9]}>
        <boxGeometry args={[0.8, 0.35, 0.8]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.35, 20]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      <mesh castShadow position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
    </group>
  );
}

function OfficeFurniture() {
  return (
    <group>
      <mesh receiveShadow position={[0, 2, -10.2]}>
        <boxGeometry args={[26, 2.8, 0.3]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh receiveShadow position={[0, 2, 10.2]}>
        <boxGeometry args={[26, 2.8, 0.3]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh receiveShadow position={[-13.2, 2, 0]}>
        <boxGeometry args={[0.3, 2.8, 20.4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh receiveShadow position={[13.2, 2, 0]}>
        <boxGeometry args={[0.3, 2.8, 20.4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      <Desk position={[-7, 0, -3.6]} />
      <Desk position={[-2.4, 0, -3.6]} />
      <Desk position={[2.4, 0, -3.6]} />
      <Desk position={[7, 0, -3.6]} />
      <Desk position={[-7, 0, 3.6]} />
      <Desk position={[-2.4, 0, 3.6]} />
      <Desk position={[2.4, 0, 3.6]} />
      <Desk position={[7, 0, 3.6]} />

      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[3.2, 0.18, 1.4]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.24, 0]}>
        <boxGeometry args={[3.6, 0.18, 1.8]} />
        <meshStandardMaterial color="#134e4a" />
      </mesh>

      <Plant position={[-11, 0, -8]} />
      <Plant position={[11, 0, -8]} />
      <Plant position={[-11, 0, 8]} />
      <Plant position={[11, 0, 8]} />
    </group>
  );
}

function FollowCamera({ localPosition, roomLimit }: { localPosition: Position; roomLimit: number }) {
  const focusRef = useRef<Position>({ x: localPosition.x, z: localPosition.z });
  const previousLocalRef = useRef<Position>(localPosition);

  useEffect(() => {
    const previous = previousLocalRef.current;
    if (distanceBetween(previous, localPosition) > CAMERA_RESPAWN_THRESHOLD) {
      focusRef.current = { x: localPosition.x, z: localPosition.z };
    }
    previousLocalRef.current = localPosition;
  }, [localPosition]);

  useFrame(({ camera }, delta) => {
    const focus = focusRef.current;
    const deltaX = localPosition.x - focus.x;
    const deltaZ = localPosition.z - focus.z;

    if (Math.abs(deltaX) > CAMERA_DEAD_ZONE_X) {
      focus.x = localPosition.x - Math.sign(deltaX) * CAMERA_DEAD_ZONE_X;
    }

    if (Math.abs(deltaZ) > CAMERA_DEAD_ZONE_Z) {
      focus.z = localPosition.z - Math.sign(deltaZ) * CAMERA_DEAD_ZONE_Z;
    }

    focus.x = clamp(focus.x, -roomLimit + CAMERA_BOUNDARY_OFFSET, roomLimit - CAMERA_BOUNDARY_OFFSET);
    focus.z = clamp(focus.z, -roomLimit + CAMERA_BOUNDARY_OFFSET, roomLimit - CAMERA_BOUNDARY_OFFSET);

    const easing = Math.min(1, delta * CAMERA_FOLLOW_SPEED);
    camera.position.x += (focus.x - camera.position.x) * easing;
    camera.position.y += (CAMERA_HEIGHT - camera.position.y) * easing;
    camera.position.z += (focus.z + CAMERA_Z_OFFSET - camera.position.z) * easing;
    camera.lookAt(focus.x, 0, focus.z);
  });

  return null;
}

function AnimalCoworker({
  avatar,
  isLocal,
  isNearby,
  player,
}: {
  avatar: AvatarStyle;
  isLocal: boolean;
  isNearby: boolean;
  player: Presence;
}) {
  const rightArmRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const action = player.action ?? "stand";
  const isLaying = action === "lay";
  const isSitting = action === "sit";
  const isWaving = action === "wave";
  const bodyY = isLaying ? 0.46 : isSitting ? 0.62 : 0.78;
  const bodyScaleY = isLaying ? 0.5 : isSitting ? 0.72 : 1;
  const headY = isLaying ? 0.55 : isSitting ? 1.08 : 1.52;
  const legY = isLaying ? 0.24 : 0.42;
  const uiHeight = isLaying ? 1.46 : 2.25;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const bob = isLaying ? 0 : Math.sin(t * HEAD_BOB_FREQUENCY) * HEAD_BOB_STRENGTH;

    if (headRef.current) {
      headRef.current.position.y = headY + bob;
      headRef.current.rotation.y = isWaving
        ? Math.sin(t * HEAD_WAVE_LOOK_FREQUENCY) * HEAD_WAVE_LOOK_STRENGTH
        : 0;
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = isWaving
        ? WAVE_ARM_BASE_ROTATION + Math.sin(t * WAVE_ARM_SWING_FREQUENCY) * WAVE_ARM_SWING_STRENGTH
        : isLaying
          ? 0.4
          : 0.08;
      rightArmRef.current.rotation.x = isWaving ? -0.4 : 0;
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = isLaying ? -0.35 : -0.08;
      leftArmRef.current.rotation.x = 0;
    }
  });

  return (
    <group position={[player.position.x, 0, player.position.z]}>
      <group rotation={[0, 0, isLaying ? Math.PI / 2 : 0]}>
        <mesh castShadow position={[0, bodyY, 0]} scale={[1, bodyScaleY, 1]}>
          <capsuleGeometry args={[0.3, 0.58, 10, 24]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.18} />
        </mesh>
        <mesh castShadow position={[0, bodyY + 0.1, 0.22]} scale={[1, bodyScaleY, 1]}>
          <capsuleGeometry args={[0.24, 0.4, 8, 20]} />
          <meshStandardMaterial color={avatar.primary} roughness={0.62} />
        </mesh>

        <group ref={headRef}>
          <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[0.25, 34, 34]} />
            <meshStandardMaterial color={avatar.secondary} />
          </mesh>
          <mesh castShadow position={[-0.12, 0.2, -0.04]} rotation={[0.1, 0.2, 0.25]}>
            <coneGeometry args={[0.07, 0.2, 14]} />
            <meshStandardMaterial color={avatar.secondary} />
          </mesh>
          <mesh castShadow position={[0.12, 0.2, -0.04]} rotation={[0.1, -0.2, -0.25]}>
            <coneGeometry args={[0.07, 0.2, 14]} />
            <meshStandardMaterial color={avatar.secondary} />
          </mesh>
          <mesh castShadow position={[0, -0.04, 0.2]} scale={[1, 0.8, 1]}>
            <sphereGeometry args={[0.11, 18, 18]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <mesh castShadow position={[-0.08, 0.03, 0.18]}>
            <sphereGeometry args={[0.02, 10, 10]} />
            <meshStandardMaterial color={avatar.accent} />
          </mesh>
          <mesh castShadow position={[0.08, 0.03, 0.18]}>
            <sphereGeometry args={[0.02, 10, 10]} />
            <meshStandardMaterial color={avatar.accent} />
          </mesh>
        </group>

        <group ref={leftArmRef} position={[-0.34, bodyY + 0.16, 0.02]}>
          <mesh castShadow position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.07, 0.28, 8, 12]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh castShadow position={[0, -0.43, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={avatar.secondary} />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.34, bodyY + 0.16, 0.02]}>
          <mesh castShadow position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.07, 0.28, 8, 12]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh castShadow position={[0, -0.43, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={avatar.secondary} />
          </mesh>
        </group>

        <mesh castShadow position={[-0.15, legY, 0]}>
          <capsuleGeometry args={[0.09, 0.26, 8, 12]} />
          <meshStandardMaterial color="#020617" />
        </mesh>
        <mesh castShadow position={[0.15, legY, 0]}>
          <capsuleGeometry args={[0.09, 0.26, 8, 12]} />
          <meshStandardMaterial color="#020617" />
        </mesh>
        <mesh castShadow position={[0, bodyY + 0.1, 0.29]}>
          <boxGeometry args={[0.06, 0.35, 0.04]} />
          <meshStandardMaterial color="#f43f5e" emissive="#3f0918" />
        </mesh>
      </group>
      {isLocal ? (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.5, 40]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.9} />
        </mesh>
      ) : null}
      <Html center position={[0, uiHeight, 0]}>
        <div className={styles.avatarUi}>
          <div className={styles.namePlate}>
            {player.name}
            {isLocal ? " (you)" : ""}
          </div>
          {player.message && isNearby ? <div className={styles.chatBubble}>{player.message}</div> : null}
        </div>
      </Html>
    </group>
  );
}

export default function OfficeScene({
  players,
  localId,
  localPosition,
  roomLimit,
}: {
  players: Presence[];
  localId: string;
  localPosition: Position;
  roomLimit: number;
}) {
  return (
    <Canvas camera={{ position: [0, CAMERA_HEIGHT, CAMERA_Z_OFFSET], fov: 42 }} shadows>
      <FollowCamera localPosition={localPosition} roomLimit={roomLimit} />
      <color attach="background" args={["#0f172a"]} />
      <ambientLight intensity={1.4} />
      <directionalLight
        castShadow
        intensity={1.6}
        position={[5, 9, 3]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <fog attach="fog" args={["#0f172a", 10, 18]} />

      <group>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[28, 22]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
        </mesh>
        <mesh receiveShadow position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.5, 5.5]} />
          <meshStandardMaterial color="#e0f2fe" />
        </mesh>
        <OfficeFurniture />

        {players.map((player) => {
          const avatar = AVATARS.find(({ id }) => id === player.avatar) ?? AVATARS[0];
          return (
            <AnimalCoworker
              key={player.id}
              avatar={avatar}
              isLocal={player.id === localId}
              isNearby={distanceBetween(localPosition, player.position) <= CHAT_RADIUS}
              player={player}
            />
          );
        })}
      </group>
    </Canvas>
  );
}
