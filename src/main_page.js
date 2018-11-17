//!require ppg_ns.js
//!require layout.js
//!require keystore.js
//!require showpwd.js

//!require main_page.html
//!require main_page.css

(function(){

	"use strict";
	
	PPG.main_page = function() {
		
		var v = this.layout.load("mainscreen").v;

		v.setDefaultAction(function() {
					var d = v.readData();
					if (d.site.length == 0) {
						v.mark("errshort");						
					}
			
					location.hash = "#site="+encodeURIComponent(d.site);
				}.bind(this),"showpwd");
		v.setItemEvent("keyman_icon","click",function() {
					location.hash = "#keys";
			});
	};
	
	
})();