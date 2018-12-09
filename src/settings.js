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
			v.setItemEvent("security","click",function(){
				PPG.security().then(PPG.settings.bind(PPG)).then(ok);
			});
		}.bind(this));
	};

	PPG.wipe= function() {
		return new Promise(function(ok) {
			var v = this.layout.load("wipe").v;
			
			v.setCancelAction(ok,"back");

			v.setItemEvent("ok","click",function(){
				PPG.KeyStoreIDB.reset().then(function(){
					location.href="index.html";
					});
			})
		}.bind(this));
	};

	PPG.security = function() {
		return new Promise(function(ok) {
			var v = this.layout.load("security").v;

			PPG.KeyStoreIDB.getPIN().then(function(p) {
				if (p) v.setItemValue("needpin",true);				
			});
			PPG.KeyStoreIDB.getEnablePassphrase().then(function(p) {
				if (p) v.setItemValue("needpps",true);
			});
			v.setItemEvent("needpin", "click", function() {
				
				var z = v.readData();
				if (z.needpin) {
					var pin;
					ok(PPG.showPinpad(function(p){pin = p;return true;},"new")
					.then(function(){
						return PPG.showPinpad(function(z) {return z == pin;},"verify");						
					}).then(function(){
						return PPG.KeyStoreIDB.setPIN(pin)
					}).then(PPG.security.bind(PPG),PPG.security.bind(PPG)));
					
				} else {
					ok(PPG.showPinpad(function(z){
						return PPG.KeyStoreIDB.getPIN()
							.then(function(x) {return x==z;});
					},"normal").then(PPG.KeyStoreIDB.setPIN.bind(PPG.KeyStoreIDB,""))
					.then(PPG.security.bind(PPG),PPG.security.bind(PPG)));
				}
			});
			v.setItemEvent("needpps","click", function() {
				var z = v.readData();
				PPG.KeyStoreIDB.setEnablePassphrase(z.needpps);
			});
			
			
			
			v.setDefaultAction(ok,"back");
		}.bind(this));
		
	}
	
})();
