precision mediump float;

uniform samplerCube globeCubeMap;
uniform samplerCube nightCubeMap;

varying vec3 globeCoord;
varying vec3 atmosphereGlow;
varying vec3 surfaceAttenuation;

const float nightCrossover = .05;
const vec3 lightsColor = vec3(.98, .93, .6) * .7;
const vec3 nightGroundScale = vec3(.1, .1, .25);

void main() {
  vec3 groundColor = textureCube(globeCubeMap, globeCoord).rgb;
  vec3 extrasColor = textureCube(nightCubeMap, globeCoord).rgb;

  // Blending coefficient for when surface light is less than nightCrossover.
  float attenuation = dot(surfaceAttenuation, surfaceAttenuation);
  float nightScale = max(0., 1. - attenuation / nightCrossover);
  nightScale *= nightScale;

  // Night is the city lights texture + a blue-shifted version of blue marble.
  vec3 nightLights = extrasColor * lightsColor;
  vec3 nightGround = groundColor * nightGroundScale;
  vec3 nightColor = (nightLights + nightGround) * nightScale;

  vec3 color = atmosphereGlow + groundColor * surfaceAttenuation + nightColor;

  gl_FragColor = vec4(color, 1.);
}
