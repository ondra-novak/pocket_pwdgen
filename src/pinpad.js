//!require ppg_ns.js
//!require pinpad.html
//!require pinpad.css


(function(){
	"use strict";
	
	function showPinpad(checkfn, tries) {
		if (!tries) tries = 0;		
		return new Promise(function(ok,cancel) {
									
			var v = PPG.layout.load("pinpad").v;
			
			function reset(){
				v.setItemValue("dots","");
				pin="";
				pinbull="";				
			}
			
			var pin="";
			var pinbull="";
			var data = {};
			for (var i = 0; i < 10; i++) {
				data[""+i] = {
						"!click":function(x) {
							if (pin.length>=8) return;
							pin = pin+(""+x);
							pinbull = pinbull+"&#8226;";
							v.setData({
								"dots":{
									".innerHTML":pinbull
								}
							});
							v.enableItem("ok",pin.length>=4);
						}.bind(this,i)
				};
			};
			v.enableItem("ok",false);
			v.setData(data);			
			v.setDefaultAction(function() {
				

				Promise.resolve()
				.then(checkfn.bind(this,pin))
				.then(function(res){
					if (res) ok();
					else {
						++tries;
						if (tries == 3) cancel();
						else ok(showPinpad(checkfn,tries));
					}
				},reset);				
			},"ok");
			v.setCancelAction(function() {cancel();}, "back");			
		});
	}
	
	PPG.showPinpad = showPinpad;
	
	
	
})();
