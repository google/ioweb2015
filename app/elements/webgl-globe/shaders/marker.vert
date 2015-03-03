attribute vec4 coord;
attribute vec2 uvCoord;

uniform mat4 mvpMatrix;

varying vec2 localCoord;

void main() {
  gl_Position = mvpMatrix * coord;

  localCoord = uvCoord;
}
