//!require ppg_ns.js
//!require template/template.js

(function(){
	"use strict";
	
	PPG.layout = {
			curView:null,
			load:function(n) {
				var v = new TemplateJS.View.fromTemplate(n);
				var p;
				v._installFocusHandler();
				if (this.curView) {
					p = this.curView.replace(v);
				} else {
					p = v.open();
				}
				this.curView = v;
				return {
					v:v,
					p:p
				};				
			}
	};
	
})();