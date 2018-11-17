//!require ppg_ns.js

PPG.KeyStore = {
			set:function(key, name) {
				localStorage["key_"+name] = key;
			},
			get:function(name) {
				return localStorage["key_"+name];
			},
			getPrimary: function() {
				return localStorage["primary_key"];
			},
			setPrimary: function(s) {
				localStorage["primary_key"] = s;
			},
			unset:function(name) {
				delete localStorage["key_"+name];
			},
			list: function() {
				return Object.keys(localStorage)
					.filter(function(x) {return x.startsWith("key_");})
					.map(function(x) {return x.substr(4);});
			},
			empty: function() {
				return this.list().length == 0;
			},
			setSite: function(site, key, index) {
				localStorage["site_"+site] = JSON.stringify({
					"key":key,
					"index":index,
					"time":Date.now()
				});				
			},
			accessSite: function(site) {
				var s = getSite(site);
				setSite(site, s.key, s.index);
			},
			getSite: function(site) {
				var z = localStorage["site_"+site];
				if (z === undefined) {
					var p = this.getPrimary();
					return {
						"key":p,
						"index":0
					};
				} else {
					return JSON.parse(z);
				}
			},
			listSites: function() {
				return Object.keys(localStorage)
					.filter(function(x) {return x.startsWith("site_")})
					.map(function(x) {return x.substr(5);})
			}
	};
