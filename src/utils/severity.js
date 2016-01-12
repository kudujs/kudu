define(function (require) {

	function severity() {

		this.DEBUG = 0;
		this.INFO = 1;
		this.WARNING = 2;
		this.ERROR = 3;
	}

	return new severity();
});
