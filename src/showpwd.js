//!require showpwd.html
//!require showpwd.css
//!require keyfn.js
//!require keystore.js
//!require domain_norm.js

(function(){
	
	"use strict";
	
	
	PPG.showpwd = function(site) {
		var site = PPG.normalize_domain(site)
		
		return PPG.KeyStoreIDB.getSite(site)
			.then(function(siteInfo) {
			var origSiteInfo;
			var newsite = false;
			
			if (siteInfo.time) {
				PPG.KeyStoreIDB.setSite(site,siteInfo.key, siteInfo.index, siteInfo.type);
			} else {
				newsite = true;
			}
			origSiteInfo = JSON.parse(JSON.stringify(siteInfo));
			
			function checkDNS(domain) {
				try {
					return fetch("https://cloudflare-dns.com/dns-query?name="+encodeURIComponent(domain),
							{"headers":{"accept":"application/dns-json"}})
							.then(function(x) {return x.json();})
							.then(function(x) {return x.Status == 0})
							.catch(function(){
								return false;
							});
				} catch (e) {
					return Promise.resolve(false);
				}
			}
			
			function update(v) {
				return PPG.KeyStoreIDB.get(siteInfo.key).then(function(secret) {
					var krnd = PPG.prepareKey(secret, site, siteInfo.index);
					v.setItemValue("chngkey", siteInfo.key);
					var pwd;
					switch (siteInfo.type) {
						case "pin4": pwd = PPG.generatePin(krnd, 4, false);break;
						case "pin6": pwd = PPG.generatePin(krnd, 6, false);break;
						case "pin8": pwd = PPG.generatePin(krnd, 8, false);break;
						case "pin_trezor1": pwd = PPG.generatePin(krnd, 6, true);break;
						case "alnum_12": pwd = PPG.generatePwdAlNum(krnd, 12);break;
						case "phrase_short": pwd = PPG.generatePhrase(krnd, 2);break;
						case "phrase_long": pwd = PPG.generatePhrase(krnd, 4);break;
						default: pwd = PPG.generatePassword(krnd);break;
					}
					v.setItemValue("pwd",pwd);						
					v.setItemValue("order", siteInfo.index+1);
					v.setItemValue("type", siteInfo.type);
					v.enableItem("prev", siteInfo.index > 0);
					var restore = siteInfo.key != origSiteInfo.key || siteInfo.index != origSiteInfo.index || siteInfo.type != origSiteInfo.type;
					v.enableItem("remember", restore || newsite);
					v.showItem("restore", restore);					
				});
			}
			
			
					
			return new Promise(function(ok) {
				var v = this.layout.load("showpwd").v;

				function handle_trash(eventName) {
					var nullit = false;
					var tm = setTimeout(function() {
						PPG.KeyStoreIDB.unsetSite(site).then(ok);
						nullit = true;
					},1000);
					TemplateJS.once(document.body,eventName).then(function() {
						if (nullit) return;
						clearTimeout(tm);
						var vv = TemplateJS.View.fromTemplate("longclicknote");
						vv.open();
						TemplateJS.delay(3000).then(vv.close.bind(vv));
					});
				}

				
				checkDNS(site).then(function(x) {
					if (!x) v.mark("err_notfound");
				})
				
				return PPG.KeyStoreIDB.list().then(function(klist) {
					v.showItem("dkey",klist.length>1);
					v.setItemValue("chngkey", klist);
					update(v);
					
					v.setItemValue("site",site);
					v.setDefaultAction(ok,"back");
					v.setItemEvent("next","click",function(){
						siteInfo.index++;
						update(v);
					});
					v.setItemEvent("prev","click",function(){
						siteInfo.index--;
						update(v);
					});
					v.setItemEvent("restore","click",function(){
						PPG.KeyStoreIDB.getSite(site).then(function(s) {
							siteInfo = s;
							update(v);
						});							
					});
					v.setItemEvent("remember","click",function(){
						PPG.KeyStoreIDB.setSite(site,siteInfo.key,siteInfo.index, siteInfo.type)
						.then(PPG.KeyStoreIDB.getSite.bind(PPG.KeyStoreIDB,site))
						.then(function(z) {
							origSiteInfo = z;
							newsite = false;
							update(v);
						});						
					});
					v.setItemEvent("trash", "touchstart", function(e) {
						e.preventDefault();
						handle_trash.call(this, "touchend");
					});
					v.setItemEvent("trash", "mousedown", function(e) {
						e.preventDefault();
						handle_trash.call(this, "mouseup");
					});
					v.setItemEvent("chngkey","change",function(e){
						siteInfo.key = e.target.value;
						siteInfo.index = 0;
						update(v);
					});
					v.setItemEvent("type","change",function(e){
						siteInfo.type = e.target.value;
						update(v);
					});
				});
			}.bind(this));			
		}.bind(this));
	};
	
	
	
})();