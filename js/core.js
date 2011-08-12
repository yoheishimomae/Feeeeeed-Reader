// These should remain unchanged as much as possible

/*------------------------------------------------------------
	AppCore - Event Broadcaster
------------------------------------------------------------*/

function AppCore() {
	var self = this;
	self.events = {};
	
	this.listen = function(type, callback, resp) {	
		if (!self.events[type]) self.events[type] = [];

		self.events[type].push({cb:callback, res:resp});
	};
	
	this.run = function(type, event) {
		var e = self.events[type];
		if (e && e.length > 0) {
			if (!event) event = {};
			event.ctype = type;

			for (var i = 0; i < e.length; i++) {				
				if (e[i] && e[i].cb) {
					e[i].cb.apply(e[i].res || self, [event]);
				}
			}
		}
	};
	
	this.add = function(obj) {
		for (var key in obj) {
			self[key] = obj[key];
		}
	};
}

/*------------------------------------------------------------
	Template Manager
------------------------------------------------------------*/

// Minified Mustache.js included at the very bttom
// Mustache.js - https://github.com/janl/mustache.js/

function StackManager(map) {
	this.templatePrefix = 'template/';
	
	this.map = map;
	this.counter = 0;	
	this.templates = {};
	this.jsFolder = 'js/stack/';
	this.stacks = [];
	this.depth = 0;
	this.dynamicPath = '?v=' + new Date().valueOf(); // prevents file stacks
	
	var self = this;
	
	this.createXhrBase = function(url) {
		var req = new XMLHttpRequest();
		req.open('GET', url, true);
	  	req.setRequestHeader("stacks-Control", "no-stacks");
	  	req.setRequestHeader("Content-type", "text/xml");
		return req;
	};
	
	this.localXhr = function(url, onComplete, onError) {	
		var req = self.createXhrBase(url);
		req.onreadystatechange = function() {
			if(req.readyState == 4)
				onComplete.call(req);
		};
		req.send();
	};
	
	this.goto = function(uid, opts) {
		var page = map[uid], 
		template = page.template, 
		js = page.js, 
		html = [],
		backwards = false,
		i = 0;
		self.loadStack(template, js, opts, uid);
	};
	
	this.loadStack = function(template, js, opts, uid) {
		var html = [],
		data = null,
		backwards = false,
		i = 0;
		stack = null;
		if (opts) {
			backwards = opts.backwards?true:false;
		}
		
		self.stacks[self.depth] = {template:template, js:js, opts:opts};
		self.depth++;
		
		function onJSLoad() {	
			self.loadMultiple(template, onTemplateLoad, true);
		}
		
		function onTemplateLoad() {
			for (i = 0; i < template.length; i++) {
				if (opts && opts.data) data = opts.data;
				html.push(self.create(template[i], data));
			}
			if (opts && opts.back) backwards = true;
			
			function onAnimationComplete() {
				if (stack && stack.onLoad) stack.onLoad.call(null);
			}
			Slide.run(html.join(''), document.getElementById('wrap'), backwards, onAnimationComplete);
		}
		self.loadJS(js, onJSLoad)
	};
	
	this.back = function(index) {
		var curindex = index != null ? index : self.depth-2;
		var stack = self.stacks[curindex], opts = null;
		if (stack) {
			opts = stack.opts || {};
			opts.back = true;
			if (index != null) {
				self.depth = index;
			}
			else {
				self.depth-=2;
			}				
			self.loadStack(stack.template, stack.js, opts);
			self.stacks.splice(self.depth, self.stacks.length);
		}
	};
	
	
	this.loadJS=function(js, cb) {
		if (!js || js==undefined || js.length == 0) {
			cb.call(null);
			return;
		}
		var i = 0, 
		jsPath = '',
		item = null,
		script = null,
		head = document.getElementsByTagName('HEAD').item(0);
		
		for (i = 0; i < head.childNodes.length; i++) {
			item = head.childNodes[i];
			if (item.getAttribute && item.getAttribute('data-temporary')) {
				head.removeChild(item);
			}
		}
		
		for (i = 0; i < js.length; i++) {
			jsPath = js[i];
			script= document.createElement("script");
			script.type = "text/javascript";
			script.src = self.jsFolder + jsPath + self.dynamicPath;
			//script['data-temporary'] = true;
			script.setAttribute('data-temporary', true);
			head.appendChild( script);
		}
		
		cb.call(null);
	};
	
	this.loadMultiple=function(templPaths, cb, assignkey) {
		var uid, key, url;
		self.called = false;
		if (cb) self.onTemplateLoadComplete = cb;
	
		for (key in templPaths) {
			self.counter++;
		}
			
		for (key in templPaths) {
			uid = assignkey ? templPaths[key] : key;
			if (self.templates[uid]) {
				self.counter--;
			}
			else {
				url = templPaths[key];
				self.loadTemplate(uid, url);
			}
		}
		if (self.counter == 0 && cb && !self.called) {
			cb.call(null);		
		}
			
	};

	this.loadTemplate=function(key, url) {
		self.localXhr(self.templatePrefix + url + self.dynamicPath, function(r) {
			self.templates[key] = this.responseText;
			self.onTemplateLoad();
		});
	};
	
	this.loadFromString=function(key, str) {
		self[key] = str;
	};

	this.onTemplateLoad=function() {
		self.counter--;
		
		if (self.counter == 0 && !self.called) {
			self.onTemplateLoadComplete();
			self.called = true;
		}
	};	

	this.create=function(key, data) {
		if (!data) data = {};
		return Mustache.to_html(self.templates[key], data);
	};
	
	
	this.loopCreate=function(key, data, len) {
		var html = [];
		len = len || data.length;
		for (var i = 0; i < len; i++) {
			html.push(self.create(key, data[i]));
		}
		return html.join('');
	};

	// Assign this to init in your main App.js if necessary
	this.onTemplateLoadComplete=function() {
	
	};
};

var slideLocked = false;

var Slide = {
	
	run:function(view, parent, backwards, cb) {

		if (!parent || parent.childNodes.length == 0) {
			var fade = new Fade();
			fade.run(view, parent);
			setTimeout(function() {
				if (cb) cb.call(null);	
			}, 10);
			return;
		}

		var back = backwards;
		var oldView = parent.childNodes[0];
		var w = oldView.offsetWidth;

		var containerStyle = 'width:' + w*2 + 'px;'; 	
		var style = '-webkit-transition: -webkit-transform 0.2s linear; float:left; width:' + w + 'px;';
		var view1 = parent.innerHTML;
		var view2 = view;
		var x = back ? 0 : -w;

		if (back) {		
			view1 = view;
			view2 = parent.innerHTML;
			style += '-webkit-transform: translate3d(' + -w + 'px, 0, 0);';
		}

		parent.innerHTML = '<div style=' + containerStyle + '><div id="slide1" style="' + style + '">' + view1 + '</div>' + '<div id="slide2" style="' + style + '">' + view2 + '</div></div>';

		slide1.style['-webkit-transform'] = 'translate3d(' + x + 'px, 0, 0)';
		slide2.style['-webkit-transform'] = 'translate3d(' + x + 'px, 0, 0)';

		setTimeout(function() {
			parent.innerHTML = view;
			setTimeout(function() {
				if (cb) cb.call(null);	
			}, 10);
		}, 300);
	}
};


function Fade() {
	
}

Fade.prototype.run = function(view, parent, cb) {
	var style = '-webkit-transition: opacity 0.2s linear; opacity: 0;';
	parent.innerHTML = '<div id="container1" style="' + style + '">' + view + '</div>';
	container1.style.opacity = 1;
};


var Mustache=function(){var Renderer=function(){};Renderer.prototype={otag:"{{",ctag:"}}",pragmas:{},buffer:[],pragmas_implemented:{"IMPLICIT-ITERATOR":true},context:{},render:function(template,context,partials,in_recursion){if(!in_recursion){this.context=context;this.buffer=[];}if(!this.includes("",template)){if(in_recursion){return template;}else{this.send(template);return;}}template=this.render_pragmas(template);var html=this.render_section(template,context,partials);if(in_recursion){return this.render_tags(html,context,partials,in_recursion);}this.render_tags(html,context,partials,in_recursion);},send:function(line){if(line!=""){this.buffer.push(line);}},render_pragmas:function(template){if(!this.includes("%",template)){return template;}var that=this;var regex=new RegExp(this.otag+"%([\\w-]+) ?([\\w]+=[\\w]+)?"+this.ctag);return template.replace(regex,function(match,pragma,options){if(!that.pragmas_implemented[pragma]){throw({message:"This implementation of mustache doesn't understand the '"+pragma+"' pragma"});}that.pragmas[pragma]={};if(options){var opts=options.split("=");that.pragmas[pragma][opts[0]]=opts[1];}return"";});},render_partial:function(name,context,partials){name=this.trim(name);if(!partials||partials[name]===undefined){throw({message:"unknown_partial '"+name+"'"});}if(typeof(context[name])!="object"){return this.render(partials[name],context,partials,true);}return this.render(partials[name],context[name],partials,true);},render_section:function(template,context,partials){if(!this.includes("#",template)&&!this.includes("^",template)){return template;}var that=this;var regex=new RegExp(this.otag+"(\\^|\\#)\\s*(.+)\\s*"+this.ctag+"\n*([\\s\\S]+?)"+this.otag+"\\/\\s*\\2\\s*"+this.ctag+"\\s*","mg");return template.replace(regex,function(match,type,name,content){var value=that.find(name,context);if(type=="^"){if(!value||that.is_array(value)&&value.length===0){return that.render(content,context,partials,true);}else{return"";}}else if(type=="#"){if(that.is_array(value)){return that.map(value,function(row){return that.render(content,that.create_context(row),partials,true);}).join("");}else if(that.is_object(value)){return that.render(content,that.create_context(value),partials,true);}else if(typeof value==="function"){return value.call(context,content,function(text){return that.render(text,context,partials,true);});}else if(value){return that.render(content,context,partials,true);}else{return"";}}});},render_tags:function(template,context,partials,in_recursion){var that=this;var new_regex=function(){return new RegExp(that.otag+"(=|!|>|\\{|%)?([^\\/#\\^]+?)\\1?"+that.ctag+"+","g");};var regex=new_regex();var tag_replace_callback=function(match,operator,name){switch(operator){case"!":return"";case"=":that.set_delimiters(name);regex=new_regex();return"";case">":return that.render_partial(name,context,partials);case"{":return that.find(name,context);default:return that.escape(that.find(name,context));}};var lines=template.split("\n");for(var i=0;i<lines.length;i++){lines[i]=lines[i].replace(regex,tag_replace_callback,this);if(!in_recursion){this.send(lines[i]);}}if(in_recursion){return lines.join("\n");}},set_delimiters:function(delimiters){var dels=delimiters.split(" ");this.otag=this.escape_regex(dels[0]);this.ctag=this.escape_regex(dels[1]);},escape_regex:function(text){if(!arguments.callee.sRE){var specials=['/','.','*','+','?','|','(',')','[',']','{','}','\\'];arguments.callee.sRE=new RegExp('(\\'+specials.join('|\\')+')','g');}return text.replace(arguments.callee.sRE,'\\$1');},find:function(name,context){name=this.trim(name);function is_kinda_truthy(bool){return bool===false||bool===0||bool;}var value;if(is_kinda_truthy(context[name])){value=context[name];}else if(is_kinda_truthy(this.context[name])){value=this.context[name];}if(typeof value==="function"){return value.apply(context);}if(value!==undefined){return value;}return"";},includes:function(needle,haystack){return haystack.indexOf(this.otag+needle)!=-1;},escape:function(s){s=String(s===null?"":s);return s.replace(/&(?!\w+;)|["<>\\]/g,function(s){switch(s){case"&":return"&amp;";case"\\":return"\\\\";case'"':return'\"';case"<":return"&lt;";case">":return"&gt;";default:return s;}});},create_context:function(_context){if(this.is_object(_context)){return _context;}else{var iterator=".";if(this.pragmas["IMPLICIT-ITERATOR"]){iterator=this.pragmas["IMPLICIT-ITERATOR"].iterator;}var ctx={};ctx[iterator]=_context;return ctx;}},is_object:function(a){return a&&typeof a=="object";},is_array:function(a){return Object.prototype.toString.call(a)==='[object Array]';},trim:function(s){return s.replace(/^\s*|\s*$/g,"");},map:function(array,fn){if(typeof array.map=="function"){return array.map(fn);}else{var r=[];var l=array.length;for(var i=0;i<l;i++){r.push(fn(array[i]));}return r;}}};return({name:"mustache.js",version:"0.3.0",to_html:function(template,view,partials,send_fun){var renderer=new Renderer();if(send_fun){renderer.send=send_fun;}renderer.render(template,view,partials);if(!send_fun){return renderer.buffer.join("\n");}}});}();

