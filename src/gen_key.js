//!require ppg_ns.js
//!require layout.js
//!require keyfn.js
//!require hmac-sha256.js

(function(){


	function generate_dlg() {
		
		
		return new Promise(function(ok, cancel){
			
			var v = this.layout.load("generate_key").v;
			
			
			function doGenerate() {
				var c = 0;
				v.unmark();
				var txt = v.readData()["passphrase"];
				if (txt.length < 8) {
					v.mark("errshort");					
				} else {
					v.enableItem("generate",false);
					this.prepareSecret(txt,20000,function(x) {
						if (!v.getRoot().isConnected) throw new Error("canceled");
						if (x > c) c = x;
						var pos = 100 - (x*100/c);
						v.setData({
							"progvalue":{
								".style.width":pos+"%"
							}
						});
					}).then(function(x){
						ok(x);
					});					
				}
			}
			
			v.open();
			v.setCancelAction(cancel.bind(this,"canceled"),"back");
			v.setDefaultAction(doGenerate.bind(this), "generate");			
		}.bind(this));
	}

	function add_new_key_dlg() {
		return generate_dlg.call(this).then(function(x){
			
			return new Promise(function(ok,cancel) {
			
				var v = this.layout.load("add_key_dlg").v;	
				v.setCancelAction(cancel.bind(this,"canceled"), "back" );
				v.setDefaultAction(function(){
					var res = v.readData();
					if (res.name.length == 0) {
						v.mark("errshort");
					} else {
						res.key = x;					
						ok(res);
					}
				},"ok");
			}.bind(this));
		}.bind(this));		
	}

	PPG.add_new_key_dlg = add_new_key_dlg;
	
})();
