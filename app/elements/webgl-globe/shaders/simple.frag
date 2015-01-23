precision mediump float;

varying vec3 spaceCoord;
varying vec3 globeCoord;

uniform samplerCube globeCubemap;

const vec3 sunDirection = vec3(.3, .4, 1);

void main() {
  vec3 color = textureCube(globeCubemap, globeCoord.stp).rgb;

  vec3 normal = normalize(spaceCoord);
  float light = max(0., dot(normal, normalize(sunDirection)));

  gl_FragColor = vec4(color * light, 1.);
}
