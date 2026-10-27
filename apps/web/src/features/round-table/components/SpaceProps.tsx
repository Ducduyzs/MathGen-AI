"use client";

import { Suspense, useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { SkyId } from "../model";

// Mô hình thật: NASA 3D Resources (không bản quyền) và Kenney Space Kit (CC0). Xem public/models/CREDITS.md.
const DRACO = "/draco/";
const M = {
  iss: "/models/space/iss.glb",
  hubble: "/models/space/hubble.glb",
  webb: "/models/space/webb.glb",
  bennu: "/models/space/bennu.glb",
  meteor: "/models/space/kenney_meteor_detailed.glb",
  speeder: "/models/space/kenney_craft_speederA.glb",
  racer: "/models/space/kenney_craft_racer.glb",
  cargo: "/models/space/kenney_craft_cargoA.glb",
};

/** Mô hình glTF được đưa về tâm và co giãn để cạnh dài nhất bằng `size` (mỗi nguồn dùng đơn vị khác nhau). */
function Model({ url, size, ...props }: { url: string; size: number } & Omit<ThreeElements["group"], "children">) {
  const { scene } = useGLTF(url, DRACO);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.sub(box.getCenter(new THREE.Vector3()));
    const holder = new THREE.Group();
    holder.add(clone);
    holder.scale.setScalar(size / Math.max(...box.getSize(new THREE.Vector3()).toArray(), 1e-6));
    return holder;
  }, [scene, size]);
  return (
    <group {...props}>
      <primitive object={object} />
    </group>
  );
}

/** Quay đều quanh trục y của chính nó (`spin`) hoặc bay vòng quanh bàn (`orbit` – bán kính, tốc độ). */
function Motion({ spin = 0, orbit, speed = 0, children }: { spin?: number; orbit?: number; speed?: number; children: ReactNode }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (outer.current && orbit) outer.current.rotation.y += dt * speed;
    if (inner.current) inner.current.rotation.y += dt * spin;
  });
  return (
    <group ref={outer}>
      <group position={[orbit ?? 0, 0, 0]}>
        <group ref={inner}>{children}</group>
      </group>
    </group>
  );
}

function Earth() {
  const [day, clouds] = useTexture(["/textures/planets/earth_atmos_2048.jpg", "/textures/planets/earth_clouds_1024.png"]);
  day.colorSpace = THREE.SRGBColorSpace;
  const cloudRef = useRef<THREE.Mesh>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.012;
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.018;
  });
  return (
    <group position={[-22, -14, -34]} rotation={[0.35, 0, 0.25]}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[11, 96, 96]} />
        <meshStandardMaterial map={day} roughness={0.85} />
      </mesh>
      <mesh ref={cloudRef} scale={1.012}>
        <sphereGeometry args={[11, 96, 96]} />
        <meshStandardMaterial alphaMap={clouds} color="white" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      {/* Quầng khí quyển */}
      <mesh scale={1.08}>
        <sphereGeometry args={[11, 64, 64]} />
        <meshBasicMaterial color="#5ab4ff" transparent opacity={0.12} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Moon() {
  const map = useTexture("/textures/planets/moon_1024.jpg");
  map.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[26, 11, -30]}>
      <sphereGeometry args={[2.4, 64, 64]} />
      <meshStandardMaterial map={map} roughness={1} />
    </mesh>
  );
}

/** Vành đai thiên thạch quanh bệ: vị trí cố định (hạt giống), cả vành quay chậm. */
function AsteroidBelt() {
  const ring = useRef<THREE.Group>(null);
  const rocks = useMemo(() => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
      const r = 8.5 + rand() * 3;
      return {
        pos: [Math.sin(a) * r, -1.5 + rand() * 3.5, Math.cos(a) * r] as [number, number, number],
        rot: [rand() * 6, rand() * 6, rand() * 6] as [number, number, number],
        size: 0.35 + rand() * 0.8,
        bennu: i % 9 === 0,
      };
    });
  }, []);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.y += dt * 0.02;
  });
  return (
    <group ref={ring}>
      {rocks.map((r, i) => (
        <Model key={i} url={r.bennu ? M.bennu : M.meteor} size={r.bennu ? r.size * 1.6 : r.size} position={r.pos} rotation={r.rot} />
      ))}
    </group>
  );
}

/** Tàu vũ trụ bay vòng lớn, mũi tàu hướng theo đường bay. */
function Flyby({ url, radius, height, speed, size, phase = 0 }: { url: string; radius: number; height: number; speed: number; size: number; phase?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const a = phase + state.clock.elapsedTime * speed;
    ref.current.position.set(Math.sin(a) * radius, height + Math.sin(a * 2) * 0.6, Math.cos(a) * radius);
    ref.current.rotation.set(0, a + (speed > 0 ? Math.PI / 2 : -Math.PI / 2), Math.sin(a * 2) * 0.15);
  });
  return (
    <group ref={ref}>
      <Model url={url} size={size} />
    </group>
  );
}

/** Mô hình không gian thật quanh bàn. Bầu trời ban ngày / hoàng hôn chỉ giữ tàu bay và trạm ISS trên cao. */
export function SpaceProps({ sky }: { sky: SkyId }) {
  const space = sky === "stars" || sky === "galaxy";
  return (
    <Suspense fallback={null}>
      {space && (
        <>
          <Earth />
          <Moon />
          <AsteroidBelt />
          <Model url={M.hubble} size={2.6} position={[10, 4.5, 9]} rotation={[0.3, 0.8, 0.2]} />
          <Model url={M.webb} size={3.4} position={[-11, 5.5, 8]} rotation={[0.2, -0.6, 0]} />
        </>
      )}
      <group position={[0, space ? 6 : 14, 0]}>
        <Motion orbit={15} speed={0.04} spin={0.05}>
          <Model url={M.iss} size={6} rotation={[0.25, 0, 0.1]} />
        </Motion>
      </group>
      <Flyby url={M.speeder} radius={13} height={2.5} speed={0.22} size={1.4} />
      <Flyby url={M.racer} radius={17} height={4.5} speed={-0.16} size={1.6} phase={2} />
      <Flyby url={M.cargo} radius={20} height={-3} speed={0.07} size={2.4} phase={4} />
    </Suspense>
  );
}

Object.values(M).forEach((url) => useGLTF.preload(url, DRACO));
