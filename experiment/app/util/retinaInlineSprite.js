var PIXI = require('pixi.js/bin/pixi.dev.js');

module.exports = (function() {
  'use strict';

  return function retinaInlineSprite(imageUrl) {
    var image = new Image();
    image.src = imageUrl;

    var baseTexture = new PIXI.BaseTexture(image);
    baseTexture.imageUrl = imageUrl;
    baseTexture.resolution = 2;

    var texture = new PIXI.Texture(baseTexture);
    return new PIXI.Sprite(texture);
  };
})();
