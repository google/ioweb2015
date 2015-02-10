precision mediump float;

varying vec3 spaceCoord;
varying vec3 globeCoord;

uniform samplerCube globeCubemap;

const vec3 sunDirection = vec3(.3, .4, 1);

void main() {
  vec3 color = textureCube(globeCubemap, globeCoord).rgb;

  vec3 normal = normalize(globeCoord);
  float light = max(0., dot(normal, normalize(sunDirection))) + .3;

  // vec3 zeroZero = vec3(0., 0., 1.);
  // float cosAngle = dot(sunDir, normalize(globeCoord));
  // float cutoff = 1. - step(0.99995, cosAngle);
  // color = mix(vec3(.7, .1, .7), color * light, cutoff);

  gl_FragColor = vec4(color * light, 1.);
}
