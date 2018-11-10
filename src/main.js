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
	}

	
	PPG.start = function() {
		document.getElementById("intro").hidden=true;	
		if (PPG.KeyStore.list().length == 0) {
			PPG.welcome_page()
			.then(PPG.add_new_key_dlg.bind(PPG))
			.then(function(kk){
				PPG.KeyStore.set(kk.key, kk.name);	
				PPG.main_page();
			}).catch(PPG.start.bind(PPG));
		} else {
			PPG.main_page();
		}
	}
	
	PPG.main_page = function() {
		console.log("main page");
	}

	
})();