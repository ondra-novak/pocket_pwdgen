//!require ppg_ns.js
//!require layout.js

//!require welcome.css
//!require welcome.html


(function(){
	"use strict";
	
	PPG.welcome_page = function() {
		
		function show_page(idx) {
			return new Promise(function(next,back) {
				
				var v = this.layout.load("welcome_"+idx).v;
				v.setCancelAction(function() {
					next(idx-1);
					}, "back" );				
				v.setDefaultAction(function(){
					next(idx+1);
					},"next");
			}.bind(this));
		}
		
		
		function go_next_page(idx) {
			if (idx == 0 || idx > 6) return;
			return show_page.call(this,idx).then(go_next_page.bind(this));
		}
		
		return show_page.call(this,1).then(go_next_page.bind(this))
		
	};
	
	
	
})();