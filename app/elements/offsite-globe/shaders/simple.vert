attribute vec4 coord;

uniform mat4 globeMatrix;
uniform mat4 viewMatrix;

varying vec3 worldCoord;

void main() {
  vec4 normalized = vec4(normalize(coord.xyz), 1.);

  // transform to globe space
  gl_Position = viewMatrix * globeMatrix * normalized;
  worldCoord = (globeMatrix * normalized).xyz;
}
