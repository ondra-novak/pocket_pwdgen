//!require showpwd.html
//!require showpwd.css
//!require keyfn.js
//!require keystore.js

(function(){
	
	"use strict";
	
	
	PPG.showpwd = function(site) {
		var p;
		if (site.startsWith("http://")) site = site.substr(7);
		if (site.startsWith("https://")) site = site.substr(8);

		if (site.startsWith("www.")) site = site.substr(4);
		var p = site.indexOf('/');
		if (p != -1) site = site.substr(0,p);
		
		var siteInfo = PPG.KeyStore.getSite(site);
		var origSiteInfo;
		
		if (siteInfo.time) {
			PPG.KeyStore.setSite(site,siteInfo.key, siteInfo.index);
			origSiteInfo = PPG.KeyStore.getSite(site);
		} else {
			origSiteInfo = {};
		}
		
		function update(v) {
			var secret = PPG.KeyStore.get(siteInfo.key);
			var krnd = PPG.prepareKey(secret, site, siteInfo.index);
			v.setItemValue("chngkey", siteInfo.key);
			v.setItemValue("pwd",PPG.generatePassword(krnd));						
			v.setItemValue("order", siteInfo.index+1);
			v.enableItem("prev", siteInfo.index > 0);
			var restore = siteInfo.key != origSiteInfo.key || siteInfo.index != origSiteInfo.index;
			v.enableItem("remember", restore);
			v.enableItem("restore", restore);
		}
		
		return new Promise(function(ok) {
			var v = this.layout.load("showpwd").v;

			v.setItemValue("chngkey", PPG.KeyStore.list());
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