//!require ppg_ns.js
//!require layout.js
//!require keystore.js

//!require key_list.html
//!require key_list.css

(function(){

	"use strict;"

	function key_list() {
		
		return new Promise(function(ok){
			
			var v = this.layout.load("keylist").v;
			function fill() {
				return Promise.all([this.KeyStoreIDB.list(),this.KeyStoreIDB.getPrimary()])
				.then(function(rr) {
					var kk = rr[0];
					var prim = rr[1];				
					var data = kk.map(function(x) {
						return {
							"prim":{
								"value": x == prim,
								"!change":function() {
									this.KeyStoreIDB.setPrimary(x).then(fill.bind(this));
								}.bind(this)
							},
							"name":x,
							"del":{
								".hidden": x==prim,
								"!click":function() {
									var dlg = TemplateJS.View.fromTemplate("delconfirm");
									dlg.openModal();
									dlg.setItemValue("key",x);
									dlg.setDefaultAction(function(){
										dlg.close();
										this.KeyStoreIDB.unset(x).then(fill.bind(this));
									}.bind(this),"yes");
									dlg.setCancelAction(function(){
										dlg.close();									
									}.bind(this),"no");
								}.bind(this)
							}						
						};
					}.bind(this));
					v.setItemValue("rows",data);
					v.setItemValue("name",kk[0]);
					v.setData({
						onekey:{".hidden":kk.length != 1},
						tbl:{".hidden":kk.length == 1},
					});
				}.bind(this));				
			}
			fill.call(this);
			v.setItemEvent("back", "click", ok);			
			v.setItemEvent("plus", "click", function(){
				this.add_new_key_dlg().then(function(kk){					
					this.KeyStoreIDB.set(kk.key, kk.name)
					.then(function() {
						if (kk.setprimary) 
							return this.KeyStoreIDB.setPrimary(kk.name);
					}.bind(this)).then(function() {
						ok(key_list.call(this));
					}.bind(this));					
				}.bind(this),function(){
					ok(key_list.call(this));
				}.bind(this));
			}.bind(this));			
		}.bind(this));		
	}
	
	
	PPG.key_list = key_list;

})();
