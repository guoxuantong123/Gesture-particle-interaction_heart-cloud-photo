import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GestureState } from '../types';
import { randomInHeart, randomInSphere } from '../utils/math';

interface PhotoGalleryProps {
  gestureState: GestureState;
  images: string[];
  handPosRef: React.MutableRefObject<THREE.Vector3>;
  visible: boolean; // New prop to control visibility
}

const PhotoFrame: React.FC<{ 
  url: string; 
  targetPos: THREE.Vector3; 
  isFocused: boolean;
  gestureState: GestureState;
  parentGroupRef: React.MutableRefObject<THREE.Group | null>;
  visible: boolean;
}> = ({ url, targetPos, isFocused, gestureState, parentGroupRef, visible }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [aspect, setAspect] = useState(1);
  
  const texture = useMemo(() => {
      const loader = new THREE.TextureLoader();
      return loader.load(url, (tex) => {
          if (tex.image) {
              setAspect(tex.image.width / tex.image.height);
          }
      });
  }, [url]);

  const position = useRef(new THREE.Vector3(
      (Math.random() - 0.5) * 50, 
      (Math.random() - 0.5) * 50, 
      (Math.random() - 0.5) * 50
  ));

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();
    const damping = 0.08;

    // Calculate Destination
    let dest = new THREE.Vector3().copy(targetPos);
    let targetScale = 1;
    let targetRot = new THREE.Euler(0, 0, 0);
    
    // We access the current parent group from the ref
    const parentGroup = parentGroupRef.current;

    if (isFocused && parentGroup) {
        // ROBUST FOCUS LOGIC with Nested Rotation:
        // Target: World Coordinate (0, 0, 20)
        // Transform World Target -> Local Space of the rotating parent
        
        const targetWorldPos = new THREE.Vector3(0, 0, 20);
        const localDest = parentGroup.worldToLocal(targetWorldPos.clone());
        
        dest.copy(localDest);
        targetScale = 8;
        targetRot.set(0, 0, 0); 
    } else {
        if (gestureState === GestureState.FOCUSED) {
            dest.z -= 40; 
            targetScale = 0.5;
        } else if (gestureState === GestureState.FORMED || gestureState === GestureState.ROTATING) {
            targetScale = 1.2;
            targetRot.set(0, time * 0.2, 0);
        } else {
            // Dispersed
            dest.y += Math.sin(time + position.current.x) * 2;
            targetScale = 3; 
            targetRot.set(Math.sin(time * 0.1), Math.cos(time * 0.1), 0);
        }
    }

    // Apply movement
    position.current.lerp(dest, damping);
    meshRef.current.position.copy(position.current);
    
    // Apply Scale
    const currentScale = meshRef.current.scale.y; 
    const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, damping);
    if (!isNaN(nextScale) && nextScale > 0.001) {
        meshRef.current.scale.set(nextScale * aspect, nextScale, 1);
    }

    // Apply Rotation
    if (isFocused && parentGroup) {
         // Counter-rotation to face camera
         // We need the inverse of the parent's WORLD quaternion
         const parentWorldQuat = new THREE.Quaternion();
         parentGroup.getWorldQuaternion(parentWorldQuat);
         
         meshRef.current.quaternion.copy(parentWorldQuat).invert();
    } else {
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.x, damping);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.y, damping);
        meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRot.z, damping);
        
        if (gestureState === GestureState.DISPERSED) {
             meshRef.current.lookAt(state.camera.position);
        }
    }

    // Opacity & Visibility Control
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    let targetOpacity = 0.9;
    
    if (!visible) {
        targetOpacity = 0; // Hide if not enabled
    } else if (gestureState === GestureState.FOCUSED && !isFocused) {
        targetOpacity = 0.1; // Dim background photos if focused
    }

    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, damping);
    
    meshRef.current.renderOrder = isFocused ? 999 : 1;
  });

  return (
    <mesh ref={meshRef} position={position.current}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial 
        map={texture} 
        transparent 
        side={THREE.DoubleSide} 
        opacity={0} 
        depthWrite={!isFocused && visible} // Disable depth write when hidden or focused background
        depthTest={true}
      />
      {isFocused && visible && (
          <lineSegments>
              <edgesGeometry args={[new THREE.PlaneGeometry(1, 1)]} />
              <lineBasicMaterial color="#22d3ee" linewidth={2} transparent opacity={0.8} />
          </lineSegments>
      )}
    </mesh>
  );
};

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ gestureState, images, handPosRef, visible }) => {
  const outerGroupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  
  const positions = useMemo(() => {
    return images.map(() => ({
        dispersed: randomInSphere(30),
        formed: randomInHeart(0.6),
    }));
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [viewCounts, setViewCounts] = useState<Record<number, number>>({});
  const previousState = useRef(gestureState);

  useFrame((state, delta) => {
    // 1. OUTER GROUP: Position & Tilt (Parallax)
    if (outerGroupRef.current) {
        const isFormed = gestureState === GestureState.FORMED || gestureState === GestureState.ROTATING;
        
        // Rule: When Formed/Rotating, force position to center (0,0,0). When Dispersed, follow hand.
        const targetPos = isFormed ? new THREE.Vector3(0, 0, 0) : handPosRef.current;
        
        outerGroupRef.current.position.lerp(targetPos, 0.1);
        
        const targetRotX = -handPosRef.current.y * 0.05; // Tilt X
        const targetRotY = handPosRef.current.x * 0.05; // Tilt Y
        
        outerGroupRef.current.rotation.x = THREE.MathUtils.lerp(outerGroupRef.current.rotation.x, targetRotX, 0.05);
        outerGroupRef.current.rotation.y = THREE.MathUtils.lerp(outerGroupRef.current.rotation.y, targetRotY, 0.05);
    }

    // 2. INNER GROUP: Continuous Rotation (V-Sign)
    if (innerGroupRef.current) {
        if (gestureState === GestureState.ROTATING) {
            innerGroupRef.current.rotation.y += delta * 2.0; // Fast spin
        } else if (gestureState === GestureState.FORMED) {
            const time = state.clock.getElapsedTime();
            innerGroupRef.current.rotation.y = THREE.MathUtils.lerp(innerGroupRef.current.rotation.y, Math.sin(time * 0.5) * 0.2, 0.05);
        } else {
             // Gentle drift
             innerGroupRef.current.rotation.y += delta * 0.1;
        }
    }
  });

  // Nearest Photo Calculation
  useEffect(() => {
    if (gestureState === GestureState.FOCUSED && previousState.current !== GestureState.FOCUSED) {
        if (images.length > 0 && innerGroupRef.current) {
            // Check based on previous state locations
            const sourceLocalPositions = (previousState.current === GestureState.FORMED || previousState.current === GestureState.ROTATING)
                ? positions.map(p => p.formed)
                : positions.map(p => p.dispersed);

            const cameraPos = new THREE.Vector3(0, 0, 30);
            
            // Note: We use the INNER group for the matrix transform
            innerGroupRef.current.updateMatrixWorld();

            let bestIndex = 0;
            let minScore = Infinity;

            sourceLocalPositions.forEach((localPos, idx) => {
                const worldPos = new THREE.Vector3().copy(localPos);
                // Apply cumulative transform (Outer + Inner) via matrixWorld
                worldPos.applyMatrix4(innerGroupRef.current!.matrixWorld);
                
                const distance = worldPos.distanceTo(cameraPos);
                
                // Score = Distance + Penalty for View Count
                // 500 units penalty ensures we cycle through all photos before repeating
                const count = viewCounts[idx] || 0;
                const score = distance + (count * 500); 
                
                if (score < minScore) {
                    minScore = score;
                    bestIndex = idx;
                }
            });
            
            setActiveIndex(bestIndex);
            
            // Increment view count
            setViewCounts(prev => ({
                ...prev,
                [bestIndex]: (prev[bestIndex] || 0) + 1
            }));
        }
    }
    previousState.current = gestureState;
  }, [gestureState, images.length, positions, viewCounts]);

  return (
    <group ref={outerGroupRef}>
      <group ref={innerGroupRef}>
        {images.map((img, i) => (
            <PhotoFrame 
                key={i} 
                url={img} 
                targetPos={
                    (gestureState === GestureState.FORMED || gestureState === GestureState.ROTATING)
                    ? positions[i].formed 
                    : positions[i].dispersed
                }
                isFocused={gestureState === GestureState.FOCUSED && i === activeIndex}
                gestureState={gestureState}
                parentGroupRef={innerGroupRef}
                visible={visible}
            />
        ))}
      </group>
    </group>
  );
};

export default PhotoGallery;