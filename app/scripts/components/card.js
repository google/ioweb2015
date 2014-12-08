/**
 * Copyright 2014 Google Inc. All rights reserved.
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

CDS.Card = function(element) {

  "use strict";

  this.elements_ = {
    root: element,
    seeMoreLink: element.querySelector('.card__see-more'),
    container: element.querySelector('.card__container'),
    title: element.querySelector('.card__title'),
    logo: element.querySelector('.card__logo'),
    contentWrapper: element.querySelector('.card__content-wrapper'),
    collapseButton: element.querySelector('.card__collapse-button')
  };

  // Go with lofi for anything that can't run fast clip animations.
  this.runLoFiAnimations_ = !CDS.Util.canRunFastClipAnimations();
  this.expanded_ = false;
  this.boxPositionOnExpand_ = null;
  this.preventChangesToTitleScale_ =
      this.elements_.root.classList.contains('card--no-title-scale');
  this.preventChangesToTitleOpacityOnScroll_ =
      this.elements_.root.classList
          .contains('card--no-title-opacity-during-scroll');

  // We need to disable fixed position navigation on cards for iOS
  // as it causes judder during scrolls.
  if (CDS.Util.isIOS())
    this.elements_.root.classList.add('card__no-fixed-header');

  this.parts_ = Object.keys(this.elements_);
  this.properties_ = [
      'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'opacity'];
  this.collapsedPositions_ = CDS.Util.makeObject(this.parts_, null);
  this.expandedPositions_ = CDS.Util.makeObject(this.parts_, null);
  this.contentColor_ = window.getComputedStyle(
      this.elements_.container).backgroundColor;

  this.diffs_ = {
    root: CDS.Util.makeObject(this.properties_, 0),
    seeMoreLink: CDS.Util.makeObject(this.properties_, 0),
    container: CDS.Util.makeObject(this.properties_, 0),
    title: CDS.Util.makeObject(this.properties_, 0),
    logo: CDS.Util.makeObject(this.properties_, 0),
    contentWrapper: CDS.Util.makeObject(this.properties_, 0),
    collapseButton: CDS.Util.makeObject(this.properties_, 0)
  };

  this.events_ = {
    expand: new signals.Signal(),
    collapse: new signals.Signal(),
    transitionend: new signals.Signal()
  };

  // Ensure there is a copy of the callback functions per card.
  this.onSeeMoreLinkClick_ = this.onSeeMoreLinkClick_.bind(this);
  this.onCollapseButtonClick_ = this.onCollapseButtonClick_.bind(this);
  this.onCollapseTransitionEnd_ = this.onCollapseTransitionEnd_.bind(this);
  this.onExpandTransitionEnd_ = this.onExpandTransitionEnd_.bind(this);
  this.onCardContentScroll_ = this.onCardContentScroll_.bind(this);
  this.onWindowResize_ = this.onWindowResize_.bind(this);
  this.disableTabbingToLinks_ = this.disableTabbingToLinks_.bind(this);

  this.elements_.seeMoreLink.addEventListener('click',
      this.onSeeMoreLinkClick_);
  this.elements_.collapseButton.addEventListener('click',
      this.onCollapseButtonClick_);

  this.elements_.container.addEventListener('scroll',
      this.onCardContentScroll_);

  CDS.EventPublisher.add('resize', this.onWindowResize_);

  this.disableTabbingToLinks_();
};

CDS.Card.prototype = {

  onWindowResize_: function(evt) {

    if (!this.expanded_)
      return;

    this.onCardContentScroll_(evt);
  },

  onExpandTransitionEnd_: function(evt) {

    if (typeof evt !== 'undefined' &&
        evt.target !== this.elements_.container)
      return;

    this.elements_.container.classList.add('card__container--scrollable');
    this.elements_.root.classList.remove('card--animatable');

    if (this.runLoFiAnimations_)
      this.elements_.container.classList.remove(
          'card__container--lofi-animations');

    this.resetElementTransformsAndOpacity_();
    this.resetElementClip_();

    this.elements_.container.removeEventListener('transitionend',
        this.onExpandTransitionEnd_);
    this.elements_.container.removeEventListener('webkittransitionend',
        this.onExpandTransitionEnd_);

    this.enableTabbingToLinksAndFocusBackButton_();
    this.events_.transitionend.dispatch(this);
  },

  onCollapseTransitionEnd_: function(evt) {

    if (typeof evt !== 'undefined' &&
        evt.target !== this.elements_.contentWrapper)
      return;

    this.expanded_ = false;
    this.elements_.root.classList.remove('card--expanded');
    this.elements_.root.classList.remove('card--collapsing');
    this.elements_.root.classList.remove('card--animatable');

    this.resetElementTransformsAndOpacity_();
    this.resetElementClip_();

    this.elements_.contentWrapper.removeEventListener('transitionend',
        this.onCollapseTransitionEnd_);
    this.elements_.contentWrapper.removeEventListener('webkittransitionend',
        this.onCollapseTransitionEnd_);

    this.disableTabbingToLinks_();
    this.events_.transitionend.dispatch(this);
  },

  onCardContentScroll_: function(evt) {

    var range = 50;
    var y = this.elements_.container.scrollTop;
    var width = window.innerWidth;
    var target = width < 900 ? this.elements_.logo : this.elements_.title;

    if (y < 0)
      return;

    if (this.preventChangesToTitleOpacityOnScroll_)
      return;

    this.elements_.logo.style.opacity = 1;
    this.elements_.title.style.opacity = 1;

    target.style.opacity = 1 - Math.min(1, Math.max(0, y / range));

    if (width > 900) {
      this.elements_.container.classList.remove('card--navbar-shadow');
      return;
    }

    if (y > 145)
      this.elements_.container.classList.add('card--navbar-shadow');
    else
      this.elements_.container.classList.remove('card--navbar-shadow');
  },

  onSeeMoreLinkClick_: function(evt) {

    CDS.History.forth(this.elements_.seeMoreLink.href);

    evt.preventDefault();
    evt.stopImmediatePropagation();
  },

  onCollapseButtonClick_: function(evt) {

    CDS.History.forth('../');

    if (typeof evt === 'undefined')
      return;

    evt.preventDefault();
    evt.stopImmediatePropagation();
  },

  disableTabbingToLinks_: function() {

    this.elements_.collapseButton.setAttribute('tabindex', -1);

    var contentLinks = this.elements_.contentWrapper.querySelectorAll('a');
    for (var i = 0; i < contentLinks.length; i++) {
      contentLinks[i].setAttribute('tabindex', -1);
    }

  },

  enableTabbingToLinksAndFocusBackButton_: function() {

    this.elements_.collapseButton.focus();
    this.elements_.collapseButton.setAttribute('tabindex', 1);

    var contentLinks = this.elements_.contentWrapper.querySelectorAll('a');
    for (var i = 0; i < contentLinks.length; i++) {
      contentLinks[i].setAttribute('tabindex', (i + 2));
    }
  },

  applyClipRect_: function() {
    if (!this.expanded_)
      return;

    var contentLocation = this.elements_.container.getBoundingClientRect();
    this.elements_.container.style.clip = 'rect(0, ' +
        contentLocation.width + 'px, ' +
        contentLocation.height + 'px, 0)';
  },

  getContentColor: function() {
    return this.contentColor_;
  },

  getRootElement: function() {
    return this.elements_.root;
  },

  isExpanded: function() {
    return this.expanded_;
  },

  addEventListener: function(name, callback, addOnce) {
    if (!this.events_[name])
      throw "Unknown event type: " + name;

    if (addOnce)
      this.events_[name].addOnce(callback);
    else
      this.events_[name].add(callback);
  },

  expand: function(opt_disableAnimations) {

    if (typeof opt_disableAnimations === 'undefined')
      opt_disableAnimations = false;

    if (this.expanded_)
      return;

    this.boxPositionOnExpand_ = this.elements_.root.getBoundingClientRect();
    this.expanded_ = true;

    // Read the viewport position of the card and elements.
    this.collectProperties_(this.collapsedPositions_);

    // Set the expanded class
    this.elements_.root.classList.add('card--expanded');
    this.elements_.container.classList.add('card__container--scrollable');

    // Read them in their expanded positions.
    this.collectProperties_(this.expandedPositions_);

    // Calculate the position differences.
    this.calculatePositionDiffs_();

    // Bail here if we're not animating.
    if (opt_disableAnimations) {

      // Set the positions and clip on exit.
      this.setElementTransformsToZeroAndClipToExpanded_();
      this.onExpandTransitionEnd_();
      this.events_.expand.dispatch(this);
      return;
    }

    // Set them all back to collapsed.
    this.setElementTransformsToStartAndClipToCollapsed_();

    // Read again to force the style change to take hold.
    var readValue2 = this.elements_.root.offsetTop;

    // Switch on animations.
    this.elements_.root.classList.add('card--animatable');

    // Now expand.
    this.setElementTransformsToZeroAndClipToExpanded_();

    this.elements_.container.addEventListener('transitionend',
        this.onExpandTransitionEnd_);
    this.elements_.container.addEventListener('webkittransitionend',
        this.onExpandTransitionEnd_);

    this.events_.expand.dispatch(this);

    CDS.Analytics.track('card', 'expand', this.elements_.seeMoreLink.href);
  },

  collapse: function(opt_disableAnimations) {

    if (typeof opt_disableAnimations === 'undefined')
      opt_disableAnimations = false;

    if (!this.expanded_)
      return;

    this.applyClipRect_();
    this.elements_.root.classList.add('card--collapsing');
    this.elements_.root.classList.add('card--animatable');

    if (this.runLoFiAnimations_) {

      this.elements_.container.classList.add(
          'card__container--lofi-animations');
    }

    this.elements_.container.scrollTop = 0;
    this.elements_.container.classList.remove('card__container--scrollable');

    this.elements_.contentWrapper.addEventListener('transitionend',
        this.onCollapseTransitionEnd_);
    this.elements_.contentWrapper.addEventListener('webkittransitionend',
        this.onCollapseTransitionEnd_);

    this.setElementTransformsToStartAndClipToCollapsed_();

    this.events_.collapse.dispatch(this);

    CDS.Analytics.track('card', 'collapse', this.elements_.seeMoreLink.href);

  },

  resetElementTransformsAndOpacity_: function() {
    var part;
    for (var p = 0; p < this.parts_.length; p++) {
      part = this.parts_[p];

      this.setElementTransformAndOpacity_(this.elements_[part], '', '');
    }
  },

  resetElementClip_: function() {
    this.elements_.container.style.clip = '';
  },

  setElementTransformsToStartAndClipToCollapsed_: function() {

    // Work out if the root element has moved and adjust
    // the values for the animation correspondingly.
    var currentBoxPosition = this.elements_.root.getBoundingClientRect();
    var leftDifference = currentBoxPosition.left -
        this.boxPositionOnExpand_.left;
    var topDifference = currentBoxPosition.top -
        this.boxPositionOnExpand_.top;

    var part;
    for (var p = 0; p < this.parts_.length; p++) {
      part = this.parts_[p];

      // We don't need or want to move the container or the root
      // element during this animation so ignore them.
      if (part === 'container' || part === 'root')
        continue;

      // Adjust for changes in scroll position since the card expanded.
      this.diffs_[part].top += topDifference;
      this.diffs_[part].left += leftDifference;

      this.setElementTransformAndOpacity_(this.elements_[part],
          this.diffs_[part], this.diffs_[part].opacity);
    }

    if (this.runLoFiAnimations_) {

      this.diffs_.container.top += topDifference;
      this.diffs_.container.left += leftDifference;

      this.elements_.container.classList.add(
          'card__container--lofi-animations');
      this.setElementTransformAndOpacity_(this.elements_.container,
          this.diffs_.container);

      return;

    }

    var clipLeft = this.collapsedPositions_.container.left + leftDifference;
    var clipRight = this.collapsedPositions_.container.right + leftDifference;
    var clipTop = this.collapsedPositions_.container.top + topDifference;
    var clipBottom = this.collapsedPositions_.container.bottom + topDifference;

    this.elements_.container.style.clip = 'rect(' +
        clipTop + 'px, ' +
        clipRight + 'px, ' +
        clipBottom + 'px, ' +
        clipLeft + 'px)';

  },

  setElementTransformsToZeroAndClipToExpanded_: function() {

    var part;
    for (var p = 0; p < this.parts_.length; p++) {
      part = this.parts_[p];

      if (part === 'container' && !this.runLoFiAnimations_)
        continue;

      if (part === 'root')
        continue;

      this.setElementTransformAndOpacity_(this.elements_[part],
          'translate(0,0) scale(1)',
          this.expandedPositions_[part].opacity);
    }

    this.elements_.container.style.clip = 'rect(' +
        this.expandedPositions_.container.top + 'px, ' +
        this.expandedPositions_.container.right + 'px, ' +
        this.expandedPositions_.container.bottom + 'px, ' +
        this.expandedPositions_.container.left + 'px)';

  },

  setElementTransformAndOpacity_: function(element, transform, opacity) {

    var transformString = transform;

    if (typeof transform !== 'string') {
      transformString = 'translate(' +
          transform.left + 'px,' +
          transform.top + 'px)';

      if (element !== this.elements_.contentWrapper &&
          element !== this.elements_.content)
        transformString += ' scale(' +
            transform.scaleX + ', ' +
            transform.scaleY + ')';
    }

    element.style.webkitTransform = transformString;
    element.style.transform = transformString;

    if (typeof opacity !== 'undefined')
      element.style.opacity = opacity;
  },

  collectProperties_: function(target) {
    var part, rect;
    for (var p = 0; p < this.parts_.length; p++) {
      part = this.parts_[p];
      rect = this.elements_[part].getBoundingClientRect();

      // We need to make a copy here because the gBCR call
      // gives us an immutable object.
      target[part] = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      };

      target[part].opacity = parseFloat(window.getComputedStyle(
          this.elements_[part]).opacity);

      // We need to limit the size for browsers that
      // allow bleed past the edge of the viewport.
      target[part].width = Math.min(target[part].width, window.innerWidth);
      target[part].height = Math.min(target[part].height, window.innerHeight);
    }
  },

  calculatePositionDiffs_: function() {

    var part;
    for (var p = 0; p < this.parts_.length; p++) {
      part = this.parts_[p];

      this.diffs_[part].left = this.collapsedPositions_[part].left -
          this.expandedPositions_[part].left;

      this.diffs_[part].top = this.collapsedPositions_[part].top -
          this.expandedPositions_[part].top;

      this.diffs_[part].width = this.collapsedPositions_[part].width -
          this.expandedPositions_[part].width;

      this.diffs_[part].height = this.collapsedPositions_[part].height -
          this.expandedPositions_[part].height;

      this.diffs_[part].scaleX = this.collapsedPositions_[part].width /
          this.expandedPositions_[part].width;

      this.diffs_[part].scaleY = this.collapsedPositions_[part].height /
          this.expandedPositions_[part].height;

      if (part === 'title' && this.preventChangesToTitleScale_)
        this.diffs_[part].scaleX = this.diffs_[part].scaleY = 1;

      this.diffs_[part].opacity = 1 - (this.expandedPositions_[part].opacity -
          this.collapsedPositions_[part].opacity);

    }

  }

};
