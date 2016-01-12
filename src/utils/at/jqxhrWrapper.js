define(function (require) {

    var xhrWrapper = require("./xhrWrapper");

    function jqxhrWrapper() {

        var that = {};

        that.canWrap = function (obj) {
            if (isXhr(obj) && typeof obj.then === 'function') {
                return true;
            }
            return false;
        };

        that.wrap = function ($xhr) {
            var es6Promise = new Promise(function (resolve, reject) {

                $xhr.then(function (data, textStatus, jqXHR) {
                    resolve({data: data, status: textStatus, xhr: jqXHR});
                }, function (jqXHR, textStatus, errorThrown) {
                    reject({error: errorThrown, status: textStatus, xhr: jqXHR});
                });

                $xhr.then(resolve, reject);
            });
            es6Promise.abort = function () {
                $xhr.abort();
            };
            return es6Promise;

        };

        function isXhr(obj) {

            if (obj != null) {
                if (typeof obj.getAllResponseHeaders === 'function' && typeof obj.abort === 'function') {

                    // assume is a XHR
                    return true;
                }
            }

            return false;
        }

        return that;
    }
    return jqxhrWrapper();
});