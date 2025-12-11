import * as THREE from 'three';

// Generate a random point inside a sphere
export const randomInSphere = (radius: number): THREE.Vector3 => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta),
    r * Math.cos(phi)
  );
};

// Generate a point INSIDE a 3D Heart volume
// Heart Formula:
// x = 16sin^3(t)
// y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
export const randomInHeart = (scale: number): THREE.Vector3 => {
  const t = Math.random() * Math.PI * 2;
  
  // Basic Heart Shape 2D Boundary
  let x = 16 * Math.pow(Math.sin(t), 3);
  let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  
  // Z-depth (Thickness)
  // Taper z slightly based on Y to make it look nicer
  let z = (Math.random() - 0.5) * 8; 

  // Create a vector on the "shell"
  const vec = new THREE.Vector3(x, y, z);

  // FILL THE VOLUME:
  // Scale the vector by a random factor to place it inside the shape.
  // using cbrt(random) ensures uniform density (less clustering at center)
  const r = Math.cbrt(Math.random());
  vec.multiplyScalar(r);

  return vec.multiplyScalar(scale);
};