define(function (require) {

	function xhrWrapper() {

		var that = {};

		that.isXhr = function (obj) {
			if (obj != null) {
				if (typeof obj.getAllResponseHeaders === 'function' && typeof obj.abort === 'function') {

					if (obj.then == null) {
						// assume is a XHR
						return true;
					}
				}
			}

			return false;
		};

		that.canWrap = function (obj) {
			return that.isXhr(obj);
		}

		that.wrap = function (xhr) {
			var status;
			var statusText;
			var error;
			var data;
			var isSuccess;

			var es6Promise = new Promise(function (resolve, reject) {

				xhr.addEventListener("load", transferComplete);
				xhr.addEventListener("error", transferFailed);
				xhr.addEventListener("abort", transferCancelled);

				if (xhr.upload != null) {
					xhr.upload.addEventListener("load", transferComplete);
					xhr.upload.addEventListener("error", transferFailed);
					xhr.upload.addEventListener("abort", transferCancelled);
				}

				function init() {
					status = xhr.status;
					statusText = xhr.statusText;
					data = xhr.responseText;
				}

				function initError() {
					error = statusText;
					if (status || !statusText) {
						statusText = "error";
						if (status < 0) {
							status = 0;
						}
					}
				}

				function transferComplete() {
					init();

					isSuccess = status >= 200 && status < 300 || status === 304;
					if (isSuccess) {
						// Success!
						// if no content
						if (status === 204) {
							statusText = "nocontent";

							// if not modified
						} else if (status === 304) {
							statusText = "notmodified";

						} else {
							statusText = "success";
							data = xhr.responseText;
						}

					} else {
						initError();
					}

					if (statusText === "error") {
						var options = {data: data, status: statusText, xhr: xhr, error: error};
						reject(options);

					} else {
						var options = {data: data, status: statusText, xhr: xhr, error: error};
						resolve(options);
					}
				}

				function transferFailed() {
					init();
					initError();
					var options = {data: data, status: statusText, xhr: xhr, error: error};
					reject(options);
				}

				function transferCancelled() {
					transferFailed();
				}

			});

			/*
			 xhr.then(function (data, textStatus, jqXHR) {
			 resolve({data: data, status: textStatus, xhr: jqXHR});
			 }, function (jqXHR, textStatus, errorThrown) {
			 reject({error: errorThrown, status: textStatus, xhr: jqXHR});
			 });
			 
			 xhr.then(resolve, reject);
			 });*/
			es6Promise.abort = function () {
				xhr.abort();
			};
			return es6Promise;
		}

		return that;
	}
	return xhrWrapper();
});

