// Based on Sean O'Neil's Atmospheric scattering vertex shader from GPU Gems 2
// Kr = 0.0025; // Rayleigh scattering constant
// Km = 0.0015; // Mie scattering constant
// ESun = 15.0; // Sun brightness constant

// The radius of the atmosphere (1.025), squared.
const float OUTER_RADIUS_2 = 1.050625;

// Reciprocal of the atmosphere thickness - 1 / (1.025 - 1) 
const float THICKNESS_SCALE = 40.;

// THICKNESS_SCALE normalized by height of the atmosphere's average density
// (THICKNESS_SCALE / 0.25)
const float DENSITY_SCALE = 160.;

// Out-scattering constants by wavelength.
// 1 / pow(vec3(.650, .570, .475), 4) * (Kr * 4PI) + (Km * 4PI)
const vec3 OUT_BY_WAVELENGTH = vec3(0.194842982, 0.31646156388, 0.635977816);

// In-scattering summation constants by wavelength.
// 1 / pow(vec3(.650, .570, .475), 4) * (Kr * ESun) + (Km * ESun)
const vec3 IN_BY_WAVELENGTH = vec3(0.232576678, 0.377748166, 0.759142598);

// exp(-1)
const float INV_E = 0.36787944117144233;

// Number of sample rays to use for integration.
const float NUM_SAMPLES = 16.;

attribute vec4 coord;

uniform mat4 mvpMatrix;
uniform vec3 sunDirection;
uniform vec3 cameraPos;

varying vec3 globeCoord;
varying vec3 atmosphereGlow;
varying vec3 surfaceAttenuation;

float scale(float fCos) {
  float x = 1. - fCos;
  return 0.25 * exp(-0.00287 + x * (0.459 + x * (3.83 + x * (-6.80 + x * 5.25))));
}

void main() {
  // All calculations done in canonical globe space.
  vec3 normalizedCoord = normalize(coord.xyz);
  globeCoord = normalizedCoord;

  gl_Position = mvpMatrix * vec4(normalizedCoord, 1.);

  // Get the ray from the camera to its end at the vertex.
  vec3 v3Pos = normalizedCoord;
  vec3 v3Ray = v3Pos - cameraPos;
  float fFar = length(v3Ray);
  v3Ray /= fFar;

  // Calculate the closest intersection of the ray with the outer atmosphere.
  float s = dot(cameraPos, v3Ray);
  float m2 = dot(cameraPos, cameraPos) - s * s;
  float fNear = -(s + sqrt(max(0., OUTER_RADIUS_2 - m2)));

  float atmosphereLength = fFar - fNear;
  vec3 v3Start = cameraPos + v3Ray * fNear;

  // Calculate the ray's starting position, then calculate its scattering offset
  // Note: this needs to be maintained at exp(-1) to render correctly.
  float fDepth = INV_E;
  float fCameraAngle = dot(-v3Ray, v3Pos);
  float fCameraScale = scale(fCameraAngle);
  float fLightAngle = dot(sunDirection, v3Pos);
  float fLightScale = scale(fLightAngle);

  float fCameraOffset = fDepth * fCameraScale;
  float fTemp = fLightScale + fCameraScale;

  // Scattering loop variables.
  float fSampleLength = atmosphereLength / NUM_SAMPLES;
  float fScaledLength = fSampleLength * THICKNESS_SCALE;
  vec3 v3SampleRay = v3Ray * fSampleLength;
  vec3 v3SamplePoint = v3Start + v3SampleRay * 0.5;

  // Loop over atmosphere sample points.
  vec3 v3FrontColor = vec3(0., 0., 0.);
  vec3 v3Attenuate;
  for (float i = 0.; i < NUM_SAMPLES; i++) {
    float fHeight = length(v3SamplePoint);
    float fDepth = exp(DENSITY_SCALE * (1. - fHeight));
    float fScatter = fDepth * fTemp - fCameraOffset;
    v3Attenuate = exp(-fScatter * OUT_BY_WAVELENGTH);
    v3FrontColor += v3Attenuate * (fDepth * fScaledLength);
    v3SamplePoint += v3SampleRay;
  }

  atmosphereGlow = v3FrontColor * IN_BY_WAVELENGTH;

  // Calculate the attenuation factor for the ground.
  surfaceAttenuation = v3Attenuate;
}
