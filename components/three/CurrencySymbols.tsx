"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import { motion } from "framer-motion";

const SYMBOLS = ["€", "£", "¥", "$", "₹", "₽", "₩", "₿"];
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function CurrencySymbol({ index, initialPosition }: { index: number; initialPosition: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const { viewport } = useThree();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const color = COLORS[index % COLORS.length];
  const symbol = SYMBOLS[index % SYMBOLS.length];

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.15;
      groupRef.current.position.y = initialPosition[1] + Math.sin(state.clock.elapsedTime * 0.7 + index) * 0.3;

      const parallaxX = mouse.x * 0.5;
      const parallaxY = mouse.y * 0.5;
      groupRef.current.position.x = initialPosition[0] + parallaxX;
      groupRef.current.position.z = initialPosition[2] + parallaxY;
    }
  });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / viewport.width) * 2 - 1,
        y: -(e.clientY / viewport.height) * 2 + 1,
      });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [viewport]);

  return (
    <group ref={groupRef} position={initialPosition}>
      <mesh ref={ref} castShadow receiveShadow>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial
          color={color}
          metalness={0.1}
          roughness={0.3}
          transparent
          opacity={0.85}
          side={2}
        />
      </mesh>
      <Html
        transform
        position={[0, 0, 0.8]}
        style={{
          fontSize: "3.5rem",
          fontWeight: 800,
          color: color,
          textShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
          pointerEvents: "none",
          filter: "drop-shadow(0 0 10px rgba(255,255,255,0.3))",
        }}
        fullscreen
      >
        {symbol}
      </Html>
    </group>
  );
}

export function CurrencySymbolsScene() {
  const positions = [
    [-3, 1.5, -2], [3, 0.5, -3], [-4, -0.5, -1], [4, 2, -4],
    [-2, -1.5, -3], [2, 1, -2], [-5, 0, -5], [5, -1, -4],
  ];

  return (
    <>
      {positions.map((pos, i) => (
        <CurrencySymbol key={i} index={i} initialPosition={pos as [number, number, number]} />
      ))}
    </>
  );
}

function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null!);
  const { viewport } = useThree();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const count = 3000;

  const arrays = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
      const isGreen = Math.random() > 0.5;
      col[i * 3] = isGreen ? 0.06 : 0.93;
      col[i * 3 + 1] = isGreen ? 0.73 : 0.27;
      col[i * 3 + 2] = isGreen ? 0.51 : 0.27;
      siz[i] = Math.random() * 2 + 0.5;
    }
    return { pos, col, siz };
  }, [count]);

  useEffect(() => {
    if (!pointsRef.current) return;

    const handleMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / viewport.width) * 2 - 1,
        y: -(e.clientY / viewport.height) * 2 + 1,
      });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [viewport]);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0001;
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 2] -= 0.005;
        if (positions[i * 3 + 2] < -15) positions[i * 3 + 2] = 10;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;

      pointsRef.current.position.x = mouse.x * 2;
      pointsRef.current.position.y = mouse.y * 1.5;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[arrays.pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[arrays.col, 3]} />
        <bufferAttribute attach="attributes-size" args={[arrays.siz, 1]} />
      </bufferGeometry>
      <pointsMaterial vertexColors sizeAttenuation transparent opacity={0.6} />
    </points>
  );
}

export function HeroScene() {
  const prefersReducedMotion = typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) return null;

  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
    >
      <color attach="background" args={["#0a0f1a"]} />
      <fog attach="fog" args={["#0a0f1a", 5, 25]} />

      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[5, 10, 7]} intensity={1.2} color="#ffffff" castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#10b981" />
      <pointLight position={[0, 3, 5]} intensity={0.8} color="#f59e0b" decay={2} />

      <CurrencySymbolsScene />
      <ParticleField />
    </Canvas>
  );
}