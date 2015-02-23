precision mediump float;

varying vec3 spaceCoord;
varying vec3 globeCoord;

uniform samplerCube globeCubeMap;

uniform vec3 sunDirection;

void main() {
  vec3 color = textureCube(globeCubeMap, globeCoord).rgb;

  vec3 normal = normalize(globeCoord);
  float light = max(0., dot(normal, normalize(sunDirection))) + .3;

  gl_FragColor = vec4(color * light, 1.);
}
