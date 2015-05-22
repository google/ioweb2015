require('gsap');
require('gsap/src/uncompressed/plugins/ColorPropsPlugin');

module.exports = function(Promise) {
	function animateFunc(func, element, duration, opts) {
		opts = opts||{}
		return new Promise(function(resolve, reject) {
			opts.onComplete = resolve
			func(element, duration, opts)
		})
	}

	var animateTo = animateFunc.bind(null, TweenMax.to)

	var util = animateTo
	util.to = animateTo
	util.from = animateFunc.bind(null, TweenMax.from)
	
	util.set = function animateSet(element, params) {
		params = params||{}
		return new Promise(function(resolve, reject) {
			params.onComplete = resolve
			TweenMax.set(element, params)
		})
	}

	util.fromTo = function animateFromTo(element, duration, from, to) {
		to = to||{}
		return new Promise(function(resolve, reject) {
			to.onComplete = resolve
			TweenMax.fromTo(element, duration, from, to)
		})
	}

	;['staggerTo', 'staggerFrom'].forEach(function(fn) {
		var tweenFunc = TweenMax[fn]
		util[fn] = function(element, duration, from, stagger) {
			return new Promise(function(resolve, reject) {
				tweenFunc(element, duration, from, stagger, resolve)
			})
		}
	})

	util.staggerFromTo = function staggerFromTo(element, duration, from, to, stagger, position) {
		return new Promise(function(resolve, reject) {
			TweenMax.staggerFromTo(element, duration, from, to, stagger, resolve)
		})
	}


	util.all = Promise.all
	return util	
}