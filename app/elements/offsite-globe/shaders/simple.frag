// #extension GL_OES_standard_derivatives : enable

precision mediump float;

varying vec3 worldCoord;
varying vec3 globeCoord;

uniform samplerCube globeCubemap;

void main() {
  vec3 normal = normalize(worldCoord); //normalize(cross(dFdx(worldCoord), dFdy(worldCoord)));
  float light = max(0., dot(normal, normalize(vec3(.3, .4, 1))));
  vec3 color = textureCube(globeCubemap, normalize(globeCoord).stp).rgb;

  gl_FragColor = vec4(color * light, 1.);
}
