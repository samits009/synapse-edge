"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface RingProps {
  score: number;
}

function Scene({ score }: RingProps) {
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);

  const pct = score * 100;
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#3b82f6" : "#f59e0b";
  const neonColor = new THREE.Color(color);

  useFrame((state, delta) => {
    if (outerRingRef.current) {
      outerRingRef.current.rotation.x += delta * 0.5;
      outerRingRef.current.rotation.y += delta * 0.8;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.x -= delta * 0.4;
      innerRingRef.current.rotation.y -= delta * 0.6;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color={neonColor} />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#1e293b" />
      
      {/* Outer wireframe ring */}
      <mesh ref={outerRingRef}>
        <torusGeometry args={[1.2, 0.04, 16, 64]} />
        <meshStandardMaterial 
          color="#334155" 
          transparent 
          opacity={0.4} 
          wireframe={true} 
        />
      </mesh>

      {/* Inner glowing ring that scales with the similarity score */}
      <mesh ref={innerRingRef} scale={Math.max(0.3, score)}>
        <torusGeometry args={[0.9, 0.08, 16, 64]} />
        <meshStandardMaterial 
          color={neonColor}
          emissive={neonColor}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>

      <Html center className="pointer-events-none">
        <div className="flex items-center justify-center">
          <span 
            className="text-[11px] font-mono font-bold" 
            style={{ 
              color,
              textShadow: `0 0 10px ${color}`
            }}
          >
            {pct.toFixed(0)}
          </span>
        </div>
      </Html>
    </>
  );
}

export default function ThreeSimilarityRing({ score }: RingProps) {
  return (
    <div className="w-16 h-16 shrink-0 relative flex items-center justify-center">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
      >
        <Scene score={score} />
      </Canvas>
    </div>
  );
}
