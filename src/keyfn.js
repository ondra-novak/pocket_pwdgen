//!require ppg_ns.js
//!require rnd.js
//!require hmac-sha256.js
//!require config.js

(function(){
	
	function prepareKey(secret, domain, index) {
		var msg = domain+"|"+index;
		var c = CryptoJS.HmacSHA256(msg,secret);
		return new RND(c.toString());
	}
	
	PPG.prepareKey = prepareKey;

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
	
	PPG.prepareSecret = prepareSecret;
	
	var charset1="bcdfghjklmnpqrstvwxz";
	var charset2="aeiouy";
	var symbols=   "/*-+.,";
	
	
	function generate_password(rnd, cfg) {
		
		if (cfg === undefined) cfg = PPG.default_config;
		
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

	PPG.generatePassword = generate_password;

	function generatePasswordFromCharset(charset, rnd, cnt) {
		if (cnt > charset.length) cnt = charset.length;
		var res = [];
		for (var i = 0; i < cnt; i++) {
			var r = rnd.random(0,charset.length);
			res.push(charset[r]);
			charset.splice(r,1);
		}
		return res.join("");
		
	}
	
	PPG.generatePin = function(rnd, cnt, trezor1) {
		var numbers = ['0','1','2','3','4','5','6','7','8','9'];
		if (trezor1) numbers.splice(0,1);
		return generatePasswordFromCharset(numbers, rnd, cnt);
	}
	
	PPG.generatePwdAlNum = function(rnd, cnt) {
		var n = [];
		for (i = 0; i < 9; i++) n.push(""+i);
		for (i = 0; i < 26; i++) {
			n.push(String.fromCharCode(i+65));
			n.push(String.fromCharCode(i+97));
		}
		return generatePasswordFromCharset(n, rnd, cnt);
	}

	PPG.generatePhrase = function(rnd, chunks) {
	
		function get_char(charset) {
			return charset.charAt(rnd.random(0,charset.length));
		}
		
		var n = [];
		for (var i = 0; i < chunks; i++) {
			n.push(" ");
			for (var j = 0; j < 3; j++) {
				n.push(get_char(charset1))
				n.push(get_char(charset2))
			}
		}
		return n.slice(1).join("");
	}

	
	PPG.check_code = function(x) {
		return CryptoJS.HmacSHA256("check",x).toString().substr(0,4);
	}
	
})();