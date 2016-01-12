define(function (require) {
	
	function mode() {
		
		this.DEV = 0;
		this.PROD = 1;
	}
	return new mode();
});
