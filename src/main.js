//!require ppg_ns.js
//!require template/template.js
//!require keystore.js

//!require welcome.js
//!require gen_key.js
//!require key_list.js
//!require main_page.js
//!require @svc service_worker.js

(function(){
	"use strict";
	
	PPG.main = function() {
		Promise.all([
			TemplateJS.once(document,"styles_loaded"),
			TemplateJS.delay(1000)]
		).then(this.start.bind(this));
	};

	
	PPG.hash_router = function() {
		var h = location.hash;
		h = h.substr(1);
		if (h.length == 0) {
			PPG.main_page();
		} else if (h.startsWith("site=")) {
			var site = decodeURIComponent(h.substr(5));
			PPG.showpwd(site).then(function(){
				window.history.back();
			});
		} else if (h == "keys") {
			PPG.key_list().then(function(){
				window.history.back();
			});
		}
	};
	
	PPG.start = function() {
		
		window.addEventListener("hashchange", PPG.hash_router.bind(PPG));
		
		document.getElementById("intro").hidden=true;	
		if (PPG.KeyStore.list().length == 0) {
			PPG.welcome_page()
			.then(PPG.add_new_key_dlg.bind(PPG))
			.then(function(kk){
				PPG.KeyStore.set(kk.key, kk.name);
				PPG.KeyStore.setPrimary(kk.name);
				PPG.main_page();
			}).catch(function(e) {
				console.error(e);
				PPG.start();
			}.bind(PPG));
		} else {
			if (location.hash.length) PPG.hash_router();
			else PPG.main_page();
		};
	}
	
	
})();