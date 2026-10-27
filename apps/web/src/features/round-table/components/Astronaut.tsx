"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Mood = "idle" | "answered" | "correct" | "wrong" | "out";

const ANTENNA: Record<Mood, string> = { idle: "#fbbf24", answered: "#34d399", correct: "#34d399", wrong: "#f87171", out: "#7c3aed" };

/**
 * Phi hành gia chibi (thiết kế riêng của dự án): bộ đồ tròn màu ghế, mũ kính trong thấy mặt cười,
 * ăng-ten đổi màu theo trạng thái, ba lô dưỡng khí có đèn. Mặt hướng về −z (giữa bàn).
 */
export function Astronaut({ color, mood }: { color: string; mood: Mood }) {
  const root = useRef<THREE.Group>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const head = useRef<THREE.Group>(null);
  const faded = mood === "out";
  const suit = { color, roughness: 0.55, transparent: faded, opacity: faded ? 0.35 : 1 };

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (bulb.current) bulb.current.emissiveIntensity = mood === "idle" ? 1 + Math.sin(t * 6) * 0.8 : 1.6; // nhấp nháy khi đang nghĩ
    if (head.current) {
      // Đang nghĩ: nghiêng đầu; đúng: gật gù; sai: lắc đầu
      head.current.rotation.z = mood === "idle" ? Math.sin(t * 1.3) * 0.08 : 0;
      head.current.rotation.x = mood === "correct" ? Math.sin(t * 8) * 0.08 : 0;
      head.current.rotation.y = mood === "wrong" ? Math.sin(t * 9) * 0.18 : 0;
    }
    if (root.current) root.current.position.y = mood === "correct" ? Math.abs(Math.sin(t * 5)) * 0.08 : 0;
  });

  return (
    <group ref={root}>
      {/* Thân: hơi bầu, có đai lưng */}
      <mesh position={[0, 0.98, 0.08]} scale={[1, 1.15, 0.9]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial {...suit} />
      </mesh>
      <mesh position={[0, 0.84, 0.08]} rotation-x={Math.PI / 2} scale={[1, 0.9, 1]}>
        <torusGeometry args={[0.28, 0.035, 12, 40]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Huy hiệu ngực */}
      <mesh position={[0.1, 1.07, -0.18]}>
        <circleGeometry args={[0.05, 24]} />
        <meshStandardMaterial color="#f8fafc" emissive={color} emissiveIntensity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Ba lô dưỡng khí */}
      <mesh position={[0, 1.02, 0.36]}>
        <boxGeometry args={[0.42, 0.46, 0.16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.3} roughness={0.5} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 1.14, 0.45]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
        </mesh>
      ))}
      {/* Tay: vươn ra đặt lên bàn, găng trắng */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.28, 1.0, -0.02]} rotation={[-1.15, 0, side * -0.25]}>
          <mesh position={[0, -0.16, 0]}>
            <capsuleGeometry args={[0.075, 0.24, 6, 12]} />
            <meshStandardMaterial {...suit} />
          </mesh>
          <mesh position={[0, -0.36, 0]}>
            <sphereGeometry args={[0.085, 16, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* Chân ngắn thò ra trước ghế */}
      {[-0.13, 0.13].map((x) => (
        <group key={x} position={[x, 0.66, -0.12]} rotation-x={-1.35}>
          <mesh position={[0, -0.12, 0]}>
            <capsuleGeometry args={[0.085, 0.18, 6, 12]} />
            <meshStandardMaterial {...suit} />
          </mesh>
          <mesh position={[0, -0.28, 0.03]}>
            <boxGeometry args={[0.16, 0.1, 0.2]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        </group>
      ))}

      <group ref={head} position={[0, 1.5, 0.04]}>
        {/* Cổ mũ */}
        <mesh position={[0, -0.24, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.17, 0.045, 12, 36]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
        </mesh>
        {/* Mặt: da, mắt, má hồng, miệng cười */}
        <mesh>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial color="#ffd7b5" roughness={0.8} />
        </mesh>
        {[-0.07, 0.07].map((x) => (
          <group key={x} position={[x, 0.03, -0.18]}>
            <mesh scale={[1, mood === "correct" ? 0.45 : 1.25, 1]}>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshStandardMaterial color="#1e1b4b" roughness={0.3} />
            </mesh>
            <mesh position={[0.01, 0.015, -0.025]}>
              <sphereGeometry args={[0.009, 8, 8]} />
              <meshBasicMaterial color="white" />
            </mesh>
          </group>
        ))}
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, -0.04, -0.15]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshStandardMaterial color="#fb7185" transparent opacity={0.55} />
          </mesh>
        ))}
        <mesh position={[0, -0.07, -0.18]} rotation={[0, 0, mood === "wrong" ? 0 : Math.PI]}>
          <torusGeometry args={[0.04, 0.009, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#9f1239" />
        </mesh>
        {/* Mũ kính trong */}
        <mesh>
          <sphereGeometry args={[0.29, 40, 40]} />
          <meshPhysicalMaterial color="#dbeafe" transparent opacity={faded ? 0.08 : 0.22} roughness={0.05} metalness={0.1} clearcoat={1} depthWrite={false} />
        </mesh>
        {/* Ăng-ten */}
        <mesh position={[0.12, 0.33, 0.04]} rotation-z={-0.25}>
          <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[0.15, 0.43, 0.04]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial ref={bulb} color={ANTENNA[mood]} emissive={ANTENNA[mood]} emissiveIntensity={1.5} />
        </mesh>
      </group>
    </group>
  );
}
