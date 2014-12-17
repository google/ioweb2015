IOWA.CountdownTimer.Element = function(el) {

  this.renderer_ = new IOWA.CountdownTimer.NumberRenderer(el);

  this.currentDayCountValue_ = 0;
  this.targetDayCountValue_ = 0;

  this.adjustmentInDays_ = 0;
  this.easeInTime_ = 0;
  this.waitTime_ = 0;
  this.easeOutTime_ = 0;

  this.animationValue_ = 0;
  this.animationRunning_ = false;
  this.animationStartTime_ = 0;
  this.animationWaitStartTime_ = 0;
  this.animationEaseOutStartTime_ = 0;
  this.animationEaseOutEndTime_ = 0;

  this.drawIfAnimationIsNotRunning =
      this.drawIfAnimationIsNotRunning.bind(this);
  this.update_ = this.update_.bind(this);

  this.addEventListeners_();

};

IOWA.CountdownTimer.Element.prototype = {

  addEventListeners_: function() {
    window.addEventListener('resize', this.drawIfAnimationIsNotRunning);
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
    }
    if (now > this.animationEaseOutStartTime_) {

      // We may choose to end here if this is the last value.
      if (this.currentDayValue === this.targetDayValue) {
        this.stop();
        return;
      }

      // Ensure we only animate numbers that are changing.
      this.freezeRendererForUnchangingDigits_();

      animationValue = 1 - ((now - this.animationEaseOutStartTime_) /
        this.easeOutTime_);
      animationDirection = IOWA.CountdownTimer.Animation.Out;
    }
    if (now > this.animationEaseOutEndTime_) {
      animationValue = 0;
    }

    // Remap the linear value through the easing equation.
    animationValue = IOWA.CountdownTimer.Easing(animationValue);

    this.renderer_.clear();
    this.renderer_.draw(this.currentDayValue, animationValue,
        animationDirection);

    if (animationValue === 0) {
      this.continueAnimationIfNotAtFinalValue_();
    }
    else
      requestAnimationFrame(this.update_);
  },

  freezeRendererForUnchangingDigits_: function() {

    var freezeCount = 0;
    var currentDayValueAsString = Number(this.currentDayValue).toString();
    var nextDayValueAsString = Number(this.currentDayValue - 1).toString();

    for (var i = 0; i < nextDayValueAsString.length; i++) {
      if (nextDayValueAsString[i] !== currentDayValueAsString[i])
        break;

      freezeCount++;
    }

    this.renderer_.freeze(freezeCount);
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

    this.currentDayValue--;
    this.stop();

    if (this.currentDayValue < this.targetDayValue) {
      return;
    }

    this.updateAnimationTimingValues_();
    this.start();

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

    this.renderer_.clear();
    this.renderer_.draw(this.currentDayValue, 1,
        IOWA.CountdownTimer.Animation.In);

  },

  configure: function(options) {

    var millisecondsToDays = 1 / (24 * 60 * 60 * 1000);
    var millisecondsToTarget = options.targetDate.getTime() - Date.now();

    this.targetDayValue = Math.round(millisecondsToTarget *
        millisecondsToDays);
    this.currentDayValue = this.targetDayValue + options.adjustmentInDays;

    this.easeInTime_ = options.easeInTime;
    this.waitTime_ = options.waitTime;
    this.easeOutTime_ = options.easeOutTime;

    this.updateAnimationTimingValues_();
  },

  get configured() {
    return this.configured_;
  },

  get currentDayValue() {
    return this.currentDayCountValue_;
  },

  set currentDayValue(value) {
    if (value < this.targetDayValue || isNaN(value))
      value = this.targetDayValue;

    this.currentDayCountValue_ = value;
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

};
