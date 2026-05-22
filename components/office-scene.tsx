"use client";

import { Html } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import styles from "./virtual-office.module.css";

type AvatarKey = "mint" | "sunset" | "violet";

type Position = {
  x: number;
  z: number;
};

type Presence = {
  id: string;
  name: string;
  avatar: AvatarKey;
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
      <mesh receiveShadow position={[0, 2, -5.85]}>
        <boxGeometry args={[12, 2.8, 0.3]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh receiveShadow position={[0, 2, 5.85]}>
        <boxGeometry args={[12, 2.8, 0.3]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh receiveShadow position={[-5.85, 2, 0]}>
        <boxGeometry args={[0.3, 2.8, 12]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh receiveShadow position={[5.85, 2, 0]}>
        <boxGeometry args={[0.3, 2.8, 12]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      <Desk position={[-2.5, 0, -2.4]} />
      <Desk position={[2.5, 0, -2.4]} />
      <Desk position={[-2.5, 0, 2.4]} />
      <Desk position={[2.5, 0, 2.4]} />

      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[2.2, 0.18, 1.2]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.24, 0]}>
        <boxGeometry args={[2.5, 0.18, 1.5]} />
        <meshStandardMaterial color="#134e4a" />
      </mesh>

      <Plant position={[-4.5, 0, -4.3]} />
      <Plant position={[4.5, 0, 4.3]} />
      <Plant position={[4.5, 0, -4.3]} />
    </group>
  );
}

export default function OfficeScene({
  players,
  localId,
  localPosition,
}: {
  players: Presence[];
  localId: string;
  localPosition: Position;
}) {
  return (
    <Canvas camera={{ position: [0, 8.5, 7.5], fov: 42 }} shadows>
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
          <planeGeometry args={[16, 12]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
        </mesh>
        <mesh receiveShadow position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6.8, 4.4]} />
          <meshStandardMaterial color="#e0f2fe" />
        </mesh>
        <OfficeFurniture />

        {players.map((player) => {
          const avatar = AVATARS.find(({ id }) => id === player.avatar) ?? AVATARS[0];
          const isLocal = player.id === localId;
          const isNearby = distanceBetween(localPosition, player.position) <= CHAT_RADIUS;

          return (
            <group key={player.id} position={[player.position.x, 0, player.position.z]}>
              <mesh castShadow position={[0, 0.75, 0]}>
                <capsuleGeometry args={[0.28, 0.5, 8, 16]} />
                <meshStandardMaterial color={avatar.primary} />
              </mesh>
              <mesh castShadow position={[0, 1.5, 0]}>
                <sphereGeometry args={[0.24, 32, 32]} />
                <meshStandardMaterial color={avatar.secondary} />
              </mesh>
              <mesh castShadow position={[0, 0.95, 0.28]}>
                <boxGeometry args={[0.15, 0.15, 0.15]} />
                <meshStandardMaterial color={avatar.accent} />
              </mesh>
              {isLocal ? (
                <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.38, 0.5, 40]} />
                  <meshBasicMaterial color="#f8fafc" transparent opacity={0.9} />
                </mesh>
              ) : null}
              <Html center position={[0, 2.1, 0]}>
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
