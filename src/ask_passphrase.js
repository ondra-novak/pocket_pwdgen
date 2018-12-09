//!require ppg_ns.js
//!require template/template.js
//!require ask_passphrase.html
//!require ask_passphrase.css

(function(){
	"use strict";


PPG.askPassphrase=function() {

	return new Promise(function(ok,cancel){
		
		
		var v = PPG.layout.load("ask_passphrase").v;
		
		v.setDefaultAction(function() {
			var r = v.readData();
			ok(r.passphrase);
		},"ok");
		v.setCancelAction(function() {
			cancel();
		}, "back");			
		v.setItemEvent("showpwd","click",function() {
			var t; 
			if (this.checked) t = {"type":"text"};
			else t = {"type":"password"};
			v.setData({
				"passphrase":t
			});
		});
		
	});
	
};

})();
