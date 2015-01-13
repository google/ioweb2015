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
