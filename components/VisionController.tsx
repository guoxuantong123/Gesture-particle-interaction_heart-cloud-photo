import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { GestureState } from '../types';

interface VisionControllerProps {
  onGestureChange: (state: GestureState) => void;
  onHandMove: (x: number, y: number) => void;
}

const VisionController: React.FC<VisionControllerProps> = ({ onGestureChange, onHandMove }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  // Initialize MediaPipe
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        setLoading(false);
        startCamera();
      } catch (err) {
        console.error("MediaPipe Init Error:", err);
      }
    };

    initMediaPipe();
    
    return () => {
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener('loadeddata', predictWebcam);
      setCameraAllowed(true);
    } catch (err) {
      console.error("Camera Error:", err);
      setCameraAllowed(false);
    }
  };

  const detectGesture = (landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return GestureState.DISPERSED; // Default if no hand

    const hand = landmarks[0]; // Assume 1 hand
    const wrist = hand[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];

    // Helper to calc distance
    const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    const pinchDist = dist(thumbTip, indexTip);
    const indexDist = dist(indexTip, wrist);
    const middleDist = dist(middleTip, wrist);
    const ringDist = dist(ringTip, wrist);
    const pinkyDist = dist(pinkyTip, wrist);

    // 1. PINCH Detection (Thumb tip close to Index tip)
    // Priority: Pinch > V-Sign > Fist > Open
    if (pinchDist < 0.06 && (middleDist > 0.2 || ringDist > 0.2)) {
      return GestureState.FOCUSED;
    }

    // 2. V-SIGN (Peace) Detection
    // Index & Middle extended (far from wrist)
    // Ring & Pinky curled (close to wrist)
    if (indexDist > 0.35 && middleDist > 0.35 && ringDist < 0.25 && pinkyDist < 0.25) {
        // Ensure not pinching
        if (pinchDist > 0.1) {
            return GestureState.ROTATING;
        }
    }

    // 3. FIST Detection (All fingertips close to wrist)
    const avgTipToWrist = (indexDist + middleDist + ringDist + pinkyDist) / 4;

    if (avgTipToWrist < 0.25) {
      return GestureState.FORMED;
    }

    return GestureState.DISPERSED;
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (video.videoWidth > 0 && video.videoHeight > 0) {
       // Start detection
       const startTimeMs = performance.now();
       const result = handLandmarkerRef.current.detectForVideo(video, startTimeMs);

       // Draw debug overlay
       ctx!.clearRect(0, 0, canvas.width, canvas.height);
       canvas.width = video.videoWidth;
       canvas.height = video.videoHeight;
       
       if (result.landmarks && result.landmarks.length > 0) {
         const landmarks = result.landmarks[0];
         const drawingUtils = new DrawingUtils(ctx!);
         
         // Draw Hand
         for (const l of result.landmarks) {
            drawingUtils.drawConnectors(l, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
            drawingUtils.drawLandmarks(l, { color: "#FF0000", lineWidth: 1, radius: 3 });
         }
         
         // Process Gesture
         const newState = detectGesture(result.landmarks);
         onGestureChange(newState);

         // Process Position (Use Wrist as anchor)
         onHandMove(landmarks[0].x, landmarks[0].y);

       } else {
         // No hand detected -> Relax to Dispersed
         onGestureChange(GestureState.DISPERSED);
         onHandMove(0.5, 0.5);
       }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="absolute top-4 right-4 w-48 h-36 bg-black/50 rounded-lg overflow-hidden border border-white/20 z-50 shadow-lg">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        className="absolute w-full h-full object-cover transform -scale-x-100" // Mirror effect
      />
      <canvas 
        ref={canvasRef}
        className="absolute w-full h-full object-cover transform -scale-x-100"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
          Loading AI Model...
        </div>
      )}
      {!cameraAllowed && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-xs text-center p-2">
          Camera access required
        </div>
      )}
    </div>
  );
};

export default VisionController;