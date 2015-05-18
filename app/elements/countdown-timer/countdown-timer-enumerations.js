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

IOWA.CountdownTimer.Colors = {
  Shadow: 'hsla(0, 0%, 0%, 0.4)',
  Divider: {h: 0, s: 0, l: 0, a: 0.2},
  Label: 'hsla(0, 0%, 0%, 0.57)',
  Rundown: [
    {
      background: {h: 188, s: 83, l: 46, a: 1},
      dark: {h: 187, s: 100, l: 38, a: 1},
      medium: {h: 187, s: 72, l: 71, a: 1},
      light: {h: 187, s: 72, l: 93, a: 1}
    },

    {
      background: {h: 220, s: 66, l: 52, a: 1},
      dark: {h: 223, s: 65, l: 47, a: 1},
      medium: {h: 218, s: 89, l: 67, a: 1},
      light: {h: 218, s: 92, l: 95, a: 1}
    },

    {
      background: {h: 262, s: 52, l: 47, a: 1},
      dark: {h: 258, s: 58, l: 42, a: 1},
      medium: {h: 262, s: 47, l: 63, a: 1},
      light: {h: 292, s: 44, l: 93, a: 1}
    },

    {
      background: {h: 256, s: 100, l: 65, a: 1},
      dark: {h: 265, s: 100, l: 46, a: 1},
      medium: {h: 262, s: 100, l: 77, a: 1},
      light: {h: 264, s: 45, l: 94, a: 1}
    },

    {
      background: {h: 291, s: 47, l: 51, a: 1},
      dark: {h: 277, s: 70, l: 35, a: 1},
      medium: {h: 291, s: 47, l: 60, a: 1},
      light: {h: 292, s: 44, l: 93, a: 1}
    },

    {
      background: {h: 340, s: 82, l: 59, a: 1},
      dark: {h: 334, s: 79, l: 38, a: 1},
      medium: {h: 340, s: 82, l: 76, a: 1},
      light: {h: 340, s: 80, l: 94, a: 1}
    },

    {
      background: {h: 360, s: 100, l: 66, a: 1},
      dark: {h: 360, s: 100, l: 42, a: 1},
      medium: {h: 365, s: 100, l: 75, a: 1},
      light: {h: 366, s: 71, l: 95, a: 1}
    },

    {
      background: {h: 374, s: 100, l: 63, a: 1},
      dark: {h: 374, s: 82, l: 46, a: 1},
      medium: {h: 374, s: 100, l: 78, a: 1},
      light: {h: 366, s: 71, l: 95, a: 1}
    },

    {
      background: {h: 394, s: 100, l: 50, a: 1},
      dark: {h: 386, s: 100, l: 50, a: 1},
      medium: {h: 398, s: 100, l: 75, a: 1},
      light: {h: 397, s: 100, l: 94, a: 1}
    },

    {
      background: {h: 410, s: 100, l: 50, a: 1},
      dark: {h: 397, s: 95, l: 56, a: 1},
      medium: {h: 414, s: 100, l: 67, a: 1},
      light: {h: 415, s: 100, l: 95, a: 1}
    },

    {
      background: {h: 425, s: 100, l: 63, a: 1},
      dark: {h: 435, s: 100, l: 46, a: 1},
      medium: {h: 425, s: 100, l: 75, a: 1},
      light: {h: 426, s: 71, l: 95, a: 1}
    },

    {
      background: {h: 548, s: 83, l: 46, a: 1},
      dark: {h: 547, s: 100, l: 38, a: 1},
      medium: {h: 547, s: 72, l: 71, a: 1},
      light: {h: 547, s: 72, l: 93, a: 1}
    }
  ]
};

/**
 * Quintic ease-out from:
 * @see: https://github.com/sole/tween.js/blob/master/src/Tween.js
 */
IOWA.CountdownTimer.Easing = function(t) {
  return --t * t * t * t * t + 1;
};

IOWA.CountdownTimer.Animation = {
  In: 1,
  Out: 2
};

IOWA.CountdownTimer.Modes = {
  SingleValue: 1,
  Continuous: 2
};
