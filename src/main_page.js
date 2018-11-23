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
					} else {
						location.hash = "#site="+encodeURIComponent(d.site);
					}
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
		PPG.KeyStoreIDB.listSites().then(function(ss) {
			ss = ss.sort(function(a,b){
				return b.time - a.time;
			}).slice(0,20).map(function(x){
				return {
					"":{
						"value":x.name,
						"!click":function() {
							location.hash = "#site="+encodeURIComponent(x.name);
						}
					}
				};
			});
		
			v.setItemValue("recent",ss);
			v.showItem("empty",ss.length == 0);
		});
		
		
	};
	
	
})();