export enum GestureState {
  DISPERSED = 'DISPERSED', // Open Hand
  FORMED = 'FORMED',       // Fist
  ROTATING = 'ROTATING',   // V-Sign (Peace)
  FOCUSED = 'FOCUSED',     // Pinch
  LOADING = 'LOADING'
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}