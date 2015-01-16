attribute vec4 coord;

uniform mat4 globeMatrix;
uniform mat4 viewMatrix;

varying vec3 worldCoord;

void main() {
  // transform to globe space
  gl_Position = viewMatrix * globeMatrix * coord;
  worldCoord = (globeMatrix * coord).xyz;
}
