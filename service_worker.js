// timestamp: 1601132224

var CACHE = 'cache2';
var static_files = [
	"start_cs.html",
	"start_en.html",
	"img/icon256.png",
	"img/icon128.png",
	"img/icon64.png",
	"img/icon32.png",
	"img/trash.png",
	"img/settings.png",
	"img/back.png",
	"files/code.js",
	"files/style.css",
	"manifest_cs.json",
	"manifest_en.json",
	"index.html"
	];
	
self.addEventListener('install', function(evt) {
	  console.log('INSTALL');
	  
	  evt.waitUntil(precache());
	  self.skipWaiting();
	  
});

self.addEventListener('activate', function(evt) {
	  console.log('ACTIVATE');
	  evt.waitUntil(Promise.all([clients.claim(),delOldCaches()]));
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

function delOldCaches() {
    return caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.filter(function(cacheName) {
        	  return cacheName != CACHE;
          }).map(function(cacheName) {
            return caches.delete(cacheName);
          })
        );
      });
}

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


