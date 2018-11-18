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
/*		v.setItemEvent("keyman_icon","click",function() {
					location.hash = "#keys";
			});*/
		v.setItemEvent("keyman_icon","click",function() {
			PPG.settings().then(PPG.main_page.bind(PPG));
		});
		v.setItemEvent("scanqr","click",function() {
			var qrr = new PPG.QRReader(function(site) {
				location.hash="#site="+encodeURIComponent(site);
			});
			qrr.show().then(PPG.main_page.bind(PPG));				
		});
		var ss =PPG.KeyStore.listSites().sort(function(a,b){
			var ta = PPG.KeyStore.getSite(a);
			var tb = PPG.KeyStore.getSite(b);
			return tb.time - ta.time;
		}).slice(0,20).map(function(x){
			return {
				"":{
					"value":x,
					"!click":function() {
						location.hash = "#site="+encodeURIComponent(x);
					}
				}
			};
		});
		
		v.setItemValue("recent",ss);		
		
		
	};
	
	
})();