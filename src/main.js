//!require ppg_ns.js
//!require template/template.js
//!require keystore.js

//!require welcome.js
//!require gen_key.js
//!require key_list.js
//!require main_page.js
//!require @svc service_worker.js
//!require @manifest manifest.json
//!require settings.js
//!require qrreader.js

(function(){
	"use strict";
	
	PPG.main = function() {
		var svc;
		if ('serviceWorker' in navigator) {
			svc = navigator.serviceWorker.register('service_worker.js');
		} else {
			svc = Promise.resolve();
		}
		Promise.all([
			TemplateJS.once(document,"styles_loaded"),
			TemplateJS.delay(1000),
			svc
		]).then(this.start.bind(this));
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
		} else if (h == "qr") {
			var qrr = new PPG.QRReader(function(site) {
				location.href
			});
			qrr.show().then(function(){
				window.history.back();
			});
		}
	};
	
	function fixScreenSize() {
		var w = document.documentElement.clientWidth;
		var h = document.documentElement.clientHeight;
		if (h < w) w = h;
		
		var sheet = document.createElement('style')
		
		document.body.style.width=w+"px";
		sheet.innerHTML = ".fixedWidth {width: "+w+"px !important;}";
		document.body.appendChild(sheet);		
		document.body.style.width = w+"px";
	}
	
	PPG.start = function() {
		
		fixScreenSize();
		
		window.addEventListener("hashchange", PPG.hash_router.bind(PPG));
		PPG.KeyStoreIDB.init().then(function() {
			
			document.getElementById("intro").hidden=true;
			
			function welcome() {
				PPG.welcome_page()
				.then(PPG.add_new_key_dlg.bind(PPG))
				.then(function(kk){
					return Promise.all([
						PPG.KeyStoreIDB.set(kk.key, kk.name),
						PPG.KeyStoreIDB.setPrimary(kk.name)
						]);
				})
				.then(PPG.main_page.bind(PPG))
				.catch(function(e) {
					console.error(e);
					welcome();
				}.bind(PPG));
				
			}
			PPG.KeyStoreIDB.empty().then(function(r) {
			
				if (r) {
					welcome();
				} else {
					if (location.hash.length) PPG.hash_router();
					else PPG.main_page();
				}
			});
		});
	};
	
	
})();