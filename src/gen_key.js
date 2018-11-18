//!require ppg_ns.js
//!require layout.js
//!require keyfn.js
//!require hmac-sha256.js
//!require words.js

//!require gen_key.html
//!require gen_key.css

(function(){

	function normalize_passphrase(x) {
		return  x.replace(/\s+/g, " ").trim();
	}

	function generate_dlg() {
		
		
		return new Promise(function(ok, cancel){
			
			var v = this.layout.load("generate_key").v;
			var g_phrase;
			
			
			function randomPhrase() {
				var s = "";
				var array = new Uint32Array(8);
				window.crypto.getRandomValues(array);
				array.forEach(function(x){
					x = x % PPG.wordlist.length;
					s = s + " " + PPG.wordlist[x];
				});
				g_phrase = s.substr(1)
				v.setItemValue("passphrase", g_phrase);
				v.setItemValue("checkf", PPG.check_code(g_phrase));
			}
			
			
			function doGenerate() {
				var c = 0;
				v.unmark();
				var txt = v.readData()["passphrase"];
				txt = normalize_passphrase(txt);
				if (txt.length < 8) {
					v.mark("errshort");					
				} else {
					v.enableItem("generate",false);
					v.enableItem("randombtn",false);
					v.enableItem("passphrase",false);
					this.prepareSecret(txt,50000,function(x) {
						if (!v.getRoot().isConnected) throw new Error("canceled");
						if (x > c) c = x;
						var pos = 100 - (x*100/c);
						v.setData({
							"progvalue":{
								".style.width":pos+"%"
							}
						});
					}).then(function(x){
						ok({p:txt,k:x,check:txt==g_phrase});
					});					
				}
			}
					
			v.setCancelAction(cancel.bind(this,"canceled"),"back");
			v.setDefaultAction(doGenerate.bind(this), "generate");			
			v.setItemEvent("randombtn","click",randomPhrase);
			v.setItemEvent("passphrase","input",function(e){
				v.setItemValue("checkf", PPG.check_code(this.value));
			});
			randomPhrase();
		}.bind(this));
	}

	function add_new_key_dlg() {
		return generate_dlg.call(this).then(function(x){
			
			return new Promise(function(ok,cancel) {
			
				var v = this.layout.load("add_key_dlg").v;	
				v.setCancelAction(cancel.bind(this,"canceled"), "back" );
				v.showItem("check", x.check);
				v.setDefaultAction(function(){
					v.unmark();
					var res = v.readData();
					if (res.name.length == 0) {
						v.mark("errshort");
					} else if (x.check && normalize_passphrase(res.passphrase) != x.p) {
						v.mark("notmatch");					
					} else if (x.check && normalize_passphrase(res.checkf) != PPG.check_code(x.p)){
						v.mark("notcodematch");
					} else {
						res.key = x.k;					
						ok(res);
					}
				},"ok");
			}.bind(this));
		}.bind(this))
		.then(function(x){
			return new Promise(function(ok) {
				var v = this.layout.load("add_key_conf").v;
				v.setDefaultAction(function(){
					ok(x);
				},"ok");
			}.bind(this));
		}.bind(this));
	}

	PPG.add_new_key_dlg = add_new_key_dlg;
	
})();
