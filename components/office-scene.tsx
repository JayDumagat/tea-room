"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import styles from "./virtual-office.module.css";

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
const CAMERA_DEAD_ZONE = 2.2;
const CAMERA_FOLLOW_SPEED = 5;
const CAMERA_RESPAWN_THRESHOLD = 3.5;
const CAMERA_BOUNDARY_OFFSET = 1.2;
const CAMERA_HEIGHT = 8.5;
const CAMERA_Z_OFFSET = 7.5;

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

    if (Math.abs(deltaX) > CAMERA_DEAD_ZONE) {
      focus.x = localPosition.x - Math.sign(deltaX) * CAMERA_DEAD_ZONE;
    }

    if (Math.abs(deltaZ) > CAMERA_DEAD_ZONE) {
      focus.z = localPosition.z - Math.sign(deltaZ) * CAMERA_DEAD_ZONE;
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
          const isLocal = player.id === localId;
          const isNearby = distanceBetween(localPosition, player.position) <= CHAT_RADIUS;
          const action = player.action ?? "stand";
          const bodyY = action === "stand" ? 0.75 : action === "sit" ? 0.54 : 0.35;
          const bodyScaleY = action === "stand" ? 1 : action === "sit" ? 0.62 : 0.45;
          const headY = action === "stand" ? 1.5 : action === "sit" ? 1.02 : 0.46;
          const rotationZ = action === "lay" ? Math.PI / 2 : 0;
          const uiHeight = action === "lay" ? 1.46 : 2.1;

          return (
            <group key={player.id} position={[player.position.x, 0, player.position.z]}>
              <group rotation={[0, 0, rotationZ]}>
                <mesh castShadow position={[0, bodyY, 0]} scale={[1, bodyScaleY, 1]}>
                  <capsuleGeometry args={[0.28, 0.5, 8, 16]} />
                  <meshStandardMaterial color={avatar.primary} />
                </mesh>
                <mesh castShadow position={[0, headY, 0]}>
                  <sphereGeometry args={[0.24, 32, 32]} />
                  <meshStandardMaterial color={avatar.secondary} />
                </mesh>
                <mesh castShadow position={[0, bodyY + 0.2, 0.28]}>
                  <boxGeometry args={[0.15, 0.15, 0.15]} />
                  <meshStandardMaterial color={avatar.accent} />
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
                  {player.message && isNearby ? (
                    <div className={styles.chatBubble}>{player.message}</div>
                  ) : null}
                </div>
              </Html>
            </group>
          );
        })}
      </group>
    </Canvas>
  );
}
