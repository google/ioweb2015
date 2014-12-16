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

  this.update_ = this.update_.bind(this);

  this.addEventListeners_();

};

IOWA.CountdownTimer.Element.prototype = {

  get currentDayValue_() {
    return this.currentDayCountValue_;
  },

  set currentDayValue_(value) {
    if (value < this.targetDayValue_ || isNaN(value))
      value = this.targetDayValue_;

    this.currentDayCountValue_ = value;
  },

  get targetDayValue_() {
    return this.targetDayCountValue_;
  },

  set targetDayValue_(value) {

    if (isNaN(value))
      return;

    if (value < 0)
      value = 0;

    this.targetDayCountValue_ = value;
  },

  addEventListeners_: function() {
    window.addEventListener('resize', this.drawIfNeeded_.bind(this));
  },

  drawIfNeeded_: function() {

    if (this.animationRunning_)
      return;

    this.renderer_.clear();
    this.renderer_.draw(this.currentDayValue_, 1,
        IOWA.CountdownTimer.Animation.In);

  },

  update_: function() {

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
      if (this.currentDayValue_ === this.targetDayValue_) {
        this.stop_();
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
    this.renderer_.draw(this.currentDayValue_, animationValue,
        animationDirection);

    if (animationValue === 0) {
      this.continueAnimationIfNotAtFinalValue_();
    }
    else
      requestAnimationFrame(this.update_);
  },

  freezeRendererForUnchangingDigits_: function() {

    var freezeCount = 0;
    var currentDayValueAsString = Number(this.currentDayValue_).toString();
    var nextDayValueAsString = Number(this.currentDayValue_ - 1).toString();

    for (var i = 0; i < nextDayValueAsString.length; i++) {
      if (nextDayValueAsString[i] !== currentDayValueAsString[i])
        break;

      freezeCount++;
    }

    this.renderer_.freeze(freezeCount);
  },

  start_: function() {
    if (this.animationRunning_)
      return;

    this.animationRunning_ = true;
    requestAnimationFrame(this.update_);
  },

  stop_: function() {
    this.animationRunning_ = false;
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

    this.currentDayValue_--;
    this.stop_();

    if (this.currentDayValue_ < this.targetDayValue_) {
      return;
    }

    this.updateAnimationTimingValues_();
    this.start_();

  },

  animate: function(options) {

    var millisecondsToDays = 1 / (24 * 60 * 60 * 1000);
    var millisecondsToTarget = options.targetDate.getTime() - Date.now();

    this.targetDayValue_ = Math.round(millisecondsToTarget *
        millisecondsToDays);
    this.currentDayValue_ = this.targetDayValue_ + options.adjustmentInDays;

    this.easeInTime_ = options.easeInTime;
    this.waitTime_ = options.waitTime;
    this.easeOutTime_ = options.easeOutTime;

    this.updateAnimationTimingValues_();
    this.start_();
  }

};
