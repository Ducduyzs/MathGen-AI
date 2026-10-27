"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Sky, Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { TablePhase, TablePlayer, TableRoom } from "@/types/api";
import { SEAT_COLORS, shortName, type SkyId } from "../model";

const SEAT_RADIUS = 2.1;
const EYE = 1.4;
const TABLE_Y = 0.8;
const SPIN_MS = 2200; // khớp với lúc bảng kết quả hiện "An toàn" / "Trúng hố đen"

/** Ghế của mình luôn ở phía trước camera; ghế kế tiếp theo chiều kim đồng hồ. */
const seatAngle = (seat: number, mySeat: number) => ((seat - mySeat) * Math.PI) / 2;
const onCircle = (angle: number, r: number, y = 0) => new THREE.Vector3(Math.sin(angle) * r, y, Math.cos(angle) * r);

// ------------------------------------------------------------------ nhìn quanh

/** Kéo chuột / vuốt để xoay đầu; vị trí camera cố định tại ghế (không đi lại được). Nhấp đúp để nhìn lại giữa bàn. */
function LookAround() {
  const { camera, gl } = useThree();
  const view = useRef({ yaw: 0, pitch: -0.3, targetYaw: 0, targetPitch: -0.3, drag: null as null | { x: number; y: number } });

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    const down = (e: PointerEvent) => {
      view.current.drag = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      const v = view.current;
      if (!v.drag) return;
      v.targetYaw += (e.clientX - v.drag.x) * 0.0045;
      v.targetPitch = THREE.MathUtils.clamp(v.targetPitch + (e.clientY - v.drag.y) * 0.0035, -1.1, 1.0);
      v.drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      view.current.drag = null;
      el.style.cursor = "grab";
    };
    const reset = () => Object.assign(view.current, { targetYaw: 0, targetPitch: -0.3 });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("dblclick", reset);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("dblclick", reset);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const v = view.current;
    const k = 1 - Math.exp(-dt * 10);
    v.yaw += (v.targetYaw - v.yaw) * k;
    v.pitch += (v.targetPitch - v.pitch) * k;
    camera.rotation.set(v.pitch, v.yaw, 0, "YXZ");
  });
  return null;
}

// ------------------------------------------------------------------ bầu trời

function Planet({ position, radius, color, ring }: { position: [number, number, number]; radius: number; color: string; ring?: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.03;
  });
  return (
    <group ref={ref} position={position}>
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial color={color} roughness={0.9} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {ring && (
        <mesh rotation={[Math.PI / 2.4, 0, 0.3]}>
          <ringGeometry args={[radius * 1.35, radius * 2.1, 96]} />
          <meshBasicMaterial color={ring} transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Nebula({ position, scale, color }: { position: [number, number, number]; scale: number; color: string }) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function SkyBox({ sky }: { sky: SkyId }) {
  if (sky === "day") {
    return (
      <>
        <Sky sunPosition={[60, 40, -80]} turbidity={4} rayleigh={1.2} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 10, -4]} intensity={1.6} />
      </>
    );
  }
  if (sky === "sunset") {
    return (
      <>
        <Sky sunPosition={[100, 3, -100]} turbidity={9} rayleigh={3} mieCoefficient={0.01} mieDirectionalG={0.9} />
        <Stars radius={90} depth={30} count={1200} factor={3} fade speed={0.5} />
        <ambientLight intensity={0.55} color="#ffd6b0" />
        <directionalLight position={[10, 3, -10]} intensity={1.4} color="#ffb070" />
      </>
    );
  }
  return (
    <>
      <color attach="background" args={[sky === "galaxy" ? "#0b0622" : "#03050c"]} />
      <Stars radius={90} depth={50} count={sky === "galaxy" ? 6000 : 4500} factor={4.5} saturation={sky === "galaxy" ? 0.6 : 0} fade speed={0.6} />
      {sky === "galaxy" && (
        <>
          <Sparkles count={160} scale={[40, 16, 40]} size={3} speed={0.25} color="#b9a4ff" />
          <Nebula position={[-30, 12, -40]} scale={22} color="#8b5cf6" />
          <Nebula position={[35, -4, -30]} scale={18} color="#ec4899" />
          <Nebula position={[10, 20, 40]} scale={25} color="#38bdf8" />
          <Planet position={[-16, 7, -24]} radius={4} color="#7c5cff" ring="#c4b5fd" />
          <Planet position={[22, 3, 18]} radius={2} color="#f59e0b" />
        </>
      )}
      <ambientLight intensity={0.45} color="#c7d2fe" />
      <directionalLight position={[4, 8, 6]} intensity={0.9} color="#e0e7ff" />
    </>
  );
}

// ------------------------------------------------------------------ bàn tròn

const PHASE_GLOW: Record<TablePhase, string> = { lobby: "#5aaef0", question: "#38bdf8", reveal: "#f59e0b", finished: "#34d399" };

function Table({ phase }: { phase: TablePhase }) {
  const core = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (!core.current) return;
    core.current.rotation.y += dt * 0.6;
    core.current.rotation.x += dt * 0.25;
    core.current.position.y = TABLE_Y + 0.22 + Math.sin(state.clock.elapsedTime * 1.4) * 0.05;
  });
  const glow = PHASE_GLOW[phase];
  return (
    <group>
      {/* Bệ đứng lơ lửng giữa không gian */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[3.3, 3.3, 0.1, 96]} />
        <meshStandardMaterial color="#121a2e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.15, 3.3, 96]} />
        <meshBasicMaterial color={glow} transparent opacity={0.8} />
      </mesh>
      {/* Mặt bàn + chân bàn */}
      <mesh position={[0, TABLE_Y / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.38, TABLE_Y, 32]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, TABLE_Y, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.07, 96]} />
        <meshStandardMaterial color="#23324d" metalness={0.55} roughness={0.3} />
      </mesh>
      <mesh position={[0, TABLE_Y + 0.037, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.24, 1.33, 96]} />
        <meshBasicMaterial color={glow} />
      </mesh>
      {/* Lõi phát sáng giữa bàn: đổi màu theo giai đoạn */}
      <mesh ref={core} position={[0, TABLE_Y + 0.22, 0]}>
        <icosahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.4} wireframe />
      </mesh>
      <pointLight position={[0, TABLE_Y + 0.5, 0]} intensity={6} distance={4} color={glow} />
    </group>
  );
}

// ------------------------------------------------------------------ vòng quay hố đen

/** 6 ô trên mặt bàn trước mỗi ghế: ô đã quay tối đi; lượt vừa sai thì vòng quay rồi lộ kết quả. */
function Roulette({ player, chambers, angle, revealKey, phase }: { player: TablePlayer; chambers: number; angle: number; revealKey: string; phase: TablePhase }) {
  const wheel = useRef<THREE.Group>(null);
  const hub = useRef<THREE.MeshStandardMaterial>(null);
  const started = useRef(performance.now());
  const spinning = phase === "reveal" && !!player.last?.spun;

  useEffect(() => {
    started.current = performance.now();
  }, [revealKey]);

  useFrame((state) => {
    if (!wheel.current || !hub.current) return;
    const t = performance.now() - started.current;
    if (spinning && t < SPIN_MS) {
      const p = t / SPIN_MS;
      wheel.current.rotation.y = (1 - (1 - p) ** 3) * Math.PI * 6; // chậm dần như vòng quay thật
      hub.current.emissive.set("#f59e0b");
      hub.current.emissiveIntensity = 1 + Math.sin(t / 60) * 0.5;
    } else if (!player.alive) {
      hub.current.emissive.set("#7c3aed");
      hub.current.color.set("#050008");
      hub.current.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 3) * 0.4;
    } else if (spinning) {
      hub.current.emissive.set("#22c55e");
      hub.current.emissiveIntensity = 1.2;
    } else {
      hub.current.emissive.set(SEAT_COLORS[player.seat]);
      hub.current.emissiveIntensity = 0.5;
    }
  });

  const used = player.spins - (spinning ? 1 : 0); // ô vừa quay chỉ tối đi sau khi vòng dừng
  const pos = onCircle(angle, 0.95, TABLE_Y + 0.045);
  return (
    <group position={pos}>
      <group ref={wheel}>
        {Array.from({ length: chambers }, (_, i) => {
          const a = (i / chambers) * Math.PI * 2;
          const off = i < used;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.13, 0, Math.cos(a) * 0.13]}>
              <cylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
              <meshStandardMaterial
                color={off ? "#1f2937" : "#e2e8f0"}
                emissive={off ? "#000000" : SEAT_COLORS[player.seat]}
                emissiveIntensity={off ? 0 : 0.6}
              />
            </mesh>
          );
        })}
      </group>
      <mesh>
        <cylinderGeometry args={[0.06, 0.06, 0.03, 24]} />
        <meshStandardMaterial ref={hub} color="#0f172a" />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ nhân vật

function BlackHole() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 2.5;
  });
  return (
    <group position={[0, 1.15, 0]}>
      <mesh>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={ref} rotation-x={Math.PI / 2.2}>
        <torusGeometry args={[0.52, 0.1, 16, 64]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.75} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Status({ player, phase }: { player: TablePlayer; phase: TablePhase }) {
  let text = "";
  let tone = "bg-slate-900/80 text-slate-100";
  if (!player.alive) [text, tone] = ["Đã bị loại", "bg-violet-950/90 text-violet-200"];
  else if (phase === "question") [text, tone] = player.answered ? ["Đã trả lời", "bg-emerald-600/90 text-white"] : ["Đang nghĩ…", tone];
  else if (phase === "reveal" && player.last)
    [text, tone] = player.last.correct ? [`+${player.last.points}`, "bg-emerald-600/90 text-white"] : ["Quay vòng!", "bg-amber-500/90 text-slate-950"];
  else if (phase === "lobby") text = "Sẵn sàng";
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow" style={{ background: SEAT_COLORS[player.seat], color: "white" }}>
        {shortName(player.name, player.is_bot)} · {player.score}
      </span>
      {text && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tone}`}>{text}</span>}
    </div>
  );
}

function Avatar({ player, angle, phase }: { player: TablePlayer; angle: number; phase: TablePhase }) {
  const body = useRef<THREE.Group>(null);
  const color = SEAT_COLORS[player.seat];
  const pos = onCircle(angle, SEAT_RADIUS);

  useFrame((state, dt) => {
    if (!body.current) return;
    // Người bị loại chìm dần vào hố đen; người còn chơi khẽ nhấp nhô
    const target = player.alive ? Math.sin(state.clock.elapsedTime * 1.6 + player.seat) * 0.025 : -1.6;
    body.current.position.y += (target - body.current.position.y) * (1 - Math.exp(-dt * (player.alive ? 8 : 1.2)));
  });

  return (
    <group position={pos} rotation-y={angle}>
      {/* Ghế */}
      <mesh position={[0, 0.45, 0.12]}>
        <boxGeometry args={[0.6, 0.08, 0.55]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.85, 0.38]}>
        <boxGeometry args={[0.6, 0.8, 0.07]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.5} />
      </mesh>
      {!player.alive && <BlackHole />}
      <group ref={body}>
        <mesh position={[0, 0.98, 0.1]}>
          <capsuleGeometry args={[0.2, 0.42, 8, 16]} />
          <meshStandardMaterial color={color} roughness={0.45} transparent opacity={player.alive ? 1 : 0.35} />
        </mesh>
        <mesh position={[0, 1.5, 0.08]}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.3} transparent opacity={player.alive ? 1 : 0.35} />
        </mesh>
        {/* Kính phi hành gia hướng về giữa bàn */}
        <mesh position={[0, 1.51, -0.05]} scale={[1, 0.62, 0.55]}>
          <sphereGeometry args={[0.16, 32, 32]} />
          <meshStandardMaterial color="#0b1020" metalness={0.9} roughness={0.1} emissive={color} emissiveIntensity={0.25} />
        </mesh>
        {/* Hai tay đặt lên bàn */}
        {[-0.24, 0.24].map((x) => (
          <mesh key={x} position={[x, 0.86, -0.28]} rotation-x={Math.PI / 2.3}>
            <capsuleGeometry args={[0.055, 0.32, 4, 8]} />
            <meshStandardMaterial color={color} transparent opacity={player.alive ? 1 : 0.35} />
          </mesh>
        ))}
      </group>
      <Html position={[0, 1.88, 0]} center distanceFactor={6} zIndexRange={[5, 0]} className="pointer-events-none">
        <Status player={player} phase={phase} />
      </Html>
    </group>
  );
}

// ------------------------------------------------------------------ cảnh

function Scene({ room, sky }: { room: TableRoom; sky: SkyId }) {
  const revealKey = `${room.round}-${room.phase}`;
  const seats = useMemo(() => room.players.map((p) => ({ p, angle: seatAngle(p.seat, room.my_seat) })), [room.players, room.my_seat]);
  return (
    <>
      <SkyBox sky={sky} />
      <Table phase={room.phase} />
      {seats.map(({ p, angle }) => (
        <group key={p.seat}>
          {!p.is_me && <Avatar player={p} angle={angle} phase={room.phase} />}
          {room.phase !== "lobby" && <Roulette player={p} chambers={room.chambers} angle={angle} revealKey={revealKey} phase={room.phase} />}
        </group>
      ))}
      <LookAround />
    </>
  );
}

export function TableScene({ room, sky }: { room: TableRoom; sky: SkyId }) {
  return (
    <div className="absolute inset-0">
      <Canvas
      dpr={[1, 2]}
      camera={{ fov: 62, near: 0.05, far: 400, position: [0, EYE, SEAT_RADIUS + 0.45] }}
      gl={{ antialias: true }}
    >
      <Scene room={room} sky={sky} />
      </Canvas>
    </div>
  );
}

export { SPIN_MS };
