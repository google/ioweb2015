/**
 * Wrapper to alter paths in case we're nested in some unexpected folder.
 * @param {string} absolutePath - The original path.
 * @return {string}
 */
module.exports = function assetPath(absolutePath) {
  'use strict';

  if (absolutePath.match(/:\/\//)) {
    return absolutePath;
  }

  return __STATIC_BASE_EXPERIMENT__ + absolutePath.replace(/^\//, '');
};
