
var CACHE = 'cache1';
var static_files = [
	"start_cs.html",
	"start_en.html",
	"img/icon.png",
	"files/code.js",
	"files/style.css",
	"manifest.json",
	"index.html"
	];
	
self.addEventListener('install', function(evt) {
	  console.log('INSTALL');
	  
	  evt.waitUntil(precache());
	  self.skipWaiting();
	  
});

self.addEventListener('activate', function(evt) {
	  console.log('ACTIVATE');
	  evt.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(evt) {
	  
	  if (evt.request.method != "GET") {
		  evt.respondWith(fetch(evt.request));
	  } else {
		  evt.respondWith(fromCache(evt.request)
				  .then(function(x) {
					  return x;
				  })
				  .catch(function() {
					  console.log("Reading from net: "+evt.request.url);
					  return fetch(evt.request);
		  }));
	  }
});

function precache() {
	  return caches.open(CACHE).then(function (cache) {
	    return cache.addAll(static_files);
	  });
	}

function fromCache(request) {
	  return caches.open(CACHE).then(function (cache) {
	    return cache.match(request).then(function (matching) {
	      return matching || Promise.reject('no-match');
	    });
	  });
	}

function update(request) {
	  return caches.open(CACHE).then(function (cache) {
	    return fetch(request).then(function (response) {
	      return cache.put(request, response);
	    });
	  }).catch(function(){});
	}

function update_from_response(request, response) {
	  return caches.open(CACHE).then(function (cache) {
	      return cache.put(request, response);
	    });
	}


