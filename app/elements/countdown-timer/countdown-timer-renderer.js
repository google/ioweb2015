/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

IOWA.CountdownTimer.NumberRenderer = function(el) {

  this.canvas_ = el;
  this.ctx_ = this.canvas_.getContext('2d');

  this.width_ = 0;
  this.height_ = 0;

  this.maxRippleRadius_ = 0;
  this.unitCount_ = 1;

  this.drawX_ = 0;
  this.drawY_ = 0;
  this.letterPadding_ = 6;
  this.linePadding_ = 32;
  this.freezeCount_ = 0;
  this.skippedUnits_ = 0;

  this.colorSet_ = IOWA.CountdownTimer.Colors.Rundown[0];
  this.targetColorSet_ = this.colorSet_;
  this.nextRippleColor_ = 0;
  this.ripples_ = [];

  this.addEventListeners_();
};

IOWA.CountdownTimer.NumberRenderer.prototype = {

  baseNumberWidth_: 136,
  baseNumberHeight_: 140,
  measurements_: [140, 68, 98, 88, 100, 112, 116, 110, 108, 118],

  configureCanvas_: function() {

    var dPR = window.devicePixelRatio || 1;

    this.width_ = this.canvas_.parentElement.offsetWidth;
    this.height_ = this.canvas_.parentElement.offsetHeight;

    this.maxRippleRadius_ = Math.sqrt(
        this.width_ * this.width_ +
        this.height_ * this.height_);

    // Scale the backing store by the dPR.
    this.canvas_.width = this.width_ * dPR;
    this.canvas_.height = this.height_ * dPR;

    // Scale it back down to the width and height we want in logical pixels.
    this.canvas_.style.width = this.width_ + 'px';
    this.canvas_.style.height = this.height_ + 'px';

    // Account for any upscaling by applying a single scale transform.
    this.ctx_.scale(dPR, dPR);

    // Figure out how many units we can fit in the space.
    this.unitCount_ = 1;

    if (this.width_ > 700) {
      this.unitCount_ = 2;
    }

    if (this.width_ > 1000) {
      this.unitCount_ = 3;
    }

    if (this.width_ > 1295) {
      this.unitCount_ = 4;
    }
  },

  addEventListeners_: function() {
    this.resizeHandler = this.configureCanvas_.bind(this);
    window.addEventListener('resize', this.resizeHandler);
  },

  removeListeners_: function() {
    window.removeEventListener('resize', this.resizeHandler);
  },

  convertHSLObjectToString_: function(hslObj) {
    return 'hsla(' +
        hslObj.h + ', ' +
        hslObj.s + '%, ' +
        hslObj.l + '%, ' +
        hslObj.a + ')';
  },

  drawLine_: function(color, xStart, yStart, xEnd, yEnd) {

    if (!color.str)
      color.str = this.convertHSLObjectToString_(color);

    this.ctx_.save();
    this.ctx_.translate(0.5, 0.5);
    this.ctx_.strokeStyle = color.str;
    this.ctx_.beginPath();
    this.ctx_.moveTo(xStart, yStart);
    this.ctx_.lineTo(xEnd, yEnd);
    this.ctx_.stroke();
    this.ctx_.closePath();
    this.ctx_.restore();

  },

  drawCircle_: function(color, x, y, radius) {

    if (radius < 0)
      return;

    if (!color.str)
      color.str = this.convertHSLObjectToString_(color);

    this.ctx_.fillStyle = color.str;
    this.ctx_.beginPath();
    this.ctx_.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx_.closePath();
    this.ctx_.fill();
  },

  drawSemiCircle_: function(color, x, y, radius, startAngle) {

    if (radius < 0)
      return;

    if (!color.str)
      color.str = this.convertHSLObjectToString_(color);

    this.ctx_.fillStyle = color.str;
    this.ctx_.beginPath();
    this.ctx_.arc(x, y, radius, startAngle, startAngle + Math.PI);
    this.ctx_.closePath();
    this.ctx_.fill();
  },

  drawRhomboid_: function(color, x, y, width, height, cornerX, cornerY) {

    if (width < 0 || height < 0)
      return;

    if (!color.str)
      color.str = this.convertHSLObjectToString_(color);

    this.ctx_.fillStyle = color.str;
    this.ctx_.beginPath();

    this.ctx_.save();
    this.ctx_.translate(x, y);

    if (cornerY !== 0) {
      this.ctx_.moveTo(0, cornerY);
      this.ctx_.lineTo(width, 0);
      this.ctx_.lineTo(width, height);
      this.ctx_.lineTo(0, height + cornerY);
    } else {
      this.ctx_.moveTo(0, 0);
      this.ctx_.lineTo(width, 0);
      this.ctx_.lineTo(width + cornerX, height);
      this.ctx_.lineTo(cornerX, height);
    }

    this.ctx_.closePath();
    this.ctx_.fill();
    this.ctx_.restore();
  },

  setShadow_: function(color, blur, offsetY) {

    this.ctx_.shadowColor = color;
    this.ctx_.shadowBlur = blur;
    this.ctx_.shadowOffsetY = offsetY;
  },

  0: function(time, direction) {

    var semiCircleTopYOffset = 14;
    var semiCircleBottomYOffset = 2;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);

    function in_() {

      // Circle Bottom
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleBottomYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * semiCircleBottomYOffset);
      this.drawSemiCircle_(this.colorSet_.medium,
          64, 64, 64, 0);
      this.ctx_.restore();

      // Circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 14,
          time * semiCircleTopYOffset);
      this.drawSemiCircle_(this.colorSet_.dark, 64, 64, 64,
          -Math.PI);
      this.ctx_.restore();

      this.ctx_.globalAlpha = (1 - time);
      this.setShadow_('', 0, 0);
      this.drawCircle_(this.colorSet_.background, 64, 64, 66);

    }

    function out_() {

      var circleBottomTime = time - ((1 - time) * 1.2);

      // Circle Bottom
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * semiCircleBottomYOffset);
      this.drawSemiCircle_(this.colorSet_.medium, 64,
          64 + (1 - circleBottomTime) * 32, circleBottomTime * 64, 0);

      // Circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 14,
          time * semiCircleTopYOffset);
      this.drawSemiCircle_(this.colorSet_.dark, 64,
          64 - (1 - time) * 32, time * 64, -Math.PI);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;

  },

  1: function(time, direction) {

    var circleYOffset = 10;
    var rhomboidYOffset = 4;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[1]) * 0.5, 0);

    function in_() {

      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.light,
          16, 0, 40, 126, 0, 0);
      this.ctx_.restore();

      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(this.colorSet_.dark, 14, 20, 20);
      this.ctx_.restore();

    }

    function out_() {

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.light, 16,
          (1 - time) * 64, 40, time * 126, 0, 0);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(this.colorSet_.dark, 14, 20,
          time * 20);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  2: function(time, direction) {

    var circleYOffset = 10;
    var semiCircleYOffset = 2;
    var rhomboidYOffset = 4;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[2]) * 0.5, 0);

    function in_() {

      // Semi-circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * semiCircleYOffset);
      this.drawSemiCircle_(this.colorSet_.medium,
          40, 48, 48, -Math.PI * 0.5);
      this.ctx_.restore();

      // Rhomboid
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.light, 0, 94, 88,
          32, 0, 0);
      this.ctx_.restore();

      // Circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(this.colorSet_.dark, 19, 20, 20);
      this.ctx_.restore();
    }

    function out_() {

      var semiCircleTime = time - ((1 - time) * 1.1);
      var rhomboidTime = time - ((1 - time) * 1.05);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * semiCircleYOffset);
      this.drawSemiCircle_(this.colorSet_.medium,
          40 + (1 - semiCircleTime) * 24, 48,
          semiCircleTime * 48, -Math.PI * 0.5);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.light,
          (1 - rhomboidTime) * 49, 94, rhomboidTime * 88, 32, 0, 0);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(this.colorSet_.dark, 19, 20, time * 20);
    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  3: function(time, direction) {

    var circleTopYOffset = 10;
    var circleBottomYOffset = 14;
    var semiCircleTopYOffset = 6;
    var semiCircleBottomYOffset = 2;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[3]) * 0.5, 0);

    function in_() {

      // Semi-circle Bottom
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleBottomYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * semiCircleBottomYOffset);
      this.drawSemiCircle_(this.colorSet_.medium,
          34, 86, 42, -Math.PI * 0.5);
      this.ctx_.restore();

      // Semi-circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * semiCircleTopYOffset);
      this.drawSemiCircle_(this.colorSet_.light,
          34, 32, 32, -Math.PI * 0.5);
      this.ctx_.restore();

      // Circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * circleTopYOffset);
      this.drawCircle_(this.colorSet_.medium,
          13, 20, time * 20);
      this.ctx_.restore();

      // Circle Bottom
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleBottomYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleBottomYOffset);
      this.drawCircle_(this.colorSet_.dark,
          13, 108, time * 20);
      this.ctx_.restore();

    }

    function out_() {

      var semiCircleTopTime = time - ((1 - time) * 1.1);
      var semiCircleBottomTime = time - ((1 - time) * 1.05);

      // Semi-circle Bottom
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * semiCircleBottomYOffset);
      this.drawSemiCircle_(this.colorSet_.medium,
          34 + ((1 - semiCircleBottomTime) * 21), 86,
          semiCircleBottomTime * 42, -Math.PI * 0.5);

      // Semi-circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * semiCircleTopYOffset);
      this.drawSemiCircle_(this.colorSet_.light,
          34 + ((1 - semiCircleTopTime) * 16), 32,
          semiCircleTopTime * 32, -Math.PI * 0.5);

      // Circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * circleTopYOffset);
      this.drawCircle_(this.colorSet_.medium,
          13, 20, time * 20);

      // Circle Bottom
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleBottomYOffset);
      this.drawCircle_(this.colorSet_.dark,
          13, 108, time * 20);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  4: function(time, direction) {

    var rectangleYOffset = 2;
    var rhomboidYOffset = 12;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[4]) * 0.5, 0);

    function in_() {

      // Left rhomboid.
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.light, 0, 0,
          40, 80, 0, .01);
      this.ctx_.restore();

      // Right rectangle.
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rectangleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * rectangleYOffset);
      this.drawRhomboid_(this.colorSet_.medium, 48, 0,
          40, 128, 0, 0);
      this.ctx_.restore();
    }

    function out_() {

      var rectangleTime = time - ((1 - time) * 1.1);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.light, 0,
          0 + (1 - time) * 44, 40, time * 80, 0, .01);

      // Right rectangle.
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * rectangleYOffset);
      this.drawRhomboid_(this.colorSet_.medium, 48,
          (1 - rectangleTime) * 64, 40, rectangleTime * 128, 0, 0);
    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  5: function(time, direction) {

    var circleYOffset = 14;
    var semiCircleYOffset = 2;
    var rhomboidYOffset = 8;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[5]) * 0.5, 0);

    function in_() {

      // Semi-circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * semiCircleYOffset);
      this.drawSemiCircle_(this.colorSet_.light, 51, 80,
          48, -Math.PI * 0.5);
      this.ctx_.restore();

      // Rhomboid
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 10,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.medium, 4, 0, 88, 32,
          0, 0);
      this.ctx_.restore();

      // Circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(this.colorSet_.dark, 24, 56, 24);
      this.ctx_.restore();

    }

    function out_() {

      var semiCircleTime = time - ((1 - time) * 1.1);
      var rhomboidTime = time - ((1 - time) * 1.05);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * semiCircleYOffset);
      this.drawSemiCircle_(this.colorSet_.light,
          51 + (1 - semiCircleTime) * 24, 80, semiCircleTime * 48,
          -Math.PI * 0.5);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 10,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.medium,
          4 + (1 - rhomboidTime) * 44, 0, rhomboidTime * 88, 32, 0, 0);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(this.colorSet_.dark, 24, 56, time * 24);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  6: function(time, direction) {

    var circleYOffset = 4;
    var rhomboidYOffset = 8;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[6]) * 0.5, 0);

    function in_() {

      // Circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * circleYOffset);
      this.drawCircle_(this.colorSet_.medium, 54, 80, 48);
      this.ctx_.restore();

      // Rhomboid
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.dark, 6, 0,
          40, 80, 0, 0.01);
      this.ctx_.restore();

    }

    function out_() {

      var circleTime = time - ((1 - time) * 1.15);

      // Circle
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * circleYOffset);
      this.drawCircle_(this.colorSet_.medium, 54, 80,
          circleTime * 48);

      // Rhomboid
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * rhomboidYOffset);
      this.drawRhomboid_(this.colorSet_.dark,
          6 + (1 - time) * 20, 0, time * 40, 80, 0, 0.01);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  7: function(time, direction) {

    var rhomboidTopYOffset = 8;
    var rhomboidRightYOffset = 2;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[7]) * 0.5, 0);

    function in_() {

      // Rhomboid Right
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidRightYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * rhomboidRightYOffset);
      this.drawRhomboid_(this.colorSet_.medium,
          57, 6, 40, 120, 0, 0.01);
      this.ctx_.restore();

      // Rhomboid Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 12, time * rhomboidTopYOffset);
      this.drawRhomboid_(this.colorSet_.light,
          0, 0, 88, 40, 0, 0.01);
      this.ctx_.restore();
    }

    function out_() {

      var rhomboidTopTime = time - ((1 - time) * 1.15);

      // Rhomboid Right
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 2, time * rhomboidRightYOffset);
      this.drawRhomboid_(this.colorSet_.medium,
          57 + (1 - rhomboidTopTime) * 20.5, 6,
          rhomboidTopTime * 40, 120, 0, 0);

      // Rhomboid Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 12, time * rhomboidTopYOffset);
      this.drawRhomboid_(this.colorSet_.light,
          (1 - time) * 38.5, 0, time * 88, 40, 0, 0);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  8: function(time, direction) {

    var circleTopYOffset = 14;
    var circleBottomYOffset = 1;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[8]) * 0.5, 0);

    function in_() {

      // Circle Bottom
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleBottomYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time,
          time * circleBottomYOffset);
      this.drawCircle_(this.colorSet_.medium, 48, 80, 48);
      this.ctx_.restore();

      // Circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 14,
          time * circleTopYOffset);
      this.drawCircle_(this.colorSet_.dark, 48, 36, 36);
      this.ctx_.restore();

    }

    function out_() {

      var circleBottomTime = time - ((1 - time) * 1.2);

      // Circle Bottom
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time,
          time * circleBottomYOffset);
      this.drawCircle_(this.colorSet_.medium, 48, 80,
          circleBottomTime * 48);

      // Circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 14, time * circleTopYOffset);
      this.drawCircle_(this.colorSet_.dark, 48, 36, time * 36);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  9: function(time, direction) {

    var circleTopYOffset = 1;
    var rhomboidRightYOffset = 8;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[9]) * 0.5, 0);

    function in_() {

      // Circle Top

      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time, time * circleTopYOffset);
      this.drawCircle_(this.colorSet_.medium, 48, 48, 48);
      this.ctx_.restore();

      // Rhomboid Right
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidRightYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 8, time * rhomboidRightYOffset);
      this.drawRhomboid_(this.colorSet_.light,
          56, 6, 41, 120, 0, 0);
      this.ctx_.restore();

    }

    function out_() {

      var circleTopTime = time - ((1 - time) * 1.2);

      // Circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, circleTopTime,
          circleTopTime * circleTopYOffset);
      this.drawCircle_(this.colorSet_.medium,
          48, 48, circleTopTime * 48);

      // Rhomboid Right
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 8, time * rhomboidRightYOffset);
      this.drawRhomboid_(this.colorSet_.light,
          56 + (1 - time) * 20.5, 6, time * 41, 120, 0, 0);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  clear: function() {

    if (!this.colorSet_.background.str) {
      this.colorSet_.background.str = this.convertHSLObjectToString_(
          this.colorSet_.background);
    }

    this.ctx_.fillStyle = this.colorSet_.background.str;
    this.ctx_.fillRect(0, 0, this.width_, this.height_);
    this.drawX_ = 0;
    this.drawY_ = 0;

  },

  ripple: function(rippleColor) {

    var start = Date.now();

    if (typeof rippleColor === 'undefined') {
      rippleColor = {
        background: {h:360,s:100,l:100,a:1},
        alphaStart: 0.2,
        alphaEnd: 0,
        setBackgroundOnComplete: false,
        updateColorSetOnRipple: false
      }
    }

    // Default to the ripple's colors taking over on complete.
    if (typeof rippleColor.setBackgroundOnComplete === 'undefined')
      rippleColor.setBackgroundOnComplete = true;

    if (typeof rippleColor.updateColorSetOnRipple === 'undefined')
      rippleColor.updateColorSetOnRipple = true;

    var x = (this.width_ + this.baseNumberWidth_) * 0.5;

    // Adjust the location of the ripple based on the number of units shown.
    if (this.unitCount_ === 2) {
      x += this.linePadding_ + this.baseNumberWidth_;
    } else if (this.unitCount_ === 3) {
      x += this.baseNumberWidth_ +
          this.linePadding_ +
          this.linePadding_ +
          this.baseNumberWidth_;
    } else if (this.unitCount_ === 4) {
      x += this.linePadding_ +
          this.baseNumberWidth_ +
          this.baseNumberWidth_ +
          this.linePadding_ +
          this.linePadding_ +
          this.baseNumberWidth_;
    }

    this.ripples_.push({
      start: start,
      end: start + 2800,
      x: x,
      y: this.height_ * 0.5,
      color: rippleColor
    });

  },

  drawDividerLine_: function() {
    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate(this.linePadding_, -this.linePadding_);
    this.drawLine_(IOWA.CountdownTimer.Colors.Divider,
          0, 0, 0, this.baseNumberHeight_ + this.linePadding_ +
          this.linePadding_ * 0.5);
    this.drawX_ += (this.linePadding_ * 2);
    this.ctx_.restore();
  },

  convertValueObjectToString_: function(valuesAsArray) {

    var valueAsString = '';
    var unitsLeftToAdd = this.unitCount_;
    var skipLeadingZeroValues = true;

    this.skippedUnits_ = 0;

    for (var v = 0; v < valuesAsArray.length; v++) {

      // Don't skip zero values when we need to fill out
      // to meet the unit count.
      if (v >= valuesAsArray.length - this.unitCount_)
        skipLeadingZeroValues = false;

      if (skipLeadingZeroValues && valuesAsArray[v] === '00') {
        this.skippedUnits_++;
        continue;
      }

      // As soon as we find a non-zero value we stop skipping.
      skipLeadingZeroValues = false;

      if (unitsLeftToAdd === 0)
        break;

      if (valueAsString !== '')
        valueAsString += '|';

      valueAsString += valuesAsArray[v];
      unitsLeftToAdd--;
    }

    return valueAsString;

  },

  drawLabels_: function(valuesAsArray) {

    var labelX = this.drawX_;
    var labelY = this.drawY_ + this.baseNumberHeight_ + 48;
    var labelStepX = 2 * this.baseNumberWidth_ + 2 * this.linePadding_;
    var unitsLeftToAdd = this.unitCount_;
    var labelText = '';
    var skipLeadingZeroValues = true;

    this.ctx_.fillStyle = IOWA.CountdownTimer.Colors.Label;
    this.ctx_.font = '500 14px Roboto';

    for (var v = 0; v < valuesAsArray.length; v++) {

      // Don't skip zero values when we need to fill out
      // to meet the unit count.
      if (v >= valuesAsArray.length - this.unitCount_)
        skipLeadingZeroValues = false;

      if (skipLeadingZeroValues && valuesAsArray[v] === '00')
        continue;

      // As soon as we find a non-zero value we stop skipping.
      skipLeadingZeroValues = false;

      if (unitsLeftToAdd === 0)
        break;

      switch (v) {
        case 0:
          labelText = 'DAY' + (valuesAsArray[v] !== '01' ? 'S' : '');
          break;

        case 1:
          labelText = 'HOUR' + (valuesAsArray[v] !== '01' ? 'S' : '');
          break;

        case 2:
          labelText = 'MINUTE' + (valuesAsArray[v] !== '01' ? 'S' : '');
          break;

        case 3:
          labelText = 'SECOND' + (valuesAsArray[v] !== '01' ? 'S' : '');
          break;
      }

      this.ctx_.fillText(labelText, labelX, labelY);
      labelX += labelStepX;
      unitsLeftToAdd--;
    }
  },

  easeColorSetValues_: function() {

    var numEasing = 0.07;

    this.colorSet_.dark.h +=
        (this.targetColorSet_.dark.h - this.colorSet_.dark.h) * numEasing;
    this.colorSet_.dark.s +=
        (this.targetColorSet_.dark.s - this.colorSet_.dark.s) * numEasing;
    this.colorSet_.dark.l +=
        (this.targetColorSet_.dark.l - this.colorSet_.dark.l) * numEasing;
    this.colorSet_.dark.a +=
        (this.targetColorSet_.dark.a - this.colorSet_.dark.a) * numEasing;

    // Update the string version.
    this.colorSet_.dark.str =
        this.convertHSLObjectToString_(this.colorSet_.dark);

    this.colorSet_.medium.h +=
        (this.targetColorSet_.medium.h - this.colorSet_.medium.h) * numEasing;
    this.colorSet_.medium.s +=
        (this.targetColorSet_.medium.s - this.colorSet_.medium.s) * numEasing;
    this.colorSet_.medium.l +=
        (this.targetColorSet_.medium.l - this.colorSet_.medium.l) * numEasing;
    this.colorSet_.medium.a +=
        (this.targetColorSet_.medium.a - this.colorSet_.medium.a) * numEasing;

    this.colorSet_.medium.str =
        this.convertHSLObjectToString_(this.colorSet_.medium);

    this.colorSet_.light.h +=
        (this.targetColorSet_.light.h - this.colorSet_.light.h) * numEasing;
    this.colorSet_.light.s +=
        (this.targetColorSet_.light.s - this.colorSet_.light.s) * numEasing;
    this.colorSet_.light.l +=
        (this.targetColorSet_.light.l - this.colorSet_.light.l) * numEasing;
    this.colorSet_.light.a +=
        (this.targetColorSet_.light.a - this.colorSet_.light.a) * numEasing;

    this.colorSet_.light.str =
        this.convertHSLObjectToString_(this.colorSet_.light);
  },

  draw: function(value, time, direction) {

    if (this.width_ === 0 && this.height_ === 0)
      this.configureCanvas_();

    var valuesAsArray = [
        this.convertNumberToStringAndPadIfNeeded_(value.days),
        this.convertNumberToStringAndPadIfNeeded_(value.hours),
        this.convertNumberToStringAndPadIfNeeded_(value.minutes),
        this.convertNumberToStringAndPadIfNeeded_(value.seconds)];

    var valueAsString = this.convertValueObjectToString_(valuesAsArray);
    var metrics = {
      width: (this.unitCount_ * 2 * this.baseNumberWidth_) +
          (this.unitCount_ - 1) * 2 * this.linePadding_,
      height: this.baseNumberHeight_
    };
    var characterTime = time;

    var now = Date.now();

    var ripple;
    var rippleRadius;
    var rippleDuration;
    var rippleTime;
    var rippleAlpha;
    var rippleTimeNormalized;

    for (var r = 0; r < this.ripples_.length; r++) {
      ripple = this.ripples_[r];

      if (now > ripple.end) {

        if (ripple.color.setBackgroundOnComplete) {

          this.colorSet_.background.h = ripple.color.background.h;
          this.colorSet_.background.s = ripple.color.background.s;
          this.colorSet_.background.l = ripple.color.background.l;
          this.colorSet_.background.a = ripple.color.background.a;

          this.colorSet_.background.str =
              this.convertHSLObjectToString_(this.colorSet_.background);
        }

        this.ripples_.splice(r--, 1);
      }

      rippleDuration = ripple.end - ripple.start;
      rippleTime = now - ripple.start;
      rippleTimeNormalized = Math.min(1, rippleTime / rippleDuration);
      rippleRadius = IOWA.CountdownTimer.Easing(rippleTimeNormalized) *
          this.maxRippleRadius_;
      rippleAlpha = ripple.color.alphaStart +
          IOWA.CountdownTimer.Easing(rippleTimeNormalized) *
          (ripple.color.alphaEnd - ripple.color.alphaStart);

      // If we don't set a ripple alpha assume 1.
      if (typeof ripple.color.alphaStart === 'undefined') {
        rippleAlpha = 1;
      }

      // Only update the color set once.
      if (ripple.color.updateColorSetOnRipple) {
        ripple.color.updateColorSetOnRipple = false;

        this.targetColorSet_ = ripple.color;
      }

      this.ctx_.save();
      this.ctx_.globalAlpha = rippleAlpha;
      this.drawCircle_(ripple.color.background,
          ripple.x, ripple.y, rippleRadius);
      this.ctx_.restore();
    }

    this.easeColorSetValues_();

    this.drawX_ = Math.round((this.width_ - metrics.width) * 0.5);
    this.drawY_ = Math.round((this.height_ - metrics.height) * 0.5);

    this.drawLabels_(valuesAsArray);

    this.ctx_.strokeStyle = 'rgba(0,0,0,0.3)';
    this.ctx_.fillStyle = '#000';

    // The freeze count is based on a full complement of units, so
    // if we haven't got that we need to adjust.
    var toFreeze = this.freezeCount_;
    var toFreezeAdjustment = this.skippedUnits_ * 3;
    toFreeze -= toFreezeAdjustment;

    // Characters
    for (var i = 0; i < valueAsString.length; i++) {

      // Reset the time and set it to 1 if the character is frozen.
      characterTime = time;

      if (i < toFreeze)
        characterTime = 1;

      this.ctx_.save();

      if (valueAsString[i] === '|') {
        this.drawDividerLine_();
      } else {
        this.ctx_.translate(this.letterPadding_, this.letterPadding_);
        this[valueAsString[i]](characterTime, direction);
      }

      this.ctx_.restore();
    }

  },

  convertNumberToStringAndPadIfNeeded_: function(value) {
    var str = Number(value).toString();
    if (value < 10)
      str = '0' + str;

    return str;
  },

  setNextValueForFreezing: function(value, freezeValue) {

    // If it's the zero value, just call it.
    if (value.days ===  0 && value.hours === 0 &&
        value.minutes === 0 && value.seconds === 0) {
      this.freezeCount_ = Number.MAX_VALUE;
      return;
    }

    var daysValueAsString =
        this.convertNumberToStringAndPadIfNeeded_(value.days);
    var hoursValueAsString =
        this.convertNumberToStringAndPadIfNeeded_(value.hours);
    var minutesValueAsString =
        this.convertNumberToStringAndPadIfNeeded_(value.minutes);
    var secondsValueAsString =
        this.convertNumberToStringAndPadIfNeeded_(value.seconds);

    var freezeDaysValueAsString =
        this.convertNumberToStringAndPadIfNeeded_(freezeValue.days);
    var freezeHoursValueAsString =
        this.convertNumberToStringAndPadIfNeeded_(freezeValue.hours);
    var freezeMinutesValueAsString =
        this.convertNumberToStringAndPadIfNeeded_(freezeValue.minutes);
    var freezeSecondsValueAsString =
        this.convertNumberToStringAndPadIfNeeded_(freezeValue.seconds);

    var valueAsString = daysValueAsString + "|" +
      hoursValueAsString + "|" +
      minutesValueAsString + "|" +
      secondsValueAsString;

    var freezeValueAsString = freezeDaysValueAsString + "|" +
      freezeHoursValueAsString + "|" +
      freezeMinutesValueAsString + "|" +
      freezeSecondsValueAsString;

    // The very last character should always be different so never freeze it.
    for (var i = 0; i < valueAsString.length; i++) {

      this.freezeCount_ = i;

      if (valueAsString[i] !== freezeValueAsString[i])
        break;
    }

  },

  init: function() {
    this.configureCanvas_();
  },

  destroy: function() {
    this.removeListeners_();
  }
};
