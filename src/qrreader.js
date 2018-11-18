//!require ppg_ns.js
//!require libqrread.js

//!require qrreader.html
//!require qrreader.css



(function(){
	"use strict";
	
	PPG.QRReader = function(handler) {
		this.handler = handler
	}
	
	var handle_error = function(e, view) {
		console.log(e.name);
		if (e.name == "NotAllowedError"){
			view.mark("err_notallow");
		} else if (e.name == "NotFoundError"){
			view.mark("err_notfound");		
		} else if (e.name == "NotReadableError"){
			view.mark("err_notwork");		
		} else if (e.name == "SecurityError"){
			view.mark("err_security");		
		} else {
			view.mark("err_internal");		
			
		}
	
	}
	
	PPG.QRReader.prototype.close = function() {
		this.stop_stream_fn_p.then(function(fn){
			if (fn) fn();
		});
		clearInterval(this.interval);
	}
	
	PPG.QRReader.prototype.init_video = function(video_element, view) {

		
		try {
			var options;
			var media =navigator.mediaDevices; 
			
			if (media) {
				return media.getUserMedia({
					audio: false,
					video: { facingMode:  "environment", aspectRatio:1,  } 
				}).then(function(stream) {
					return new Promise(function(ok) {
						video_element.srcObject = stream
						ok(function(){
							 var tracks = stream.getTracks();
	
							 tracks.forEach(function(track) {
							    track.stop();
							 });
	
							 video_element.srcObject = null;
							});
					});
				}).catch(function(e){
					handle_error(e, view);
					return null;
				});
			}							
		} catch (e) {
			handle_error(e,view);
			return Promise.resolve(null);
		}
	}
	
	PPG.QRReader.prototype.show = function() {
		
		return new Promise(function(ok) {
	
		var v = PPG.layout.load("qrscanner").v;
		var video_element = v.findElements("video_view")[0];
		var canvas_element = v.findElements("out-canvas")[0];
		var prev_result = null;
		var result_counter = 0;
		
		
		function scan_stage(stage){
			v.setData({
				"video_info":{
					"classList":{
						"stage0":stage == 0,
						"stage1":stage == 1,
						"stage2":stage == 2,
						"stage_err":stage == -1,
					}
				}
			});
		}
		
		var qr = new QrCode();
		qr.callback = function(error,result) {
			if (error) {
				prev_result = null;
				if (typeof error == "string") {
					if (error.indexOf("patterns:0") != -1) scan_stage(0);
					else if (error.indexOf("patterns:1") != -1 || error.indexOf("patterns:2") != -1) scan_stage(1);
					else {
						scan_stage(-1);					
						console.log(error);
					} 
				}
				result_counter = 0;
			} else {
				if (prev_result == result.result) {
					result_counter++;
					scan_stage(2)
					if (result_counter == 3) {
						this.handler(result.result);						
					}
				} else {
					prev_result = result.result;
					result_counter = 0;
				}
			}
		}.bind(this);
		
		this.stop_stream_fn_p = this.init_video(video_element,v).
			then(function(stopfn){
				
				if (stopfn) {
					var stream = video_element.srcObject;
					var h = stream.getVideoTracks()[0].getSettings().height;
					var w = stream.getVideoTracks()[0].getSettings().width;
					canvas_element.style.width = w+"px";
					canvas_element.style.height = h+"px";
					canvas_element.width = w;
					canvas_element.height = h;
					var gCtx =  canvas_element.getContext("2d");

				    var intr = setInterval(function(){
				    	gCtx.drawImage(video_element,0,0);				    	
				    	var data = gCtx.getImageData(0,0,w,h);
				    	qr.decode(data);
				    	if (!v.getRoot().isConnected) {
				    		stopfn();
				    	}
				    },300);		
				    stopfn = function(intr, stopfn){
				    	clearInterval(intr);
				    	stopfn();
				    	
				    }.bind(this, intr, stopfn);
				} 
				return stopfn;
			});
		
		v.setCancelAction(ok,"back");
		}.bind(this));
				
	}
	
})();
