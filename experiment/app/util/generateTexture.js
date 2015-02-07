module.exports = (function() {
  'use strict';

  var hasAntialiasing = false;

  function generateTexture(graphics, smallVal) {
    smallVal = smallVal || 0.4;
    return graphics.generateTexture(1);//hasAntialiasing ? 1 : smallVal);
  }

  function setHasAntialiasing(b) {
    hasAntialiasing = b;
  }

  return {
    generateTexture,
    setHasAntialiasing,
    hasAntialiasing: () => hasAntialiasing
  };
})();
