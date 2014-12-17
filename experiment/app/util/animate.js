// A thin wrapper to initialize gsap-promise with our polyfill.
var Promise = require('es6-promise').Promise;
module.exports = require('vendor/gsap-promise/base')(Promise);
