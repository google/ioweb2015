precision mediump float;

varying vec3 spaceCoord;
varying vec3 globeCoord;

uniform samplerCube globeCubemap;

const vec3 sunDirection = vec3(.3, .4, 1);

void main() {
  vec3 color = textureCube(globeCubemap, globeCoord).rgb;

  vec3 normal = normalize(globeCoord);
  float light = max(0., dot(normal, normalize(sunDirection))) + .3;

  gl_FragColor = vec4(color * light, 1.);
}
