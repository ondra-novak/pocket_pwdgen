//!require settings.css
//!require settings.html

(function(){
	
	"use strict";
	
	
	PPG.settings= function() {
		return new Promise(function(ok) {
			var v = this.layout.load("settings").v;
			
			v.setDefaultAction(ok,"back");
			
			v.setItemEvent("keys","click",function(){
				location.hash = "#keys";
			});
			v.setItemEvent("lang","click",function(){
				delete localStorage["lang"];
				location.href="index.html"
			});
			v.setItemEvent("reset","click",function(){
				PPG.wipe().then(ok);
			});
		}.bind(this));
	};

	PPG.wipe= function() {
		return new Promise(function(ok) {
			var v = this.layout.load("wipe").v;
			
			v.setCancelAction(ok,"back");

			v.setItemEvent("ok","click",function(){
				var k = Object.keys(localStorage);
				k.forEach(function(x){
					delete localStorage[x];
				});
				location.href="index.html";
			})
		}.bind(this));
	};

})();
