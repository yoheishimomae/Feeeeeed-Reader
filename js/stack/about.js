var stack = {
	
	onLoad:function() {
		x$('button').on('click', function(e) {
			console.log(this)
			if (this.getAttribute) {
				var eventName = this.getAttribute('data-ev');
				app.run(Event[eventName])
			}
		});
	}
}