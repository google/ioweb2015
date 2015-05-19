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

/**
 * Google I/O 2015 Experiment: Material Sound
 *
 *                           ;WO
 *                           xMx
 *                          .WM'
 * ccccccccccccccc.         dMO        .;lxOKXXXK0ko:.
 * MMMMMMMMMMMMMMM'        .WM,     'dXMMMMMMMMMMMMMMMNk;
 * MMMMMMMMMMMMMMM'        xM0    ;KMMMMMMMMMMMMMMMMMMMMMNc
 * MMMMMMMMMMMMMMM'       .WM;  .0MMMMMMMMMMMMMMMMMMMMMMMMMK'
 * MMMMMMMMMMMMMMM'       xMK  'NMMMMMMMMMMMMMMMMMMMMMMMMMMMMc
 * MMMMMMMMMMMMMMM'      .WMc .XMMMMMMMMMMMMMMMMMMMMMMMMMMMMMW,
 * MMMMMMMMMMMMMMM'      oMX  lMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMO
 * MMMMMMMMMMMMMMM'      NM:  OMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMW
 * MMMMMMMMMMMMMMM'     lMK   OMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
 * MMMMMMMMMMMMMMM'     XM:   oMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM0
 * MMMMMMMMMMMMMMM'    cMX    .NMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM,
 * MMMMMMMMMMMMMMM'    KMl     'WMMMMMMMMMMMMMMMMMMMMMMMMMMMMl
 * MMMMMMMMMMMMMMM'   cMN       .KMMMMMMMMMMMMMMMMMMMMMMMMMX,
 * MMMMMMMMMMMMMMM'   XMo         ;KMMMMMMMMMMMMMMMMMMMMMNo
 * MMMMMMMMMMMMMMM'  cMW.           ,xNMMMMMMMMMMMMMMMWO:
 * ;;;;;;;;;;;;;;;   XMd               .:ok0XNNNXKOxc'
 *                  :MW.
 *                  0Md
 *                 .0W'
 */
(function() {
  'use strict';

  var Experiment = require('app/core');
  var exp = new Experiment();

  if (window.experiment && ('function' === typeof window.experiment.getAudioDefinitions)) {
    var { audioSprite, audioLoops } = window.experiment.getAudioDefinitions();
    exp.load(audioSprite, audioLoops);
  } else {
    exp.load();
  }

})();
