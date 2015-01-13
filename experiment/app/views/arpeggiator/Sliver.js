var PIXI = require('pixi.js/bin/pixi.dev.js');
var { vec2, Utils: { ARRAY_TYPE } } = require('p2');
var FloatRange = require('toxiclibsjs/lib/toxi/util/datatypes/FloatRange');
var ColorGradient = require('toxiclibsjs/lib/toxi/color/ColorGradient');
var animate = require('app/util/animate');

module.exports = (function() {
  'use strict';

  const ARPEGGIATOR_COLORS = require('app/data/arp-colors.json');
  const MAX_RADIUS = ARPEGGIATOR_COLORS.centerRadius;
  const SAFE_ZONE = 1.0 - ARPEGGIATOR_COLORS.safeZone;
  const SHADOW_RANG = new FloatRange(0.3, 0);
  const CENTER_RANGE = new FloatRange(0, MAX_RADIUS);

  var distanceGradients = {};

  return function Sliver(container, polygon, depth, colorSets, hasLeftShadow, hasRightShadow, highlight) {
    const SHADOW_LENGTH = 15 * (1 + (1 - depth / 3));

    const [
      COLOR_A,
      COLOR_B,
      COLOR_C,
      COLOR_D,
      CENTER_COLOR
    ] = colorSets;

    const WINDOW_RANGE = new FloatRange(0, 360);

    const DEPTH_GRADIENT = new ColorGradient();
    DEPTH_GRADIENT.addColorAt(WINDOW_RANGE.getAt(0.0), COLOR_A);
    DEPTH_GRADIENT.addColorAt(WINDOW_RANGE.getAt(0.25), COLOR_B);
    DEPTH_GRADIENT.addColorAt(WINDOW_RANGE.getAt(0.5), COLOR_C);
    DEPTH_GRADIENT.addColorAt(WINDOW_RANGE.getAt(0.75), COLOR_D);
    DEPTH_GRADIENT.addColorAt(WINDOW_RANGE.getAt(1.0), COLOR_A);

    const COLORS = DEPTH_GRADIENT.calcGradient(0, 360).colors;

    var color;

    var startVec = vec2.create();
    var endVec = vec2.create();
    var outputVec = vec2.create();

    var center = new ARRAY_TYPE(2);
    center[0] = polygon.points[0];
    center[1] = polygon.points[1];

    var gfx = new PIXI.Graphics();
    container.addChild(gfx);

    var mask = new PIXI.Graphics();
    container.addChild(mask);
    container.mask = mask;
    
    var shadow = new PIXI.Graphics();

    gfx.addChild(shadow);

    // Init.
    updateCenterPoint(center[0], center[1]);

    /**
     * Zero-allocation vector match to calculate shadows.
     */
    function renderShadow(movement, x1, y1, x2, y2, reverse, opacity) {
      vec2.set(startVec, x1, y1);
      vec2.set(endVec, x2, y2);

      vec2.subtract(outputVec, endVec, startVec);
      vec2.normalize(outputVec, outputVec);
      vec2.scale(outputVec, outputVec, movement);
      vec2.rotate(outputVec, outputVec, (Math.PI / 2) * (reverse ? -1 : 1));

      vec2.add(startVec, outputVec, startVec);
      vec2.add(endVec, outputVec, endVec);

      shadow.lineStyle(1, 0x000000, opacity);
      shadow.moveTo(startVec[0], startVec[1]);
      shadow.lineTo(endVec[0], endVec[1]);
    }

    function getDistanceGradientColors(degrees, distance) {
      if (distanceGradients[degrees] && distanceGradients[degrees][distance]) {
        return distanceGradients[degrees][distance];
      }

      var distanceGradient = new ColorGradient();
      distanceGradient.addColorAt(CENTER_RANGE.getAt(0), COLORS[degrees]);
      if (SAFE_ZONE < 1.0) {
        distanceGradient.addColorAt(CENTER_RANGE.getAt(SAFE_ZONE), CENTER_COLOR);
      }
      distanceGradient.addColorAt(CENTER_RANGE.getAt(1.0), CENTER_COLOR);

      var dColors = distanceGradient.calcGradient(0, MAX_RADIUS+1).colors;
      distanceGradients[degrees] = distanceGradients[degrees] || {};
      distanceGradients[degrees][distance] = dColors;

      return dColors;
    }

    function updateColor(degrees, distance) {
      if (distance >= MAX_RADIUS) {
        color = COLORS[degrees].toInt();
        return;
      }

      var dColors = getDistanceGradientColors(degrees, distance);
      color = dColors[MAX_RADIUS-distance].toInt();
    }

    function render() {
      polygon.points[0] = center[0];
      polygon.points[1] = center[1];

      gfx.clear();
      gfx.beginFill(color);
      gfx.drawShape(polygon);
      mask.clear();
      mask.beginFill(color);
      mask.drawShape(polygon);

      shadow.clear();

      if (hasLeftShadow) {
        drawShadow(polygon.points[0], polygon.points[1], polygon.points[4], polygon.points[5], true);
      }

      if (hasRightShadow) {
        drawShadow(polygon.points[0], polygon.points[1], polygon.points[2], polygon.points[3]);
      }

      if (highlight > 0) {
        gfx.beginFill(0xffffff, highlight);
        gfx.drawShape(polygon);
      }
    }

    function drawShadow(x1, y1, x2, y2, reverse) {
      for (let i = 0; i < SHADOW_LENGTH; i++) {
        renderShadow(i, x1, y1, x2, y2, reverse, SHADOW_RANG.getAt(1 - i / (SHADOW_LENGTH-1)));
      }
    }

    function updateCenterPoint(x, y) {
      center[0] = x;
      center[1] = y;

      var angle = Math.atan2(-y, x);
      var degrees = angle * 180 / Math.PI;
      degrees = (degrees + 360) % 360;

      var distance = ~~Math.abs(Math.sqrt((x * x) + (y * y)));

      updateColor(~~degrees, distance);
      render();
    }

    function updateHighlight(h) {
      highlight = h;
      render();
    }

    var tweenInfo = { highlight: 0.2 };
    var tweenTarget = { highlight: 0, onUpdate: onUpdate };
    function pulse() {
      tweenInfo.highlight = 0.2;
      animate.to(tweenInfo, 0.5, tweenTarget);
    }
    
    function onUpdate() {
      updateHighlight(tweenInfo.highlight);
    }

    return {
      render: render,
      updateCenterPoint: updateCenterPoint,
      updateHighlight: updateHighlight,
      pulse: pulse
    };
  };
})();
