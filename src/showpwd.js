//!require showpwd.html
//!require showpwd.css
//!require keyfn.js
//!require keystore.js
//!require domain_norm.js

(function(){
	
	"use strict";
	
	
	PPG.showpwd = function(site) {
		var site = PPG.normalize_domain(site)
		
		var siteInfo = PPG.KeyStore.getSite(site);
		var origSiteInfo;
		var newsite = false;
		
		if (siteInfo.time) {
			PPG.KeyStore.setSite(site,siteInfo.key, siteInfo.index);
		} else {
			newsite = true;
		}
		origSiteInfo = PPG.KeyStore.getSite(site);
		
		function checkDNS(domain) {
			return fetch("https://cloudflare-dns.com/dns-query?name="+encodeURIComponent(domain),
					{"headers":{"accept":"application/dns-json"}})
					.then(function(x) {return x.json();})
					.then(function(x) {return x.Status == 0});
		}
		
		function update(v) {
			var secret = PPG.KeyStore.get(siteInfo.key);
			var krnd = PPG.prepareKey(secret, site, siteInfo.index);
			v.setItemValue("chngkey", siteInfo.key);
			v.setItemValue("pwd",PPG.generatePassword(krnd));						
			v.setItemValue("order", siteInfo.index+1);
			v.enableItem("prev", siteInfo.index > 0);
			var restore = siteInfo.key != origSiteInfo.key || siteInfo.index != origSiteInfo.index;
			v.enableItem("remember", restore || newsite);
			v.showItem("restore", restore);
		}
		
				
		return new Promise(function(ok) {
			var v = this.layout.load("showpwd").v;

			checkDNS(site).then(function(x) {
				if (!x) v.mark("err_notfound");
			})
			
			var klist = PPG.KeyStore.list();
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
				siteInfo = PPG.KeyStore.getSite(site);
				update(v);
			});
			v.setItemEvent("remember","click",function(){
				PPG.KeyStore.setSite(site,siteInfo.key,siteInfo.index);
				origSiteInfo = PPG.KeyStore.getSite(site);
				newsite = false;
				update(v);
			});
			v.setItemEvent("chngkey","change",function(e){
				siteInfo.key = e.target.value;
				siteInfo.index = 0;
				update(v);
			});
		}.bind(this));			
			
	};
	
	
	
})();