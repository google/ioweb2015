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

IOWA.CountdownTimer.Element = function(el) {

  this.renderer_ = new IOWA.CountdownTimer.NumberRenderer(el);
  this.renderer_.init();

  this.currentCountdownValue_ = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  };

  this.nextCountdownValue_ = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  };

  this.targetDayCountValue_ = 0;
  this.targetDate_ = 0;
  this.needToFreezeDigits_ = true;

  this.timeAdjustment_ = 0;
  this.easeInTime_ = 0;
  this.waitTime_ = 0;
  this.easeOutTime_ = 0;
  this.onThresholdReachedCallback_ = null;
  this.onTimerTickCallback_ = null;

  this.lastThreshold_ = '';
  this.lastDrawnValue_ = {
    days: Number.MAX_VALUE,
    hours: Number.MAX_VALUE,
    minutes: Number.MAX_VALUE,
    seconds: Number.MAX_VALUE
  };

  this.animationValue_ = 0;
  this.animationRunning_ = false;
  this.animationStartTime_ = 0;
  this.animationWaitStartTime_ = 0;
  this.animationEaseOutStartTime_ = 0;
  this.animationEaseOutEndTime_ = 0;

  this.drawIfAnimationIsNotRunning =
      this.drawIfAnimationIsNotRunning.bind(this);
  this.update_ = this.update_.bind(this);
  this.setDayMonthMinutesAndSecondValues_ =
      this.setDayMonthMinutesAndSecondValues_.bind(this);

  this.addEventListeners_();

};

IOWA.CountdownTimer.Element.prototype = {

  millisecondsInASecond_: 1000,
  millisecondsInAMinute_: 60 * 1000,
  millisecondsInAnHour_: 60 * 60 * 1000,
  millisecondsInADay_: 24 * 60 * 60 * 1000,

  addEventListeners_: function() {
    window.addEventListener('resize', this.drawIfAnimationIsNotRunning);
  },

  destroy: function() {
    this.animationRunning_ = false;
    window.removeEventListener('resize', this.drawIfAnimationIsNotRunning);
    this.renderer_.destroy();
  },

  update_: function() {

    if (!this.animationRunning_)
      return;

    // Figure out where we are in the animation cycle and map it to a value
    // between 0 and 1, where 0 is the start and end state, and 1 is the
    // fully visible state on screen.
    var now = Date.now();
    var animationValue = 0;
    var animatingIn = true;
    var animationDirection = IOWA.CountdownTimer.Animation.In;

    if (now > this.animationStartTime_) {
      animationValue = (now - this.animationStartTime_) / this.easeInTime_;
    }
    if (now > this.animationWaitStartTime_) {
      animationValue = 1;

      // Ensure we only animate numbers that are changing.
      this.freezeRendererForUnchangingDigits_();
    }
    if (now > this.animationEaseOutStartTime_) {

      if (this.countdownTargetReached_()) {
        this.dispatchThresholdEventIfNeeded_("Ended");
      }

      animationValue = 1 - ((now - this.animationEaseOutStartTime_) /
        this.easeOutTime_);
      animationDirection = IOWA.CountdownTimer.Animation.Out;
    }
    if (now > this.animationEaseOutEndTime_) {
      animationValue = 0;
    }

    // Remap the linear value through the easing equation.
    animationValue = IOWA.CountdownTimer.Easing(animationValue);

    // Only draw if we need to.
    if (this.valueHasChangedSinceLastDraw_()) {

      this.renderer_.clear();
      this.renderer_.draw(this.currentCountdownValue, animationValue,
          animationDirection);
    }

    if (animationValue === 0) {
      this.continueAnimationIfNotAtFinalValue_();
      this.onTimerTickCallback(this.currentCountdownValue);
    } else {
      requestAnimationFrame(this.update_);
    }
  },

  valueHasChangedSinceLastDraw_: function() {
    return this.currentCountdownValue.days !== this.lastDrawnValue_.days ||
        this.currentCountdownValue.hours !== this.lastDrawnValue_.hours ||
        this.currentCountdownValue.minutes !== this.lastDrawnValue_.minutes ||
        this.currentCountdownValue.seconds !== this.lastDrawnValue_.seconds;
  },

  countdownTargetReached_: function() {
    return this.currentCountdownValue.days === 0 &&
        this.currentCountdownValue.hours === 0 &&
        this.currentCountdownValue.minutes === 0 &&
        this.currentCountdownValue.seconds === 0;
  },

  freezeRendererForUnchangingDigits_: function() {

    if (!this.needToFreezeDigits_)
      return;

    this.needToFreezeDigits_ = false;

    var milliseconds = Math.max(0, this.targetDate_ - Date.now() -
        this.easeOutTime_ - this.waitTime_);

    this.convertMillisecondsAndSetObjectValues_(milliseconds,
        this.nextCountdownValue_);

    this.renderer_.setNextValueForFreezing(
        this.currentCountdownValue,
        this.nextCountdownValue_);

  },

  updateAnimationTimingValues_: function() {

    this.animationStartTime_ = Date.now();
    this.animationWaitStartTime_ = this.animationStartTime_ +
        this.easeInTime_;
    this.animationEaseOutStartTime_ = this.animationWaitStartTime_ +
        this.waitTime_;
    this.animationEaseOutEndTime_ = this.animationEaseOutStartTime_ +
        this.easeOutTime_;
  },

  continueAnimationIfNotAtFinalValue_: function() {

    this.stop();

    if (this.targetDate_ < Date.now())
      return;

    this.setDayMonthMinutesAndSecondValues_();
    this.needToFreezeDigits_ = true;

    this.updateAnimationTimingValues_();
    this.start();

  },

  setDayMonthMinutesAndSecondValues_: function() {

    var millisecondsToTarget = Math.max(0, this.targetDate_ - Date.now());

    this.lastDrawnValue_.days = this.currentCountdownValue.days;
    this.lastDrawnValue_.hours = this.currentCountdownValue.hours;
    this.lastDrawnValue_.minutes = this.currentCountdownValue.minutes;
    this.lastDrawnValue_.seconds = this.currentCountdownValue.seconds;

    this.convertMillisecondsAndSetObjectValues_(millisecondsToTarget,
        this.currentCountdownValue);

    this.scheduleRendererRippleIfNeeded_();
  },

  scheduleRendererRippleIfNeeded_: function() {

    // Only ripple if something has changed.
    if (this.lastDrawnValue_.days === this.currentCountdownValue.days &&
        this.lastDrawnValue_.hours === this.currentCountdownValue.hours &&
        this.lastDrawnValue_.minutes === this.currentCountdownValue.minutes &&
        this.lastDrawnValue_.seconds === this.currentCountdownValue.seconds)
      return;

    if (this.currentCountdownValue.days === 0 &&
        this.currentCountdownValue.hours === 0 &&
        this.currentCountdownValue.minutes === 0) {

      if (this.lastDrawnValue_.minutes === 1) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[1]);
      } else if (this.crossedThreshold_(30)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[2]);
      } else if (this.crossedThreshold_(20)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[3]);
      } else if (this.crossedThreshold_(10)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[4]);
      } else if (this.crossedThreshold_(8)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[5]);
      } else if (this.crossedThreshold_(6)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[6]);
      } else if (this.crossedThreshold_(4)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[7]);
      } else if (this.crossedThreshold_(3)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[8]);
      } else if (this.crossedThreshold_(2)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[9]);
      } else if (this.crossedThreshold_(1)) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[10]);
      } else if (this.currentCountdownValue.seconds === 0) {
        this.renderer_.ripple(IOWA.CountdownTimer.Colors.Rundown[11]);
      }

      return;
    }

    if (this.currentCountdownValue.minutes !== this.lastDrawnValue_.minutes)
      this.renderer_.ripple();
  },

  crossedThreshold_: function(threshold) {
    return this.lastDrawnValue_.seconds > threshold &&
        this.currentCountdownValue.seconds <= threshold;
  },

  convertMillisecondsAndSetObjectValues_: function(milliseconds, target) {

    var daysToTarget = Math.floor(milliseconds /
        this.millisecondsInADay_);

    milliseconds -= daysToTarget * this.millisecondsInADay_;

    var hoursToTarget = Math.floor(milliseconds /
        this.millisecondsInAnHour_);

    milliseconds -= hoursToTarget * this.millisecondsInAnHour_;

    var minutesToTarget = Math.floor(milliseconds /
        this.millisecondsInAMinute_);

    milliseconds -= minutesToTarget * this.millisecondsInAMinute_;

    var secondsToTarget = Math.floor(milliseconds / 1000);

    target.days = daysToTarget;
    target.hours = hoursToTarget;
    target.minutes = minutesToTarget;
    target.seconds = secondsToTarget;
  },

  dispatchThresholdEventIfNeeded_: function(label) {

    if (this.lastThreshold_ === label)
      return;

    if (!this.onThresholdReachedCallback)
      return;

    this.lastThreshold_ = label;

    this.onThresholdReachedCallback({
      label: label,
      millisecondsToTarget: Math.max(0, this.targetDate_ - Date.now())
    });
  },

  start: function() {

    if (this.animationRunning_)
      return;

    this.animationRunning_ = true;
    requestAnimationFrame(this.update_);
  },

  stop: function() {
    this.animationRunning_ = false;
  },

  drawIfAnimationIsNotRunning: function() {

    if (this.animationRunning_)
      return;

    this.renderer_.init();
    this.renderer_.clear();
    this.renderer_.draw(this.currentCountdownValue, 1,
        IOWA.CountdownTimer.Animation.In);

  },

  setOnTimerThresholdReachedCallback: function(onThresholdReachedCallback) {
    this.onThresholdReachedCallback = onThresholdReachedCallback;
  },

  setOnTimerTickCallback: function(onTimerTickCallback) {
    this.onTimerTickCallback = onTimerTickCallback;
  },

  configure: function(options) {

    this.targetDate_ = options.targetDate.getTime();
    this.timeAdjustment_ = options.adjustmentInDays;
    this.setDayMonthMinutesAndSecondValues_();

    this.easeInTime_ = options.easeInTime;
    this.waitTime_ = options.waitTime;
    this.easeOutTime_ = options.easeOutTime;

    this.updateAnimationTimingValues_();
  },

  resizeRenderer: function() {
    this.renderer_.resizeHandler();
  },

  get configured() {
    return this.configured_;
  },

  get currentCountdownValue() {
    return this.currentCountdownValue_;
  },

  set currentCountdownValue(value) {
    if (value < this.targetDayValue || isNaN(value))
      value = this.targetDayValue;

    this.currentCountdownValue_ = value;
  },

  get targetDayValue() {
    return this.targetDayCountValue_;
  },

  set targetDayValue(value) {

    if (isNaN(value))
      return;

    if (value < 0)
      value = 0;

    this.targetDayCountValue_ = value;
  },

  set onThresholdReachedCallback(callback) {
    if (typeof callback !== 'function')
      return;

    this.onThresholdReachedCallback_ = callback;
  },

  get onThresholdReachedCallback() {
    return this.onThresholdReachedCallback_;
  },

  set onTimerTickCallback(callback) {
    if (typeof callback !== 'function')
      return;

    this.onTimerTickCallback_ = callback;
  },

  get onTimerTickCallback() {
    return this.onTimerTickCallback_;
  }

};
