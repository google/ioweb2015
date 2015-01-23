attribute vec4 coord;

uniform mat4 globeMatrix;
uniform mat4 viewMatrix;

varying vec3 spaceCoord;
varying vec3 globeCoord;

void main() {
  vec4 normalizedCoord = vec4(normalize(coord.xyz), 1.);

  // transform to globe space
  gl_Position = viewMatrix * globeMatrix * normalizedCoord;
  spaceCoord = (globeMatrix * normalizedCoord).xyz;
  globeCoord = normalizedCoord.xyz;
}
