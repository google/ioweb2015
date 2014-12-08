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

CDS.Toast = function(message) {

  this.element_ = document.createElement('div');
  this.elementInner_ = document.createElement('div');

  this.elementInner_.innerText = message;

  this.element_.classList.add('toast');
  this.elementInner_.classList.add('toast__message');

  this.hide = this.hide.bind(this);

  this.element_.appendChild(this.elementInner_);
  document.body.appendChild(this.element_);

  requestAnimFrame(this.hide);

  return this;
};

CDS.Toast.prototype = {

  hide: function() {
    this.element_.classList.add('toast__hidden');
    this.element_.addEventListener('transitionend', this.remove_);
    this.element_.addEventListener('webkittransitionend', this.remove_);
  },

  remove_: function() {

    if (!this.element_)
      return;

    document.removeChild(this.element_);
  }
};

CDS.Toaster = {
  create: function(message) {
    return new CDS.Toast(message);
  }
};
