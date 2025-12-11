import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GestureState } from '../types';
import { randomInHeart, randomInSphere } from '../utils/math';

interface HeartParticlesProps {
  gestureState: GestureState;
  handPosRef: React.MutableRefObject<THREE.Vector3>;
}

const COUNT = 5000;
const DAMPING = 0.05;

const HeartParticles: React.FC<HeartParticlesProps> = ({ gestureState, handPosRef }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Store target positions for both states
  const { heartPositions, dispersedPositions, colors, randomPhases } = useMemo(() => {
    const hPos = new Float32Array(COUNT * 3);
    const dPos = new Float32Array(COUNT * 3);
    const cols = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    const colorObj = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      // Heart Target
      const h = randomInHeart(0.6); // Scale heart slightly larger
      hPos[i * 3] = h.x;
      hPos[i * 3 + 1] = h.y;
      hPos[i * 3 + 2] = h.z;

      // Dispersed Target
      const d = randomInSphere(40);
      dPos[i * 3] = d.x;
      dPos[i * 3 + 1] = d.y;
      dPos[i * 3 + 2] = d.z;

      // New Color Palette: Deeper Blues & White for contrast
      const r = Math.random();
      if (r > 0.9) colorObj.setHex(0xffffff); // White Sparkles
      else if (r > 0.6) colorObj.setHex(0x38bdf8); // Sky Blue (Tailwind Sky-400)
      else if (r > 0.3) colorObj.setHex(0x0ea5e9); // Ocean Blue (Tailwind Sky-500)
      else colorObj.setHex(0x0284c7); // Deep Blue (Tailwind Sky-600)
      
      cols[i * 3] = colorObj.r;
      cols[i * 3 + 1] = colorObj.g;
      cols[i * 3 + 2] = colorObj.b;
      
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { heartPositions: hPos, dispersedPositions: dPos, colors: cols, randomPhases: phases };
  }, []);

  // Current positions (for animation)
  const currentPositions = useRef(new Float32Array(dispersedPositions));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current || !groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const isFormed = gestureState === GestureState.FORMED || gestureState === GestureState.ROTATING;
    
    // 1. GLOBAL MOVEMENT & PARALLAX TILT
    // Rule: When Formed/Rotating, force position to center (0,0,0). When Dispersed, follow hand.
    const targetPos = isFormed ? new THREE.Vector3(0, 0, 0) : handPosRef.current;
    groupRef.current.position.lerp(targetPos, 0.1);

    // Apply Parallax Tilt based on hand position (Tilt works in ALL modes)
    // Moving hand Right (Pos X+) -> Tits cloud to look Left (Rot Y+)
    // Moving hand Up (Pos Y+) -> Tilts cloud to look Down (Rot X-)
    const targetRotX = -handPosRef.current.y * 0.05; 
    const targetRotY = handPosRef.current.x * 0.05;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.05);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);

    // 2. PARTICLE LERPING
    let targetBuffer = dispersedPositions;
    let scale = 1;

    // Logic: Stars form heart on Fist, Rotation, or Focus
    if (isFormed || gestureState === GestureState.FOCUSED) {
      targetBuffer = heartPositions;
      scale = 1;
    } else {
      targetBuffer = dispersedPositions;
      scale = 1;
    }

    for (let i = 0; i < COUNT; i++) {
      const idx = i * 3;
      
      const tx = targetBuffer[idx] * scale;
      const ty = targetBuffer[idx + 1] * scale;
      const tz = targetBuffer[idx + 2] * scale;

      const noise = Math.sin(time * 2 + i) * 0.1;

      currentPositions.current[idx] += (tx - currentPositions.current[idx]) * DAMPING;
      currentPositions.current[idx + 1] += (ty + noise - currentPositions.current[idx + 1]) * DAMPING;
      currentPositions.current[idx + 2] += (tz - currentPositions.current[idx + 2]) * DAMPING;

      dummy.position.set(
        currentPositions.current[idx],
        currentPositions.current[idx + 1],
        currentPositions.current[idx + 2]
      );
      
      dummy.rotation.set(time * 0.5, time * 0.3, 0);
      
      // Twinkle
      const twinkle = 1 + Math.sin(time * 3 + randomPhases[i]) * 0.5;
      dummy.scale.setScalar(0.15 * twinkle);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    // Dim stars when focusing on a photo
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    if (gestureState === GestureState.FOCUSED) {
        material.opacity = THREE.MathUtils.lerp(material.opacity, 0.2, 0.1);
    } else {
        material.opacity = THREE.MathUtils.lerp(material.opacity, 1, 0.1);
    }

    // 3. INTERNAL ANIMATION (Spin/Sway)
    // This rotation applies to the inner mesh, combining with the outer group tilt
    if (gestureState === GestureState.ROTATING) {
         // Fast spin
         meshRef.current.rotation.y += delta * 2; 
    } else if (gestureState === GestureState.FORMED) {
         // Gentle sway
         const targetSway = Math.sin(time * 0.5) * 0.2;
         meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetSway, 0.05);
    } else {
         // Slow drift (Dispersed / Focused)
         meshRef.current.rotation.y += delta * 0.1; 
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
        <dodecahedronGeometry args={[0.2, 0]} /> 
        <meshStandardMaterial 
          transparent
          opacity={1}
          vertexColors
          emissive="#ffffff" 
          emissiveIntensity={1} 
          roughness={0.1} 
        />
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </instancedMesh>
      
      <pointLight 
        ref={lightRef} 
        position={[0, 0, 10]} 
        intensity={20} 
        color="#38bdf8" 
      />
    </group>
  );
};

export default HeartParticles;