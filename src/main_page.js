//!require ppg_ns.js
//!require layout.js
//!require keystore.js

//!require main_page.html
//!require main_page.css

(function(){

	"use strict;"

	
	
	PPG.main_page = function() {
		
		var v = this.layout.load("mainscreen").v;

		v.setData({
			"keyman_icon":{
				"!click":function() {
					PPG.key_list().then(PPG.main_page.bind(this));
				}.bind(this)
			},
			"showpwd":{
				"!click":function() {
					var d = v.readData();
					if (d.site.length == 0) {
						v.mark("errshort");						
					}
				}.bind(this)
			}
		});
				
	};
	
	
})();