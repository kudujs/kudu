define(function (require) {

	function fade() {

		var that = {};

		var speeds = {
			slow: 600,
			fast: 200,
			// Default speed
			default: 400
		};

		var fxOff = false;

		var queue = [];

		var queueObj = {
			fadeIn: false,
			el: null,
			cb: null,
			requestId: null,
			timeoutId: null,
		};

		that.off = function (val) {
			fxOff = val;
		};

		that.stop = function () {

			queue.forEach(function (item, i) {
				if (item.fadeIn) {
					item.el.style.opacity = 1;
				} else {
					item.el.style.opacity = 0;
				}

				if (item.timeoutId != null) {
					clearTimeout(item.timeoutId);
				}
				if (item.requestId != null) {
					cancelAnimationFrame(item.requestId);
				}

				if (item.cb != null) {
					item.cb();
					item.cb = null;
				}
			});
			// Reset queue and remove all handles to stored items
			queue = [];
		};

		that.queue = function () {
			return queue;
		};

		that.dequeue = function (item) {
			var i = queue.length - 1;
			while (i >= 0) {
				if (queue[i] === item) {
					queue.splice(i, 1);
					break;
				}
			}
		};

		that.fadeIn = function (el, options, cb) {
			if (typeof options === "function") {
				cb = options;
				options = {};
			}

			options = options || {};

			if (fxOff || options.duration == 0) {
				el.style.opacity = 1;
				if (cb) {
					cb();
				}
				return;
			}

			options.duration = calcDuration(options.duration);

			queueObj = {
				fadeIn: true,
				el: el,
				cb: cb
			};
			queue.push(queueObj);

			var temp = window.getComputedStyle(el).getPropertyValue("opacity");
			el.style.opacity = +temp;

			var last = +new Date();
			var tick = function () {

				var change = (new Date() - last) / options.duration;
				var val = +el.style.opacity + change;
				el.style.opacity = val;
				last = +new Date();

				if (+el.style.opacity < 1) {

					if (window.requestAnimationFrame) {
						queueObj.requestId = requestAnimationFrame(tick);
					} else {
						queueObj.timeoutId = setTimeout(tick, 16);
					}

				} else {
					that.dequeue(queueObj);
					if (queueObj.cb) {
						cb();
					}
				}
			};

			tick();
		};

		that.fadeOut = function (el, options, cb) {
			if (typeof options === "function") {
				cb = options;
				options = {};
			}

			options = options || {};

			if (fxOff || options.duration == 0) {
				el.style.opacity = 0;
				if (cb) {
					cb();
				}
				return;
			}

			options.duration = calcDuration(options.duration);

			queueObj = {
				fadeIn: false,
				el: el,
				cb: cb
			};
			queue.push(queueObj);

			var temp = window.getComputedStyle(el).getPropertyValue("opacity");
			el.style.opacity = +temp;

			var last = +new Date();
			var tick = function () {
				var change = (new Date() - last) / options.duration;
				var val = +el.style.opacity - change;
				el.style.opacity = val;
				last = +new Date();

				if (+el.style.opacity > 0) {
					if (window.requestAnimationFrame) {
						queueObj.requestId = requestAnimationFrame(tick);
					} else {
						queueObj.timeoutId = setTimeout(tick, 16);
					}

				} else {
					that.dequeue(queueObj);
					if (queueObj.cb) {
						cb();
					}
				}
			};

			tick();
		};

		function calcDuration(duration) {
			if (typeof duration !== "number") {
				duration = duration in speeds ? speeds[duration] : speeds.default;
			}
			return duration;
		}

		return that;
	}

	var fade = fade();
	return fade;
});

