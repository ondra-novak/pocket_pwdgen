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
			setSite: function(site, key, index, type) {
				localStorage["site_"+site] = JSON.stringify({
					"key":key,
					"index":index,
					"type":type,
					"time":Date.now()
				});				
			},
			unsetSite:function(site) {
				delete localStorage["site_"+site];
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
			},
			reset: function() {
				this.list().forEach(function(x){
					this.unset(x);
				}, this);
				this.listSites().forEach(function(x){
					this.unsetSite(x);
				},this);
				delete localStorage["primary_key"];
			}
	};
(function(){
	"use strict";
	
	PPG.KeyStoreIDB = {
		init: function() {
			return new Promise(function(ok,error) {
	        var request = window.indexedDB.open("ppg_storage", 1);
	         
	         request.onerror = error;	            	         
	         
	         request.onsuccess = function(event) {	            
  	            this.db = request.result;
  	            ok();
	         }.bind(this);
	         
	         request.onupgradeneeded = function(event) {
	            var db = event.target.result;
	            var ver = event.oldVersion;
	            if (ver < 1) {
	            	db.createObjectStore("keys", {keyPath: "name"});
		            db.createObjectStore("sites", {keyPath: "name"});
	            	db.createObjectStore("config", {keyPath: "id"});
	            }
	         }
			}.bind(this));
		},
		
		put_data: function(table, data) {
			return new Promise(function(ok, error) {
				 var request = this.db.transaction([table], "readwrite")
				 .objectStore(table)
				 .put(data);
				 request.onsuccess = ok;
				 request.onerror=error;
				}.bind(this));			
		},
		
		get_data: function(table, key) {
			return new Promise(function(ok, error) {
				 var request = this.db.transaction([table])
				 .objectStore(table)
				 .get(key);
				 request.onsuccess = function(evt) {
					 ok(request.result); 					 
				 }
				 request.onerror=error;
			}.bind(this));			
		},
		list_data: function(table) {
			return new Promise(function(ok, error) {
				var objectStore = this.db.transaction([table]).objectStore(table);
				var result = [];
				var c = objectStore.openCursor(); 
				c.onsuccess = function(event) {
					  var cursor = event.target.result;
					  if (cursor) {
						  result.push(cursor.value);
						  cursor.continue();
					  }
					  else {
					      ok(result);
					  }
				};
				c.onerror = error;
			}.bind(this));
		},
		delete_data: function(table, key) {
			return new Promise(function(ok, error) {
				 var request = this.db.transaction([table], "readwrite")
				 .objectStore(table)
				 .delete(key);
				 request.onsuccess = ok;
				 request.onerror=error;
				}.bind(this));						
		},
		set: function(key, name) {
			return this.put_data("keys",{name:name,key:key});
		},
		get: function(name) {
			return this.get_data("keys",name).then(function(x){return x.key;});		
		},
		setPrimary: function(v) {
			return this.put_data("config",{id:"active",value:v});
		},
		getPrimary: function(v) {
			return this.get_data("config","active").then(function(x){return x.value;});
		},
		unset:function(name) {
			return this.delete_data("keys",name);
		},
		list: function() {
			return this.list_data("keys").then(function(x){
				return x.map(function(z) {
					return z.name;
				});
			});
		},
		empty: function() {
			return this.list().then(function(x){return x.length == 0});
		},
		setSite: function(site, key, index, type) {
			return this.put_data("sites",{
				name:site,
				key:key,
				index:index,
				type:type,
				time:Date.now()
			});
		},
		unsetSite:function(site) {
			return this.delete_data("sites",site);
		},
		accessSite: function(site) {
			return this.getSite(site).then(function(x) {
				this.setSite(x.name, x.key, x.index);
			}.bind(this));			
		},
		getSite: function(site) {
			return this.get_data("sites", site).then(function(res) {
				if (!res) {
					return this.getPrimary().then(function(p){
						return {
							name:site,
							key:p,
							index:0
						};
					});
				} else {
					return res;
				}
			}.bind(this));
		},
		listSites: function() {
			return this.list_data("sites");
		},
		reset: function() {
			this.db.close()			
			return new Promise(function(ok,error) {
				var request =  indexedDB.deleteDatabase("ppg_storage");
				request.onsuccess = ok;
				request.onerror=error;
			}.bind(this));						
		},
		getPIN: function() {
			return this.get_data("config","pin").then(function(x){return x.value;});
		},
		setPIN: function(v) {
			return this.put_data("config",{id:"pin",value:v});
		},
		getEnablePassphrase: function() {
			return this.get_data("config","enable_passphrase").then(function(x){return x.value;});
		},
		setEnablePassphrase: function(v) {
			return this.put_data("config",{id:"enable_passphrase",value:v});
		},
	
	}
})();
