var stack = {
	
	onLoad:function() {		
		x$('ul li').on('click', function(e) {
			if (this.getAttribute) {
				var eventName = this.getAttribute('data-ev');
				app.run(Event[eventName])
			}
		});
	}
}