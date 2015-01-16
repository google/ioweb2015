#extension GL_OES_standard_derivatives : enable

precision mediump float;

varying vec3 worldCoord;

void main() {
  vec3 normal = normalize(cross(dFdx(worldCoord), dFdy(worldCoord)));
  float light = max(0., dot(normal, normalize(vec3(1, 1, 1))));

  gl_FragColor = vec4(light, light, light, 1.);
}
