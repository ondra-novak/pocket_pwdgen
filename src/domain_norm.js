//!require suffixes.js

(function(){
	
	"use strict";
	
	function normalize_domain(text) {
		text = text.trim();
		if (text.startsWith('/')) return text.substr(1);
		if (text.startsWith("http://")) text = text.substr(7);
		else if (text.startsWith("https://")) text = text.substr(8);
		
		var sep = text.indexOf("/");
		if (sep != -1) text = text.substr(0,sep);
		sep = text.indexOf('@');
		if (sep != -1) text = text.substr(sep+1);
		
		text = text.toLowerCase();
		
		var w = text.split('.');
		while (w.length > 2) {
			var sl = w.slice(1);
			var f = w.join(".");
			var q = sl.join(".");
			var r = w.slice(2).join(".");
			var qr = PPG.domain_sfx[q];
			var rr = PPG.domain_sfx[r];
			if (qr === false) return f;
			if (rr === true) return f;
			w = sl;
		}
		
		return w.join(".");
	}
	

	PPG.normalize_domain = normalize_domain;
	
})();