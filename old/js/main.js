var PPG = (function() {

	var default_config = {
			chunks: 3,
			chunklen_min: 4,
			chunklen_max: 5,
			upper_chars: 2
	}
	

	var KeyStore = {
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
				delete localStorage["key"+name];
			},
			list: function() {
				return Object.keys(localStorage)
					.filter(function(x) {return x.startsWith("key_")})
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
	}
	
	
	
	function prepareKey(secret, domain, index) {
		var msg = domain+"|"+index;
		var c = CryptoJS.HmacSHA256(msg,secret);
		return new RND(c.toString());
	} 

	function State() {
		this.current = "8caaa31e6a64728c8ce82deb0b820097896dfc5f66dbbf5914482ea69efd62bd";
		this.lastTm = Date.now;
		this.lastDiff = 9999999;
		this.lastCycles=200;
	}
	

	
	function prepareSecret(passphrase, cycles, progress) {

		if (!(this instanceof State)) {
			return prepareSecret.call(new State(), passphrase, cycles, progress);
		}
		
		if (progress === undefined) progress = null; 		
		var c = cycles > this.lastCycles?this.lastCycles:cycles;
		if (progress) progress(cycles);
		cycles-=c;
		return new Promise(function(ok) {
			for (var i = 0; i < c; i++) {
				current = CryptoJS.HmacSHA256(this.current,passphrase).toString();
			}
			var d = Date.now()
			
			var diff = d - this.lastTm;
			this.lastTm = d;
			if (diff < 500) {
				this.lastCycles *=2;
				this.lastDiff = diff;
			}
			
			if (cycles) {
				setTimeout(function() {
					ok(prepareSecret.call(this,passphrase, cycles,progress));
				}.bind(this),1);
			} else {
				ok(current);
			}
		}.bind(this));
	}
	
	
	var charset1="bcdfghjklmnpqrstvwxz";
	var charset2="aeiouy";
	var symbols=   "-:.+/";
	
	
	function generate_password(rnd, cfg) {
		
		if (cfg === undefined) cfg = default_config;
		
		function get_char(charset) {
			return charset.charAt(rnd.random(0,charset.length));
		}
		
		function gen_chunk(num) {
			var l = rnd.random(cfg.chunklen_min, cfg.chunklen_max+1);
			if (num) {
				for (var i = 0;i < l;i++) {
					buffer.push(""+rnd.random(0,10));
				}
			} else {
				var s = rnd.random(1,7);
				for (var i = 0;i < l;i++) {
					switch (s) {
					case 1: buffer.push(get_char(charset1)); s = 2;break;
					case 2: buffer.push(get_char(charset2)); s = rnd.random(3,5);break;
					case 3: buffer.push(get_char(charset1)); s = 5;break;
					case 4: buffer.push(get_char(charset2)); s = 6;break;
					case 5: buffer.push(get_char(charset2)); s = 1;break;
					case 6: buffer.push(get_char(charset1)); s = 2;break;
					}
					
				}
			}
		}
		
		var buffer = [];
		var num = rnd.random(0,cfg.chunks);
		
		for (var i = 0; i < cfg.chunks;++i) {
			if (i) buffer.push(get_char(symbols)); 
			gen_chunk(i==num);
		}
				
		var stopcnt = buffer.length*2;
		for (var i = 0; i < cfg.upper_chars; i++) {
			
			stopcnt--;
			if (stopcnt == 0) break;
			
			var pos = rnd.random(0,buffer.length);
			var x = buffer[pos];
			if (x>="a" && x<="z") {
				buffer[pos] = x.toUpperCase();
			} else {
				--i;
			}
		}


		return buffer.join("");
		
	}

	var layout = {
			curView:null,
			load:function(n) {
				var v = new TemplateJS.View.fromTemplate(n);
				var p;
				if (this.curView) {
					p = this.curView.replace(v);
				} else {
					p = v.open();
				}
				this.curView = v;
				return {
					v:v,
					p:p
				}				
			}
	};
	
	
	function generate_dlg() {
		
		
		return new Promise(function(ok, cancel){
			
			var v = layout.load("generate_key").v;
			
			
			function doGenerate() {
				var c = 0;
				v.unmark();
				var txt = v.readData()["passphrase"];
				if (txt.length < 8) {
					v.mark("errshort");					
				} else {
					v.enableItem("generate",false);
					prepareSecret(txt,20000,function(x) {
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
			v.setCancelAction(cancel,"back");
			v.setDefaultAction(doGenerate, "generate");			
		});
	}

	function add_new_key_dlg() {
		return generate_dlg().then(function(x){
			
			return new Promise(function(ok,cancel) {
			
				var v = layout.load("add_key_dlg").v;	
				v.setCancelAction(cancel, "back" );
				v.setDefaultAction(function(){
					var res = v.readData();
					res.key = x;
					ok(res);
				},"ok");
			});
		});		
	}
	
	function key_list() {
		return new Promise(function(ok){
			
			var v = layout.load("keylist").v;
			function fill() {
				var kk = KeyStore.list();
				var prim = KeyStore.getPrimary();
				var data = kk.map(function(x) {
					return {
						"prim":{
							"value": x == prim,
							"!change":function() {
								KeyStore.setPrimary(x);
								fill();
							}
						},
						"name":x,
						"del":{
							".hidden": x==prim,
							"!click":function() {
								var dlg = TemplateJS.View.fromTemplate("delconfirm");
								dlg.openModal();
								dlg.setItemValue("key",x);
								dlg.setDefaultAction(function(){
									KeyStore.unset(x);
									dlg.close();
									fill();
								},"yes");
								dlg.setCancelAction(function(){
									dlg.close();									
								},"no");
							}
						}						
					};
				});
				v.setItemValue("rows",data);
			}
			fill();
			v.setItemEvent("back", "click", ok);			
			v.setItemEvent("plus", "click", function(){
				add_new_key_dlg().then(function(kk){					
					KeyStore.set(kk.key, kk.name);
					if (kk.setprimary) KeyStore.setPrimary(kk.name);
					ok(key_list());
				},function(){
					ok(key_list());
				});
			});			
		});		
	}
	
	function openSite(x) {
		alert(x);
	}
	
	function mainPage() {
		var v = layout.load("mainscreen").v;
		var sites = KeyStore.listSites().map(function(x){
			var v =KeyStore.getSite(x);
			v.name = {value:x,
					 "!click":openSite.bind(null,x)};			
			return v;
		}).sort(function(a,b){
			return a.time>b.time?-1:a.time<b.time?-1:0;
		});
		v.setItemValue("recent",sites);
	}
	
	function main() {
		TemplateJS.View.lightbox_class="lightbox";
		if (KeyStore.empty()) {
			add_new_key_dlg().then(function(kk){
				KeyStore.set(kk.key,kk.name);
				KeyStore.setPrimary(kk.name);
				main();
			}, main);
		} else {
			mainPage();
		}
			
			
			
			
	}

	
	return {
		prepareKey:prepareKey,
		main:main,
		genpwd:generate_password,
		prepareSecret:prepareSecret,
		Config:function() {return Object.create(default_config);},
		KeyStore:KeyStore,
		key_list:key_list
	};

	


})();


