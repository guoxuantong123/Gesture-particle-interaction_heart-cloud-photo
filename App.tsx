import React, { useState, Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import VisionController from './components/VisionController';
import HeartParticles from './components/HeartParticles';
import PhotoGallery from './components/PhotoGallery';
import { GestureState } from './types';

function App() {
  const [gestureState, setGestureState] = useState<GestureState>(GestureState.DISPERSED);
  const [debugText, setDebugText] = useState("Open Hand");
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Logic to track how many times the user has formed the heart
  const [cycleCount, setCycleCount] = useState(0);
  const prevGestureRef = useRef<GestureState>(GestureState.DISPERSED);
  
  // Store hand position in a ref to avoid re-renders on every frame
  const handPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // 1. Load Photos from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('heart_cloud_photos');
      if (saved) {
        setImages(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load images from storage", e);
    }
  }, []);

  // 2. Save Photos to LocalStorage whenever they change
  useEffect(() => {
    if (images.length > 0) {
      try {
        localStorage.setItem('heart_cloud_photos', JSON.stringify(images));
      } catch (e) {
        console.warn("LocalStorage quota exceeded or error", e);
      }
    }
  }, [images]);

  // 3. Track Heart Formation Cycles
  useEffect(() => {
    const isActive = gestureState === GestureState.FORMED || gestureState === GestureState.ROTATING;
    const wasActive = prevGestureRef.current === GestureState.FORMED || prevGestureRef.current === GestureState.ROTATING;

    if (isActive && !wasActive) {
      setCycleCount(c => c + 1);
    }
    prevGestureRef.current = gestureState;
  }, [gestureState]);

  const showPhotos = cycleCount >= 2;

  const handleGestureChange = (state: GestureState) => {
    setGestureState(state);
    
    // Update debug text for UI
    switch(state) {
      case GestureState.FORMED: setDebugText("FIST: Form Heart"); break;
      case GestureState.ROTATING: setDebugText("V-SIGN: Rotating Heart"); break;
      case GestureState.FOCUSED: setDebugText("PINCH: Focus Photo"); break;
      default: setDebugText("OPEN: Disperse Stars"); break;
    }
  };

  const handleHandMove = (x: number, y: number) => {
      const sensitivityX = 25;
      const sensitivityY = 15;
      
      const targetX = (0.5 - x) * sensitivityX * 2; 
      const targetY = (0.5 - y) * sensitivityY * 2;
      
      handPosRef.current.set(targetX, targetY, 0);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = Array.from(event.target.files);
      
      Promise.all(files.map(file => {
          return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
          });
      })).then(loadedImages => {
          setImages(prev => [...prev, ...loadedImages]);
      });
    }
  };

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 30], fov: 60 }} dpr={[1, 2]}>
          <color attach="background" args={['#020205']} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <ambientLight intensity={0.8} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} color="#ccffff" />
          
          <Suspense fallback={null}>
             {/* Layer 1: The Star Particles (Shape of Heart) */}
             <HeartParticles gestureState={gestureState} handPosRef={handPosRef} />
             
             {/* Layer 2: The Floating Photos */}
             <PhotoGallery 
                gestureState={gestureState} 
                images={images} 
                handPosRef={handPosRef}
                visible={showPhotos}
             />
          </Suspense>

          <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            autoRotate={false} 
            enableRotate={gestureState !== GestureState.FOCUSED} 
          />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute top-8 left-8 z-10 text-white pointer-events-none select-none w-full max-w-md">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
              Heart Cloud
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Move hand to fly • V-Sign to Rotate • Pinch to Grab
            </p>
          </div>
        </div>
        
        <div className="mt-6 space-y-2 pointer-events-auto">
           {/* Upload Button */}
           <div className="mb-4">
              <input 
                type="file" 
                multiple
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-cyan-500/50 rounded text-sm text-cyan-100 transition-colors backdrop-blur-md flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {images.length > 0 ? `Photos Loaded (${images.length})` : "Upload Photos"}
              </button>
           </div>

           <div className={`flex items-center space-x-2 transition-opacity duration-300 ${gestureState === GestureState.DISPERSED ? 'opacity-100' : 'opacity-40'}`}>
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <span className="text-sm font-medium">Open Hand → Floating</span>
           </div>
           <div className={`flex items-center space-x-2 transition-opacity duration-300 ${gestureState === GestureState.FORMED ? 'opacity-100' : 'opacity-40'}`}>
              <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
              <span className="text-sm font-medium">Fist → Heart Cloud</span>
           </div>
           <div className={`flex items-center space-x-2 transition-opacity duration-300 ${gestureState === GestureState.ROTATING ? 'opacity-100' : 'opacity-40'}`}>
              <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]"></div>
              <span className="text-sm font-medium">V-Sign → Rotate Heart</span>
           </div>
           <div className={`flex items-center space-x-2 transition-opacity duration-300 ${gestureState === GestureState.FOCUSED ? 'opacity-100' : 'opacity-40'}`}>
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
              <span className="text-sm font-medium">Pinch → Grab Photo</span>
           </div>
        </div>

        <div className="mt-8 p-3 bg-white/5 backdrop-blur-md rounded border border-cyan-500/30 inline-block">
           <p className="text-xs font-mono text-cyan-200 animate-pulse">
             STATUS: {debugText}
           </p>
        </div>
      </div>

      <VisionController onGestureChange={handleGestureChange} onHandMove={handleHandMove} />
      
    </div>
  );
}

export default App;