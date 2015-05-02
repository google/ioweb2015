#extension GL_OES_standard_derivatives: enable

precision mediump float;

const float RADIUS = 0.75;
const float FILTER_PIXEL_WIDTH = 1.4142135623730951;

const float FILTER_WIDTH_FALLBACK = 0.1;

uniform vec3 markerColor;

varying vec2 localCoord;

void main() {
  // Fragment's distance from edge of circle (at RADIUS from center of quad).
  float dist = length(localCoord) - RADIUS;

  #ifdef GL_OES_standard_derivatives
    // Approximate anti-aliasing by distance function gradient in screen space.
    // TODO(bckenny): reduce termporal aliasing for pure-isotropic cases.
    float dDistdx = dFdx(dist);
    float dDistdy = dFdy(dist);
    float s = sqrt(dDistdx * dDistdx + dDistdy * dDistdy);
    float alpha = 1. - smoothstep(-0.5, 0.5, dist / (s * FILTER_PIXEL_WIDTH));
  #else
    // Without OES_standard_derivatives (~2% of users), fall back to something
    // that looks decent.
    float alpha = 1. - smoothstep(-FILTER_WIDTH_FALLBACK, FILTER_WIDTH_FALLBACK,
        dist);
  #endif

  gl_FragColor = vec4(markerColor, 1) * alpha;
}
