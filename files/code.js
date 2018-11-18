var PPG = {};

///declare namespace TemplateJS
var TemplateJS = function(){
	"use strict";

	function once(element, event, args) {

		return new Promise(function(ok) {
			
			function fire(z) {
				element.removeEventListener(event, fire, args);				
				ok(z);
			}			
			element.addEventListener(event, fire, args);
		});
	};
	
	function delay(time, arg) {
		return new Promise(function(ok) {
			setTimeout(function() {
				ok(arg);
			},time);
		});
	};
	
	
	function Animation(elem) {
		this.elem = elem;
		
		var computed = window.getComputedStyle(elem, null); 
		if (computed.animationDuration != "0" && computed.animationDuration != "0s") {
			this.type =  this.ANIMATION;
		} else if (computed.transitionDuration != "0" && computed.transitionDuration != "0s") {
			this.type = this.TRANSITION;
		} else {
			this.type = this.NOANIM;
		}	
	}
	 Animation.prototype.ANIMATION = 1;
	 Animation.prototype.TRANSITION = 2;
	 Animation.prototype.NOANIM = 0;
	
	 Animation.prototype.isAnimated = function() {
		return this.type != this.NOANIM;
	}
	 Animation.prototype.isTransition = function() {
		return this.type == this.TRANSITION;
	}
	 Animation.prototype.isAnimation = function() {
		return this.type == this.ANIMATION;
	}
	
	 Animation.prototype.restart = function() {
		var parent = this.elem.parentElement;
		var next = this.elem.nextSibling;
		parent.insertBefore(this.elem, next);		
	}
	
	 Animation.prototype.wait = function(arg) {
		var res;
		switch (this.type) {
			case this.ANIMATION: res = once(this.elem,"animationend");break;
			case this.TRANSITION: res = once(this.elem,"transitionend");break;
			default:
			case this.NOTHING:res = Promise.resolve();break;
		}
		if (arg !== undefined) {
			return res.then(function(){return arg;});
		} else {
			return res;
		}
	}

	///removes element from the DOM, but it plays "close" animation before removal
	/**
	 * @param element element to remove
	 * @param skip_anim remove element immediately, do not play animation (optional)
	 * @return function returns Promise which resolves once the element is removed
	 */
	function removeElement(element, skip_anim) {
		if (element.dataset.closeAnim && !skip_anim) {			
			if (element.dataset.openAnim) {
				element.classList.remove(element.dataset.openAnim);
			}			
			var closeAnim = element.dataset.closeAnim;
			element.classList.add(closeAnim);
			var anim = new Animation(element);
			if (anim.isAnimation()) 
				anim.restart();				
			return anim.wait()
				.then(removeElement.bind(null,element,true));				
		} else {
			element.parentElement.removeChild(element);
			return Promise.resolve();
		}		
	}
	
	function addElement(parent, element, before) {
		if (before === undefined) before = null;
		if (element.dataset.closeAnim) {
			element.classList.remove(element.dataset.closeAnim);
		}
		if (element.dataset.openAnim) {
			element.classList.add(element.dataset.openAnim);
		}
		parent.insertBefore(element,before);		
	}
	
	function createElement(def) {
		if (typeof def == "string") {
			return document.createElement(def);
		} else if (typeof def == "object") {
			if ("text" in def) {
				return document.createTextNode(def.text);
			} else if ("tag" in def) {
				var elem = document.createElement(def.tag);
				var attrs = def.attrs || def.attributes;
				if (typeof attrs == "object") {
					for (var i in attrs) {
						elem.setAttribute(i,attrs[i]);
					}
				}
				if ("html" in def) {
					elem.innerHTML=def.html;
				} else if ("text" in def) {
					elem.appendChild(document.createTextNode(def.text));
				} else {
					var content = def.content || def.value || def.inner;
					if (content !== undefined) {
						elem.appendChild(loadTemplate(content));
					}
				}
				return elem;
			}
		}
		return document.createElement("div");
	}
	
	function loadTemplate(templateID) {
		var tempel;
		if (typeof templateID == "string") {
			tempel = document.getElementById(templateID);
			if (!tempel) {
				throw new Error("Template element doesn't exists: "+templateID);				
			}
		} else if (typeof templateID == "object") {
			if (templateID instanceof Element) {
				tempel = templateID;
			} else if (Array.isArray(templateID)) {
				return templateID.reduce(function(accum,item){
					var x = loadTemplate(item);
					if (accum === null) accum = x; else accum.appendChild(x);
					return accum;
				},null)
			} else {
				var res = document.createDocumentFragment();
				res.appendChild(createElement(templateID));
				return res;
			}
		}
		var cloned;
		if ("content" in tempel) {
			cloned = document.importNode(tempel.content,true);
		} else {
			cloned = document.createDocumentFragment();
			var x= tempel.firstChild;
			while (x) {
				cloned.appendChild(x.cloneNode(true));
				x = x.nextSibling;
			}
		}
		return cloned;
		
	}
	
		
	function View(elem) {
		if (typeof elem == "string") elem = document.getElementById(elem);
		this.root = elem;
		this.marked =[];
		this.groups =[];
		this.rebuildMap();
		//apply any animation now
		if (this.root.dataset.openAnim) {
			this.root.classList.add(this.root.dataset.openAnim);
		}
		
	};
	
		
	///Get root element of the view
	View.prototype.getRoot = function() {
		return this.root;
	}
	
	///Replace content of the view
	/**
	 * @param elem element which is put into the view. It can be also instance of View
	 */
	View.prototype.setContent = function(elem) {
		if (elem instanceof View) 
			return this.setContent(elem.getRoot());		
		this.clearContent();
		this.defaultAction = null;
		this.cancelAction = null;
		this.root.appendChild(elem);
		this.rebuildMap();
	};
	
	///Replace content of the view generated from the template
	/**
	 * @param templateRef ID of the template
	 */
	View.prototype.loadTemplate = function(templateRef) {
		this.setContent(loadTemplate(templateRef));
	}
		
	View.prototype.replace = function(view, skip_wait) {
		
		var nx = this.getRoot().nextSibling;
		var parent = this.getRoot().parentElement;
		var newelm = view.getRoot();
		
		view.modal_elem = this.modal_elem;
		delete this.modal_elem;
		
		if (!skip_wait) {
			var mark = document.createComment("#");
			parent.insertBefore(mark,nx);
			return this.close().then(function(){				
				addElement(parent,view.getRoot(), mark);
				parent.removeChild(mark);
				return view;
			});
		} else {
			this.close();
			addElement(parent,view.getRoot(),nx);
			return Promise.resolve(view);
		}			
	}
	///Visibility state - whole view is hidden
	View.HIDDEN = 0;
	///Visibility state - whole view is visible
	View.VISIBLE = 1;
	///Visibility state - whole view is hidden, but still occupies area (transparent)
	View.TRANSPARENT=-1
	
	View.prototype.setVisibility = function(vis_state) {
		if (vis_state == View.VISIBLE) {
			this.root.hidden = false;
			this.root.style.visibility = "";
		} else if (vis_state == View.TRANSPARENT) {
			this.root.hidden = false;
			this.root.style.visibility = "hidden";			
		} else {
			this.root.hidden = true;
		}
	}
	
	View.prototype.show = function() {
		this.setVisibility(View.VISIBLE);
	}
	
	View.prototype.hide = function() {
		this.setVisibility(View.HIDDEN);
	}
	
	///Closes the view by unmapping it from the doom
	/** The view can be remapped through the setConent or open() 
	 * 
	 * @param skip_anim set true to skip any possible closing animation
	 *  
	 * @return function returns promise once the view is closed, this is useful especially when
	 * there is closing animation
	 * 
	 * */
	View.prototype.close = function(skip_anim) {				
		return removeElement(this.root).then(function() {		
			if (this.modal_elem) 
				this.modal_elem.parentElement.removeChild(this.modal_elem);			
		}.bind(this));
	}

	///Opens the view as toplevel window
	/** @note visual of toplevel window must be achieved through styles. 
	 * This function just only adds the view to root of page
	 * 
	 * @note function also installs focus handler allowing focus cycling by TAB key
	 */
	View.prototype.open = function() {
		document.body.appendChild(this.root);
		this._installFocusHandler();
	}

	///Opens the view as modal window
	/**
	 * Append lightbox which prevents accesing background of the window
	 * 
	 * @note function also installs focus handler allowing focus cycling by TAB key
	 */
	View.prototype.openModal = function() {
		if (this.modal_elem) return;
		var lb = this.modal_elem = document.createElement("light-box");
		if (View.lightbox_class) lb.classList.add(View.lightbox_class);
		else lb.setAttribute("style", "display:block;position:fixed;left:0;top:0;width:100vw;height:100vh;"+View.lightbox_style);
		document.body.appendChild(lb);
		this.open();
	//	this.setFirstTabElement()
	}
	
	View.clearContent = function(element) {
		var event = new Event("remove");
		var x =  element.firstChild
		while (x) {
			var y = x.nextSibling; 
			element.removeChild(x);
			x.dispatchEvent(event)
			x = y;
		}		
	}
	
	View.prototype.clearContent = function() {
		View.clearContent(this.root);
		this.byName = {};
	};
	
	///Creates view at element specified by its name
	/**@param name name of the element used as root of View
	 * 
	 * @note view is not registered as collection, so it is not accessible from the parent
	 * view though the findElements() function. However inner items are still visible directly
	 * on parent view.  
	 */
	View.prototype.createView = function(name) {
		var elem = this.findElements(name);
		if (!elem) throw new Error("Cannot find item "+name);		
		if (elem.length != 1) throw new Error("The element must be unique "+name);
		var view = new View(elem[0]);
		return view;
	};
	
	///Creates collection at given element
	/**
	 * @param selector which defines where collection is created. If there are multiple
	 * elements matching the selector, they are all registered as collection.
	 * @param name new name of collection. If the selector is also name of existing
	 * item, then this argument is ignored, because function replaces item by collection 
	 * 
	 * @note you don't need to call this function if you make collection by adding [] after
	 * the name 
	 */
	View.prototype.createCollection = function(selector, name) {
		var elems = this.findElements(selector);
		if (typeof selector == "string" && this.byName[selector]) name = selector;		
		var res = elems.reduce(function(sum, item){
			var x = new GroupManager(item, name);
			this.groups.push(x);
			sum.push(x);
			return sum;
		},[]); 
		this.byName[name] = res;
	};
	
	///Returns the name of class used for the mark() and unmark()
	/**
	 * If you need to use different name, you have to override this value
	 */
	View.prototype.markClass = "mark";	
	
	///Finds elements specified by selector or name
	/**
	 * @param selector can be either a string or an array. If the string is specified, then
	 * the sting can be either name of the element(group), which is specified by data-name or name
	 * or it can be a CSS selector if it starts by dot ('.'), hash ('#') or brace ('['). It
	 * can also start by $ to specify, that rest of the string is complete CSS selector, including
	 * a tag name ('$tagname'). If the selector is array, then only last item can be selector. Other
	 * items are names of collections as the function searches for the elements inside of 
	 * collections where the argument specifies a search path (['group-name','index1','index2','item'])
	 * 
	 * @note if `index1` is null, then all collections of given name are searched. if `index2` is
	 *  null, then result is all elements matching given selector for all items in the collection. This
	 *  is useful especially when item is name, because searching by CSS selector is faster if
	 *  achieveded directly from root
	 * 
	 *  
	 */
	View.prototype.findElements = function(selector) {
		if (typeof selector == "string") {
			if (selector) {
				var firstChar =selector.charAt(0);
				switch (firstChar) {
					case '.':
					case '[':			
					case '#': return Array.from(this.root.querySelectorAll(selector));
					case '$': return Array.from(this.root.querySelectorAll(selector.substr(1)));
					default: return selector in this.byName?this.byName[selector]:[];
				}
			} else {
				return [this.root];
			}
		} else if (Array.isArray(selector)) {
			if (selector.length==1) {
				return this.findElements(selector[0]);
			}
			if (selector.length) {
				var gg = this.byName[selector.shift()];
				if (gg) {
						var idx = selector.shift();
						if (idx === null) {
							return gg.reduce(function(sum,item){
								if (item.findElements)
									return sum.concat(item.findElements(selector));
								else 
									return sum;
							},[]);						
						} else {
							var g = gg[idx];
							if (g && g.findElements) {
								return g.findElements(selector);
							}
						}
					}
			}			
		} else if (typeof selector == "object" && selector instanceof Element) {
			return [selector];
		} 
		return [];
	}
	
	
	///Marks every element specified as CSS selector with a mark
	/**
	 * The mark class is stored in variable markClass. 
	 * This function is useful to mark elements for various purposes. For example if
	 * you need to highlight an error code, you can use selectors equal to error code. It
	 * will mark all elements that contain anything relate to that error code. Marked
	 * elements can be highlighted, or there can be hidden message which is exposed once
	 * it is marked
	 * 
	 */
	View.prototype.mark = function(selector) {
		var items = this.findElements(selector);
		var cnt = items.length;
		for (var i = 0; i < cnt; i++) {
			items[i].classList.add(this.markClass);
			this.marked.push(items[i]);
		}				
	};
		
	
	///Removes all marks
	/** Useful to remove any highlight in the View
	 */
	View.prototype.unmark = function() {
		var cnt = this.marked.length;
		for (var i = 0; i < cnt; i++) {
			this.marked[i].classList.remove(this.markClass);
		}
		this.marked = [];
	};
	
	///Installs keyboard handler for keys ESC and ENTER
	/**
	 * This function is called by setDefaultAction or setCancelAction, do not call directly
	 */
	View.prototype._installKbdHandler = function() {
		if (this.kbdHandler) return;
		this.kbdHandler = function(ev) {
			var x = ev.which || ev.keyCode;
			if (x == 13 && this.defaultAction && ev.target.tagName != "TEXTAREA" && ev.target.tagName != "BUTTON") {
				if (this.defaultAction(this)) {
					ev.preventDefault();
					ev.stopPropagation();
				}
			} else if (x == 27 && this.cancelAction) {
				if (this.cancelAction(this)) {
					ev.preventDefault();
					ev.stopPropagation();
				}			
			}		
		}.bind(this);
		this.root.addEventListener("keydown", this.kbdHandler);
	};
	
	///Sets function for default action
	/** Default action is action called when user presses ENTER. 
	 *
	 * @param fn a function called on default action. The function receives reference to
	 * the view as first argument. The function must return true to preven propagation
	 * of the event
	 * @param el_name optional, if set, corresponding element receives click event for default action
	 *                  (button OK in dialog)
	 * 
	 * The most common default action is to validate and sumbit entered data
	 */
	View.prototype.setDefaultAction = function(fn, el_name) {
		this.defaultAction = fn;
		this._installKbdHandler();
		if (el_name) {
			var data = {};
			data[el_name] = {"!click":fn};
			this.setData(data)
		}
	};

	///Sets function for cancel action
	/** Cancel action is action called when user presses ESC. 
	 *
	 * @param fn a function called on cancel action. The function receives reference to
	 * the view as first argument. The function must return true to preven propagation
	 * of the event

	 * @param el_name optional, if set, corresponding element receives click event for default action
	 *                  (button CANCEL in dialog)
	 * 
	 * The most common cancel action is to reset form or to exit current activity without 
	 * saving the data
	 */
	View.prototype.setCancelAction = function(fn, el_name) {
		this.cancelAction = fn;
		this._installKbdHandler();
		if (el_name) {
			var data = {};
			data[el_name] = {"!click":fn};
			this.setData(data)
		}
	};
	
	function walkDOM(el, fn) {
		var c = el.firstChild;
		while (c) {
			fn(c);
			walkDOM(c,fn);
			c = c.nextSibling;
		}
	}
	
	///Installs focus handler
	/** Function is called from setFirstTabElement, do not call directly */
	View.prototype._installFocusHandler = function(fn) {
		if (this.focus_top && this.focus_bottom) {
			if (this.focus_top.isConnected && this.focus_bottom.isConnected)
				return;
		}
		var focusHandler = function(where, ev) {
			setTimeout(function() {
				where.focus();
			},10);	
		};
		
		var highestTabIndex=null;
		var lowestTabIndex=null;
		var firstElement=null;
		var lastElement = null;
		walkDOM(this.root,function(x){
			if (typeof x.tabIndex == "number" && x.tabIndex != -1) {
				if (highestTabIndex===null) {
					highestTabIndex = lowestTabIndex = x.tabIndex;
					firstElement = x;
				} else {
					if (x.tabIndex >highestTabIndex) highestTabIndex = x.tabIndex;
					else if (x.tabIndex <lowestTabIndex) {
						lowestTabIndex= x.tabIndex;
						firstElement  = x;
					}
				}
				if (x.tabIndex == highestTabIndex) lastElement = x;
			}
		});
		
		if (firstElement && lastElement) {
			var le = document.createElement("focus-end");
			le.setAttribute("tabindex",highestTabIndex);
			le.style.display="block";
			this.root.appendChild(le);
			le.addEventListener("focus", focusHandler.bind(this,firstElement));
	
			var fe = document.createElement("focus-begin");
			fe.setAttribute("tabindex",highestTabIndex);
			fe.style.display="block";
			this.root.insertBefore(fe,this.root.firstChild);
			fe.addEventListener("focus", focusHandler.bind(this,lastElement));
			
			firstElement.focus();
		}				
		this.focus_top = firstElement;
		this.focus_bottom = lastElement;
	};
	
	///Sets first TAB element and installs focus handler (obsolete)
	/**
	 * @param el the first TAB element in the form, it also receives a focus. You should
	 * specify really first TAB, even if you need to move focus elsewhere. Just move the
	 * focus after setting the first TAB element.
	 * 
	 * The focus handler ensures that focus will not leave the current View by pressing TAB.
	 * key. Function provides of cycling of the focus on the View. The first TAB element 
	 * is need to have a home position defined.
	 */
	View.prototype.setFirstTabElement = function(el) {
		this._installFocusHandler();
	}
	
	function GroupManager(template_el,name) {
		this.baseEl = template_el;
		this.parent = template_el.parentNode;
		this.anchor = document.createComment("><");
		this.idmap={};
		this.result = [];
		this.curOrder =[];		
		this.parent.insertBefore(this.anchor, this.baseEl);
		this.parent.removeChild(this.baseEl);
		this.name = name;
		template_el.dataset.group=true;
		template_el.removeAttribute("data-name");
		template_el.removeAttribute("name");

	}
	
	GroupManager.prototype.isConnectedTo = function(elem) {
		return elem.contains(this.anchor);
	}
	
	GroupManager.prototype.begin = function() {
		this.result = [];
		this.newOrder = [];		
	}
	
	
	GroupManager.prototype.setValue = function(id, data) {			
		var x = this.idmap[id];
		if (!x) {
			var newel = this.baseEl.cloneNode(true);
			var newview = new View(newel);
			x = this.idmap[id] = newview;			
		} else {
			this.lastElem = x.getRoot();
		}
		this.newOrder.push(id);
		var t = data["@template"];
		if (t) {
			x.loadTemplate(t);
		}
		var res =  x.setData(data);
		res = this.result.concat(res);		
	}
	
	GroupManager.prototype.findElements = function(selector) {
		var item = selector.shift();
		if (item === null) {
			var res = [];
			for (var x in this.idmap) {
				res = res.concat(this.idmap[x].findElements(selector));
			}
			return res;
		} else {			
			return this.idmap[item]?this.idmap[item].findElements(selector):[];
		}
	}
	
	GroupManager.prototype.finish = function() {
		var newidmap = {};		
		this.newOrder.forEach(function(x){
			if (this.idmap[x]) {
				newidmap[x] = this.idmap[x];
				delete this.idmap[x];
			} else {
				throw new Error("Duplicate row id: "+x);
			
			}		
		},this);
		var oldp = 0;
		var oldlen = this.curOrder.length;		
		var newp = 0;
		var newlen = this.newOrder.length;
		var ep = this.anchor.nextSibling;
		var movedid = {};
		while (oldp < oldlen) {
			var oldid = this.curOrder[oldp];
			var newid = this.newOrder[newp];
			if (oldid in this.idmap) {
				oldp++;
				ep = this.idmap[oldid].getRoot().nextSibling;
			} else if (oldid == newid) {
				oldp++;
				newp++;
				ep = newidmap[oldid].getRoot().nextSibling;
			} else if (!movedid[oldid]) {
				this.parent.insertBefore(newidmap[newid].getRoot(),ep);
				newp++;
				movedid[newid] = true;
			} else {
				oldp++;
			}
		}
		while (newp < newlen) {			
			var newid = this.newOrder[newp];
			this.parent.insertBefore(newidmap[newid].getRoot(),ep);
			newp++;			
		}
		for (var x in this.idmap) {
			try {
				this.idmap[x].close();
			} catch (e) {
				
			}
		}
		
		this.idmap = newidmap;
		this.curOrder = this.newOrder;		
		this.newOrder = [];
		return this.result;
		
	}
	
	GroupManager.prototype.readData = function() {
	
		var out = [];		
		for (var x in this.idmap) {
			var d = this.idmap[x].readData();
			d["@id"] = x;
			out.push(d);			
		}
		return out;
		
	}
	
	///enables items
	/**
	 * @param name name of item
	 * @param enable true/false whether item has to be enabled
	 */
	View.prototype.enableItem = function(name, enable) {
		var d = {};
		d[name] = {"disabled":enable?null:""};
		this.setData(d);
	}

	///show or hide item
	/**
	 * @param name name of item
	 * @param showCmd true/false to show or hide item, or you can use constants View.VISIBLE,View.HIDDEN and View.TRANSPARENT
	 */
	View.prototype.showItem = function(name, showCmd) {
		var d = {};
		if (typeof showCmd == "boolean") {
			this.showItem(name,showCmd?View.VISIBLE:View.HIDDEN);
		}else {			
			if (showCmd == View.VISIBLE) {
				d[name] = {".hidden":false,".style.visibility":""};
			} else if (showCmd == View.TRANSPARENT) {
				d[name] = {".hidden":false,".style.visibility":"hidden"};
			} else {
				d[name] = {".hidden":true};
			}
		}
		this.setData(d);
	}

	///sets an event procedure to the item
	/**
	 * @param name name of item
	 * @param event name of event procedure
	 * @param fn function. To remove event procedure, specify null
	 * 
	 * @note it is faster to set the event procedure through setData along with other items
	 */
	View.prototype.setItemEvent = function(name, event, fn) {
		var d = {}
		var evdef = {};
		evdef["!"+event] = fn;
		d[name] = evdef;
		this.setData(d);
		
	}

	View.prototype.setItemValue = function(name, value) {
		var d = {};
		d[name] = {value:value}
		this.setData(d);
	}

	View.prototype.loadItemTemplate = function(name, template_name) {
		var v = View.createFromTemplate(template_name);
		this.setItemValue(name, v);
		return v;
	}
	
	View.prototype.clearItem = function(name) {
		this.setItemValue(name, null);
	}

	///Rebuilds map of elements
	/**
	 * This function is called in various situations especialy, after content of the
	 * View has been changed. The function must be called manually to register
	 * any new field added by function outside of the View.
	 * 
	 * After the map is builtm, you can access the elements through the variable byName["name"],
	 * Please do not modify the map manually
	 */
	View.prototype.rebuildMap = function(rootel) {
		if (!rootel) rootel = this.root;
		this.byName = {};
		
		this.groups = this.groups.filter(function(x) {return x.isConnectedTo(rootel);});
		this.groups.forEach(function(x) {this.byName[x.name] = [x];},this);
		
		function checkSubgroup(el) {
			while (el && el != rootel) {
				if (el.dataset.group) return true;
				el = el.parentElement;
			}
			return false;
		}
		
		var elems = rootel.querySelectorAll("[data-name],[name]");
		var cnt = elems.length;
		var i;
		for (i = 0; i < cnt; i++) {
			var pl = elems[i];
			if (rootel.contains(pl) && !checkSubgroup(pl)) {
				var name = pl.name || pl.dataset.name || pl.getAttribute("name");
				name.split(" ").forEach(function(vname) {
					if (vname) {
						if (vname && vname.endsWith("[]")) {
							vname = vname.substr(0,name.length-2);
							var gm = new GroupManager(pl, vname);
							this.groups.push(gm);
							if (!Array.isArray(this.byName[vname])) this.byName[vname] = [];
							this.byName[vname].push(gm);
						} else{
							if (!Array.isArray(this.byName[vname])) this.byName[vname] = [];
							this.byName[vname].push(pl);
						}
					}
				},this);

				}
			}		
	}
	
	///Sets data in the view
	/**
	 * @param structured data. Promise can be used as value, the value is rendered when the promise
	 *  is resolved
	 *  
	 * @return function returns array results generated during the process. It is
	 * purposed to return array of promises if any action require to perform operation using
	 * Promise. If there is no such operation, result is empty array. You can use Promise.all() 
	 * on result.
	 */
	View.prototype.setData = function(data) {
		var me = this;
		var results = [];
		
		function checkSpecialValue(val, elem) {
			if (val instanceof Element) {
				View.clearContent(elem)
				elem.appendChild(val);
				me.rebuildMap();
				return true;
			} else if (val instanceof View) {
				View.clearContent(elem)
				elem.appendChild(val.getRoot());
				me.rebuildMap();
				return true;
			}			
		}
		
		function processItem(itm, elemArr, val) {
					elemArr.forEach(function(elem) {
						var res /* = undefined*/;
						if (elem) {
							if (typeof val == "object") {
								if (checkSpecialValue(val,elem)) {
									return							
								} else if (!Array.isArray(val)) {
									updateElementAttributes(elem,val);
									if (!("value" in val)) {
										return;
									}else {
										val = val.value;
										if (typeof val == "object" && checkSpecialValue(val,elem)) return;
									}
								}
							}
							if (elem instanceof GroupManager) {
								var group = elem;
								group.begin();
								if (Array.isArray(val) ) {
									var i = 0;
									var cnt = val.length;
									for (i = 0; i < cnt; i++) {
										var id = val[i]["@id"] || i;
										group.setValue(id, val[i]);
									}
								}
								return group.finish();
							} else {
								var eltype = elem.tagName;
								if (elem.dataset.type) eltype = elem.dataset.type;			
								if (val !== undefined) {
									var eltypeuper = eltype.toUpperCase();
									if (View.customElements[eltypeuper]) {
										res = View.customElements[eltypeuper].setValue(elem,val);
									} else {
										res = updateBasicElement(elem, val);								
									}
								}
							}
						}
						return res;
					});
		
		}
		
		for (var itm in data) {
			var elemArr = this.findElements(itm);
			if (elemArr) {
				var val = data[itm];
				if (typeof val == "object" && (val instanceof Promise)) {
					results.push(val.then(processItem.bind(this,itm,elemArr)));
				} else {
					var r = processItem(itm,elemArr,val);
					if (typeof r != "undefined") results.push(r);
				}
			}
		}
		return results;
	}
	
	function updateElementAttributes (elem,val) {
		for (var itm in val) {
			if (itm == "value") continue;
			if (itm == "classList" && typeof val[itm] == "object") {
				for (var x in val[itm]) {
					if (val[itm][x]) elem.classList.add(x);
					else elem.classList.remove(x);
				}
			} else if (itm.substr(0,1) == "!") {
				var name = itm.substr(1);
				var fn = val[itm];
				if (!elem._t_eventHandlers) {
					elem._t_eventHandlers = {};
				}
				if (elem._t_eventHandlers && elem._t_eventHandlers[name]) {
					var reg = elem._t_eventHandlers[name];
					elem.removeEventListener(name,reg);
				}
				elem._t_eventHandlers[name] = fn;
				elem.addEventListener(name, fn);
			} else if (itm.substr(0,1) == ".") {				
				var name = itm.substr(1);
				var obj = elem;
				var nextobj;
				var idx;
				var subkey;
				while ((idx = name.indexOf(".")) != -1) {
					subkey = name.substr(0,idx);
					nextobj = obj[subkey];
					if (nextobj == undefined) {
						if (v !== undefined) nextobj = obj[subkey] = {};
						else return;
					}
					name = name.substr(idx+1);
					obj = nextobj;
				}
				var v = val[itm];
				if ( v === undefined) {
					delete obj[name];
				} else {
					obj[name] = v;
				}					
			} else if (val[itm]===null) {
				elem.removeAttribute(itm);
			} else {
				elem.setAttribute(itm, val[itm].toString())
			} 
		}
	}
	
	function updateInputElement(elem, val) {
		var type = elem.getAttribute("type");
		if (type == "checkbox" || type == "radio") {
			if (typeof (val) == "boolean") {
				elem.checked = !(!val);
			} else if (Array.isArray(val)) {
				elem.checked = val.indexOf(elem.value) != -1;
			} else if (typeof (val) == "string") {
				elem.checked = elem.value == val;
			} 
		} else {
			elem.value = val;
		}
	}
	
	
	function updateSelectElement(elem, val) {
		if (typeof val == "object") {
			var curVal = elem.value;
			View.clearContent(elem);
			if (Array.isArray(val)) {
				var i = 0;
				var l = val.length;
				while (i < l) {
					var opt = document.createElement("option");
					opt.appendChild(document.createTextNode(val[i].toString()));
					elem.appendChild(opt);
					i++;
				}
			} else {
				for (var itm in val) {
					var opt = document.createElement("option");
					opt.appendChild(document.createTextNode(val[itm].toString()));
					opt.setAttribute("value",itm);
					elem.appendChild(opt);				
				}
			}
			elem.value = curVal;
		} else {
			elem.value = val;
		}
	}
	
	function updateBasicElement (elem, val) {
		View.clearContent(elem);
		if (val !== null && val !== undefined) {
			elem.appendChild(document.createTextNode(val));
		}
	}

	///Reads data from the elements
	/**
	 * For each named element, the field is created in result Object. If there
	 * are multiple values for the name, they are put to the array.
	 * 
	 * Because many named elements are purposed to only display values and not enter
	 * values, you can mark such elements as data-readonly="1"
	 */
	View.prototype.readData = function(keys) {
		if (typeof keys == "undefined") {
			keys = Object.keys(this.byName);
		}
		var res = {};
		var me = this;
		keys.forEach(function(itm) {
			var elemArr = me.findElements(itm);
			elemArr.forEach(function(elem){			
				if (elem) {					
					if (elem instanceof GroupManager) {
						var x =  elem.readData();
						if (res[itm] === undefined) res[itm] = x;
						else x.forEach(function(c){res[itm].push(c);});
					} else if (!elem.dataset || !elem.dataset.readonly) {
						var val;
						var eltype = elem.tagName;
						if (elem.dataset.type) eltype = elem.dataset.type;
						var eltypeuper = eltype.toUpperCase();
						if (View.customElements[eltypeuper]) {
							val = View.customElements[eltypeuper].getValue(elem, res[itm]);
						} else {
							val = readBasicElement(elem,res[itm]);					
						}
						if (typeof val != "undefined") {
							res[itm] = val;
						}
					}
				}
			});
		});
		return res;
	}
	
	function readInputElement(elem, curVal) {
		var type = elem.getAttribute("type");
		if (type == "checkbox") {
			if (!elem.hasAttribute("value")) {
				return elem.checked;						
			} else {
				if (!Array.isArray(curVal)) {
					curVal = [];
				}
				if (elem.checked) {
					curVal.push(elem.value);
				}
				return curVal;
			}
		} else if (type == "radio") {
			if (elem.checked) return elem.value;
			else return curVal;
		} else {
			return elem.value;
		}
	}
	function readSelectElement(elem) {
		return elem.value;	
	}
		
	function readBasicElement(elem) {
		var group = elem.template_js_group;
		if (group) {
			return group.readData();			
		} else {
			if (elem.contentEditable == "true" ) {
				if (elem.dataset.format == "html")
					return elem.innerHTML;
				else 
					return elem.innerText;
			}
		}
	}
	
	///Registers custrom element
	/**
	 * @param tagName name of the tag
	 * @param customElementObject new CustomElementEvents(setFunction(),getFunction())
	 */
	View.regCustomElement = function(tagName, customElementObject) {
		var upper = tagName.toUpperCase();
		View.customElements[upper] = customElementObject;
	}

	///Creates root View in current page
	/**
	 * @param visibility of the view. Because the default value is View.HIDDEN, if called
	 * without arguments the view will be hidden and must be shown by the function show()
	 */
	View.createPageRoot = function(visibility /* = View.HIDDEN */) {
		var elem = document.createElement(View.topLevelViewName);
		document.body.appendChild(elem)
		var view = new View(elem);
		view.setVisibility(visibility);
		return view;
	}
	
	View.topLevelViewName = "div";
	
	///Creates view from template
	/**
	 * @param id of template. The template must by a single-root template or extra tag will be created
	 *  If you need to create from multi-root template, you need to specify definition of parent element
	 *  @param def parent element definition, it could be single tag name, or object, which 
	 *  specifies "tag" as tagname and "attrs" which contains key=value attributes
	 *  
	 *  @return newly created view
	 */
	View.fromTemplate = function(id, def) {
		var t = loadTemplate(id)
		var el = t.firstChild;
		var nx = el.nextSibling;
		if (nx != null) {
			if (nx.nodeType != Node.TEXT_NODE || nx.textContent.trim().length > 0) {
				el = createElement(def);
				el.appendChild(t);				
			}
		}
		return new View(el);
	}

	View.createFromTemplate = View.fromTemplate;
	
	View.createEmpty = function(tagName, attrs) {
		if (tagName === undefined) tagName = "div";
		var elem = document.createElement(tagName);
		if (attrs) {
			for (var v in attrs) {
				elem.setAttribute(v, attrs[v]);
			}
		}
		return new View(elem);			
	}
	
	function CustomElementEvents(setval,getval) {
		this.setValue = setval;
		this.getValue = getval;
		
	}

	View.customElements = {
			"INPUT":{
				"setValue":updateInputElement,
				"getValue":readInputElement,
			},
			"TEXTAREA":{
				"setValue":updateInputElement,
				"getValue":readInputElement,
			},
			"SELECT":{
				"setValue":updateSelectElement,
				"getValue":readSelectElement,
			},
			"IMG":{
				"setValue":function(elem,val) {
					elem.setAttribute("src",val);
				},
				"getValue":function(elem) {
					elem.getAttribute("src");
				}
			},
			"IFRAME":{
				"setValue":function(elem,val) {
					elem.setAttribute("src",val);
				},
				"getValue":function(elem) {
					elem.getAttribute("src");
				}
			}
	};

	///Lightbox style, mostly color and opacity
	View.lightbox_style = "background-color:black;opacity:0.25";
	///Lightbox class, if defined, style is ignored
	View.lightbox_class = "";
	
	
	return {
		"View":View,
		"loadTemplate":loadTemplate,
		"CustomElement":CustomElementEvents,
		"once":once,
		"delay":delay,
		"Animation":Animation,
		"removeElement":removeElement,
		"addElement":addElement
	};
	
}();




PPG.KeyStore = {
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
				delete localStorage["key_"+name];
			},
			list: function() {
				return Object.keys(localStorage)
					.filter(function(x) {return x.startsWith("key_");})
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
	};

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



(function(){
	"use strict";
	
	PPG.welcome_page = function() {
		
		function show_page(idx) {
			return new Promise(function(next,back) {
				
				var v = this.layout.load("welcome_"+idx).v;
				v.setCancelAction(function() {
					next(idx-1);
					}, "back" );				
				v.setDefaultAction(function(){
					next(idx+1);
					},"next");
			}.bind(this));
		}
		
		
		function go_next_page(idx) {
			if (idx == 0 || idx > 6) return;
			return show_page.call(this,idx).then(go_next_page.bind(this));
		}
		
		return show_page.call(this,1).then(go_next_page.bind(this))
		
	};
	
	
	
})();
var RND = (function(){
	
"use strict";
	
/**
 * Seedable random number generator functions.
 * @version 1.0.0
 * @license Public Domain
 *
 * @example
 * var rng = new RNG('Example');
 * rng.random(40, 50);  // =>  42
 * rng.uniform();       // =>  0.7972798995050903
 * rng.normal();        // => -0.6698504543216376
 * rng.exponential();   // =>  1.0547367609131555
 * rng.poisson(4);      // =>  2
 * rng.gamma(4);        // =>  2.781724687386858
 */

/**
 * @param {String} seed A string to seed the generator.
 * @constructor
 */
function RC4(seed) {
    this.s = new Array(256);
    this.i = 0;
    this.j = 0;
    for (var i = 0; i < 256; i++) {
        this.s[i] = i;
    }
    if (seed) {
        this.mix(seed);
    }
}

/**
 * Get the underlying bytes of a string.
 * @param {string} string
 * @returns {Array} An array of bytes
 */
RC4.getStringBytes = function(string) {
    var output = [];
    for (var i = 0; i < string.length; i++) {
        var c = string.charCodeAt(i);
        var bytes = [];
        do {
            bytes.push(c & 0xFF);
            c = c >> 8;
        } while (c > 0);
        output = output.concat(bytes.reverse());
    }
    return output;
};

RC4.prototype._swap = function(i, j) {
    var tmp = this.s[i];
    this.s[i] = this.s[j];
    this.s[j] = tmp;
};

/**
 * Mix additional entropy into this generator.
 * @param {String} seed
 */
RC4.prototype.mix = function(seed) {
    var input = RC4.getStringBytes(seed);
    var j = 0;
    for (var i = 0; i < this.s.length; i++) {
        j += this.s[i] + input[i % input.length];
        j %= 256;
        this._swap(i, j);
    }
};

/**
 * @returns {number} The next byte of output from the generator.
 */
RC4.prototype.next = function() {
    this.i = (this.i + 1) % 256;
    this.j = (this.j + this.s[this.i]) % 256;
    this._swap(this.i, this.j);
    return this.s[(this.s[this.i] + this.s[this.j]) % 256];
};

/**
 * Create a new random number generator with optional seed. If the
 * provided seed is a function (i.e. Math.random) it will be used as
 * the uniform number generator.
 * @param seed An arbitrary object used to seed the generator.
 * @constructor
 */
function RNG(seed) {
    if (seed == null) {
        seed = '' + Math.random() + Date.now();
    } else if (typeof seed === "function") {
        // Use it as a uniform number generator
        this.uniform = seed;
        this.nextByte = function() {
            return ~~(this.uniform() * 256);
        };
        seed = null;
    } else if (Object.prototype.toString.call(seed) !== "[object String]") {
        seed = JSON.stringify(seed);
    }
    this._normal = null;
    if (seed) {
        this._state = new RC4(seed);
    } else {
        this._state = null;
    }
}

/**
 * @returns {number} Uniform random number between 0 and 255.
 */
RNG.prototype.nextByte = function() {
    return this._state.next();
};

/**
 * @returns {number} Uniform random number between 0 and 1.
 */
RNG.prototype.uniform = function() {
    var BYTES = 7; // 56 bits to make a 53-bit double
    var output = 0;
    for (var i = 0; i < BYTES; i++) {
        output *= 256;
        output += this.nextByte();
    }
    return output / (Math.pow(2, BYTES * 8) - 1);
};

/**
 * Produce a random integer within [n, m).
 * @param {number} [n=0]
 * @param {number} m
 *
 */
RNG.prototype.random = function(n, m) {
    if (n == null) {
        return this.uniform();
    } else if (m == null) {
        m = n;
        n = 0;
    }
    return n + Math.floor(this.uniform() * (m - n));
};

/**
 * Generates numbers using this.uniform() with the Box-Muller transform.
 * @returns {number} Normally-distributed random number of mean 0, variance 1.
 */
RNG.prototype.normal = function() {
    if (this._normal !== null) {
        var n = this._normal;
        this._normal = null;
        return n;
    } else {
        var x = this.uniform() || Math.pow(2, -53); // can't be exactly 0
        var y = this.uniform();
        this._normal = Math.sqrt(-2 * Math.log(x)) * Math.sin(2 * Math.PI * y);
        return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y);
    }
};

/**
 * Generates numbers using this.uniform().
 * @returns {number} Number from the exponential distribution, lambda = 1.
 */
RNG.prototype.exponential = function() {
    return -Math.log(this.uniform() || Math.pow(2, -53));
};

/**
 * Generates numbers using this.uniform() and Knuth's method.
 * @param {number} [mean=1]
 * @returns {number} Number from the Poisson distribution.
 */
RNG.prototype.poisson = function(mean) {
    var L = Math.exp(-(mean || 1));
    var k = 0, p = 1;
    do {
        k++;
        p *= this.uniform();
    } while (p > L);
    return k - 1;
};

/**
 * Generates numbers using this.uniform(), this.normal(),
 * this.exponential(), and the Marsaglia-Tsang method.
 * @param {number} a
 * @returns {number} Number from the gamma distribution.
 */
RNG.prototype.gamma = function(a) {
    var d = (a < 1 ? 1 + a : a) - 1 / 3;
    var c = 1 / Math.sqrt(9 * d);
    do {
        do {
            var x = this.normal();
            var v = Math.pow(c * x + 1, 3);
        } while (v <= 0);
        var u = this.uniform();
        var x2 = Math.pow(x, 2);
    } while (u >= 1 - 0.0331 * x2 * x2 &&
             Math.log(u) >= 0.5 * x2 + d * (1 - v + Math.log(v)));
    if (a < 1) {
        return d * v * Math.exp(this.exponential() / -a);
    } else {
        return d * v;
    }
};

/**
 * Accepts a dice rolling notation string and returns a generator
 * function for that distribution. The parser is quite flexible.
 * @param {string} expr A dice-rolling, expression i.e. '2d6+10'.
 * @param {RNG} rng An optional RNG object.
 * @returns {Function}
 */
RNG.roller = function(expr, rng) {
    var parts = expr.split(/(\d+)?d(\d+)([+-]\d+)?/).slice(1);
    var dice = parseFloat(parts[0]) || 1;
    var sides = parseFloat(parts[1]);
    var mod = parseFloat(parts[2]) || 0;
    rng = rng || new RNG();
    return function() {
        var total = dice + mod;
        for (var i = 0; i < dice; i++) {
            total += rng.random(sides);
        }
        return total;
    };
};

return RNG;
})();
/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS=CryptoJS||function(h,s){var f={},g=f.lib={},q=function(){},m=g.Base={extend:function(a){q.prototype=this;var c=new q;a&&c.mixIn(a);c.hasOwnProperty("init")||(c.init=function(){c.$super.init.apply(this,arguments)});c.init.prototype=c;c.$super=this;return c},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var c in a)a.hasOwnProperty(c)&&(this[c]=a[c]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
r=g.WordArray=m.extend({init:function(a,c){a=this.words=a||[];this.sigBytes=c!=s?c:4*a.length},toString:function(a){return(a||k).stringify(this)},concat:function(a){var c=this.words,d=a.words,b=this.sigBytes;a=a.sigBytes;this.clamp();if(b%4)for(var e=0;e<a;e++)c[b+e>>>2]|=(d[e>>>2]>>>24-8*(e%4)&255)<<24-8*((b+e)%4);else if(65535<d.length)for(e=0;e<a;e+=4)c[b+e>>>2]=d[e>>>2];else c.push.apply(c,d);this.sigBytes+=a;return this},clamp:function(){var a=this.words,c=this.sigBytes;a[c>>>2]&=4294967295<<
32-8*(c%4);a.length=h.ceil(c/4)},clone:function(){var a=m.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var c=[],d=0;d<a;d+=4)c.push(4294967296*h.random()|0);return new r.init(c,a)}}),l=f.enc={},k=l.Hex={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++){var e=c[b>>>2]>>>24-8*(b%4)&255;d.push((e>>>4).toString(16));d.push((e&15).toString(16))}return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b+=2)d[b>>>3]|=parseInt(a.substr(b,
2),16)<<24-4*(b%8);return new r.init(d,c/2)}},n=l.Latin1={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++)d.push(String.fromCharCode(c[b>>>2]>>>24-8*(b%4)&255));return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b++)d[b>>>2]|=(a.charCodeAt(b)&255)<<24-8*(b%4);return new r.init(d,c)}},j=l.Utf8={stringify:function(a){try{return decodeURIComponent(escape(n.stringify(a)))}catch(c){throw Error("Malformed UTF-8 data");}},parse:function(a){return n.parse(unescape(encodeURIComponent(a)))}},
u=g.BufferedBlockAlgorithm=m.extend({reset:function(){this._data=new r.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=j.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var c=this._data,d=c.words,b=c.sigBytes,e=this.blockSize,f=b/(4*e),f=a?h.ceil(f):h.max((f|0)-this._minBufferSize,0);a=f*e;b=h.min(4*a,b);if(a){for(var g=0;g<a;g+=e)this._doProcessBlock(d,g);g=d.splice(0,a);c.sigBytes-=b}return new r.init(g,b)},clone:function(){var a=m.clone.call(this);
a._data=this._data.clone();return a},_minBufferSize:0});g.Hasher=u.extend({cfg:m.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){u.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(c,d){return(new a.init(d)).finalize(c)}},_createHmacHelper:function(a){return function(c,d){return(new t.HMAC.init(a,
d)).finalize(c)}}});var t=f.algo={};return f}(Math);
(function(h){for(var s=CryptoJS,f=s.lib,g=f.WordArray,q=f.Hasher,f=s.algo,m=[],r=[],l=function(a){return 4294967296*(a-(a|0))|0},k=2,n=0;64>n;){var j;a:{j=k;for(var u=h.sqrt(j),t=2;t<=u;t++)if(!(j%t)){j=!1;break a}j=!0}j&&(8>n&&(m[n]=l(h.pow(k,0.5))),r[n]=l(h.pow(k,1/3)),n++);k++}var a=[],f=f.SHA256=q.extend({_doReset:function(){this._hash=new g.init(m.slice(0))},_doProcessBlock:function(c,d){for(var b=this._hash.words,e=b[0],f=b[1],g=b[2],j=b[3],h=b[4],m=b[5],n=b[6],q=b[7],p=0;64>p;p++){if(16>p)a[p]=
c[d+p]|0;else{var k=a[p-15],l=a[p-2];a[p]=((k<<25|k>>>7)^(k<<14|k>>>18)^k>>>3)+a[p-7]+((l<<15|l>>>17)^(l<<13|l>>>19)^l>>>10)+a[p-16]}k=q+((h<<26|h>>>6)^(h<<21|h>>>11)^(h<<7|h>>>25))+(h&m^~h&n)+r[p]+a[p];l=((e<<30|e>>>2)^(e<<19|e>>>13)^(e<<10|e>>>22))+(e&f^e&g^f&g);q=n;n=m;m=h;h=j+k|0;j=g;g=f;f=e;e=k+l|0}b[0]=b[0]+e|0;b[1]=b[1]+f|0;b[2]=b[2]+g|0;b[3]=b[3]+j|0;b[4]=b[4]+h|0;b[5]=b[5]+m|0;b[6]=b[6]+n|0;b[7]=b[7]+q|0},_doFinalize:function(){var a=this._data,d=a.words,b=8*this._nDataBytes,e=8*a.sigBytes;
d[e>>>5]|=128<<24-e%32;d[(e+64>>>9<<4)+14]=h.floor(b/4294967296);d[(e+64>>>9<<4)+15]=b;a.sigBytes=4*d.length;this._process();return this._hash},clone:function(){var a=q.clone.call(this);a._hash=this._hash.clone();return a}});s.SHA256=q._createHelper(f);s.HmacSHA256=q._createHmacHelper(f)})(Math);
(function(){var h=CryptoJS,s=h.enc.Utf8;h.algo.HMAC=h.lib.Base.extend({init:function(f,g){f=this._hasher=new f.init;"string"==typeof g&&(g=s.parse(g));var h=f.blockSize,m=4*h;g.sigBytes>m&&(g=f.finalize(g));g.clamp();for(var r=this._oKey=g.clone(),l=this._iKey=g.clone(),k=r.words,n=l.words,j=0;j<h;j++)k[j]^=1549556828,n[j]^=909522486;r.sigBytes=l.sigBytes=m;this.reset()},reset:function(){var f=this._hasher;f.reset();f.update(this._iKey)},update:function(f){this._hasher.update(f);return this},finalize:function(f){var g=
this._hasher;f=g.finalize(f);g.reset();return g.finalize(this._oKey.clone().concat(f))}})})();

PPG.default_config = {
		chunks: 3,
		chunklen_min: 4,
		chunklen_max: 5,
		upper_chars: 2
};

 

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
	
	PPG.check_code = function(x) {
		return CryptoJS.HmacSHA256("check",x).toString().substr(0,4);
	}
	
})();
PPG.wordlist = [ "abandon", "ability", "able", "about", "above", "absent",
		"absorb", "abstract", "absurd", "abuse", "access", "accident",
		"account", "accuse", "achieve", "acid", "acoustic", "acquire",
		"across", "act", "action", "actor", "actress", "actual", "adapt",
		"add", "addict", "address", "adjust", "admit", "adult", "advance",
		"advice", "aerobic", "affair", "afford", "afraid", "again", "age",
		"agent", "agree", "ahead", "aim", "air", "airport", "aisle", "alarm",
		"album", "alcohol", "alert", "alien", "all", "alley", "allow",
		"almost", "alone", "alpha", "already", "also", "alter", "always",
		"amateur", "amazing", "among", "amount", "amused", "analyst", "anchor",
		"ancient", "anger", "angle", "angry", "animal", "ankle", "announce",
		"annual", "another", "answer", "antenna", "antique", "anxiety", "any",
		"apart", "apology", "appear", "apple", "approve", "april", "arch",
		"arctic", "area", "arena", "argue", "arm", "armed", "armor", "army",
		"around", "arrange", "arrest", "arrive", "arrow", "art", "artefact",
		"artist", "artwork", "ask", "aspect", "assault", "asset", "assist",
		"assume", "asthma", "athlete", "atom", "attack", "attend", "attitude",
		"attract", "auction", "audit", "august", "aunt", "author", "auto",
		"autumn", "average", "avocado", "avoid", "awake", "aware", "away",
		"awesome", "awful", "awkward", "axis", "baby", "bachelor", "bacon",
		"badge", "bag", "balance", "balcony", "ball", "bamboo", "banana",
		"banner", "bar", "barely", "bargain", "barrel", "base", "basic",
		"basket", "battle", "beach", "bean", "beauty", "because", "become",
		"beef", "before", "begin", "behave", "behind", "believe", "below",
		"belt", "bench", "benefit", "best", "betray", "better", "between",
		"beyond", "bicycle", "bid", "bike", "bind", "biology", "bird", "birth",
		"bitter", "black", "blade", "blame", "blanket", "blast", "bleak",
		"bless", "blind", "blood", "blossom", "blouse", "blue", "blur",
		"blush", "board", "boat", "body", "boil", "bomb", "bone", "bonus",
		"book", "boost", "border", "boring", "borrow", "boss", "bottom",
		"bounce", "box", "boy", "bracket", "brain", "brand", "brass", "brave",
		"bread", "breeze", "brick", "bridge", "brief", "bright", "bring",
		"brisk", "broccoli", "broken", "bronze", "broom", "brother", "brown",
		"brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb",
		"bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst",
		"bus", "business", "busy", "butter", "buyer", "buzz", "cabbage",
		"cabin", "cable", "cactus", "cage", "cake", "call", "calm", "camera",
		"camp", "can", "canal", "cancel", "candy", "cannon", "canoe", "canvas",
		"canyon", "capable", "capital", "captain", "car", "carbon", "card",
		"cargo", "carpet", "carry", "cart", "case", "cash", "casino", "castle",
		"casual", "cat", "catalog", "catch", "category", "cattle", "caught",
		"cause", "caution", "cave", "ceiling", "celery", "cement", "census",
		"century", "cereal", "certain", "chair", "chalk", "champion", "change",
		"chaos", "chapter", "charge", "chase", "chat", "cheap", "check",
		"cheese", "chef", "cherry", "chest", "chicken", "chief", "child",
		"chimney", "choice", "choose", "chronic", "chuckle", "chunk", "churn",
		"cigar", "cinnamon", "circle", "citizen", "city", "civil", "claim",
		"clap", "clarify", "claw", "clay", "clean", "clerk", "clever", "click",
		"client", "cliff", "climb", "clinic", "clip", "clock", "clog", "close",
		"cloth", "cloud", "clown", "club", "clump", "cluster", "clutch",
		"coach", "coast", "coconut", "code", "coffee", "coil", "coin",
		"collect", "color", "column", "combine", "come", "comfort", "comic",
		"common", "company", "concert", "conduct", "confirm", "congress",
		"connect", "consider", "control", "convince", "cook", "cool", "copper",
		"copy", "coral", "core", "corn", "correct", "cost", "cotton", "couch",
		"country", "couple", "course", "cousin", "cover", "coyote", "crack",
		"cradle", "craft", "cram", "crane", "crash", "crater", "crawl",
		"crazy", "cream", "credit", "creek", "crew", "cricket", "crime",
		"crisp", "critic", "crop", "cross", "crouch", "crowd", "crucial",
		"cruel", "cruise", "crumble", "crunch", "crush", "cry", "crystal",
		"cube", "culture", "cup", "cupboard", "curious", "current", "curtain",
		"curve", "cushion", "custom", "cute", "cycle", "dad", "damage", "damp",
		"dance", "danger", "daring", "dash", "daughter", "dawn", "day", "deal",
		"debate", "debris", "decade", "december", "decide", "decline",
		"decorate", "decrease", "deer", "defense", "define", "defy", "degree",
		"delay", "deliver", "demand", "demise", "denial", "dentist", "deny",
		"depart", "depend", "deposit", "depth", "deputy", "derive", "describe",
		"desert", "design", "desk", "despair", "destroy", "detail", "detect",
		"develop", "device", "devote", "diagram", "dial", "diamond", "diary",
		"dice", "diesel", "diet", "differ", "digital", "dignity", "dilemma",
		"dinner", "dinosaur", "direct", "dirt", "disagree", "discover",
		"disease", "dish", "dismiss", "disorder", "display", "distance",
		"divert", "divide", "divorce", "dizzy", "doctor", "document", "dog",
		"doll", "dolphin", "domain", "donate", "donkey", "donor", "door",
		"dose", "double", "dove", "draft", "dragon", "drama", "drastic",
		"draw", "dream", "dress", "drift", "drill", "drink", "drip", "drive",
		"drop", "drum", "dry", "duck", "dumb", "dune", "during", "dust",
		"dutch", "duty", "dwarf", "dynamic", "eager", "eagle", "early", "earn",
		"earth", "easily", "east", "easy", "echo", "ecology", "economy",
		"edge", "edit", "educate", "effort", "egg", "eight", "either", "elbow",
		"elder", "electric", "elegant", "element", "elephant", "elevator",
		"elite", "else", "embark", "embody", "embrace", "emerge", "emotion",
		"employ", "empower", "empty", "enable", "enact", "end", "endless",
		"endorse", "enemy", "energy", "enforce", "engage", "engine", "enhance",
		"enjoy", "enlist", "enough", "enrich", "enroll", "ensure", "enter",
		"entire", "entry", "envelope", "episode", "equal", "equip", "era",
		"erase", "erode", "erosion", "error", "erupt", "escape", "essay",
		"essence", "estate", "eternal", "ethics", "evidence", "evil", "evoke",
		"evolve", "exact", "example", "excess", "exchange", "excite",
		"exclude", "excuse", "execute", "exercise", "exhaust", "exhibit",
		"exile", "exist", "exit", "exotic", "expand", "expect", "expire",
		"explain", "expose", "express", "extend", "extra", "eye", "eyebrow",
		"fabric", "face", "faculty", "fade", "faint", "faith", "fall", "false",
		"fame", "family", "famous", "fan", "fancy", "fantasy", "farm",
		"fashion", "fat", "fatal", "father", "fatigue", "fault", "favorite",
		"feature", "february", "federal", "fee", "feed", "feel", "female",
		"fence", "festival", "fetch", "fever", "few", "fiber", "fiction",
		"field", "figure", "file", "film", "filter", "final", "find", "fine",
		"finger", "finish", "fire", "firm", "first", "fiscal", "fish", "fit",
		"fitness", "fix", "flag", "flame", "flash", "flat", "flavor", "flee",
		"flight", "flip", "float", "flock", "floor", "flower", "fluid",
		"flush", "fly", "foam", "focus", "fog", "foil", "fold", "follow",
		"food", "foot", "force", "forest", "forget", "fork", "fortune",
		"forum", "forward", "fossil", "foster", "found", "fox", "fragile",
		"frame", "frequent", "fresh", "friend", "fringe", "frog", "front",
		"frost", "frown", "frozen", "fruit", "fuel", "fun", "funny", "furnace",
		"fury", "future", "gadget", "gain", "galaxy", "gallery", "game", "gap",
		"garage", "garbage", "garden", "garlic", "garment", "gas", "gasp",
		"gate", "gather", "gauge", "gaze", "general", "genius", "genre",
		"gentle", "genuine", "gesture", "ghost", "giant", "gift", "giggle",
		"ginger", "giraffe", "girl", "give", "glad", "glance", "glare",
		"glass", "glide", "glimpse", "globe", "gloom", "glory", "glove",
		"glow", "glue", "goat", "goddess", "gold", "good", "goose", "gorilla",
		"gospel", "gossip", "govern", "gown", "grab", "grace", "grain",
		"grant", "grape", "grass", "gravity", "great", "green", "grid",
		"grief", "grit", "grocery", "group", "grow", "grunt", "guard", "guess",
		"guide", "guilt", "guitar", "gun", "gym", "habit", "hair", "half",
		"hammer", "hamster", "hand", "happy", "harbor", "hard", "harsh",
		"harvest", "hat", "have", "hawk", "hazard", "head", "health", "heart",
		"heavy", "hedgehog", "height", "hello", "helmet", "help", "hen",
		"hero", "hidden", "high", "hill", "hint", "hip", "hire", "history",
		"hobby", "hockey", "hold", "hole", "holiday", "hollow", "home",
		"honey", "hood", "hope", "horn", "horror", "horse", "hospital", "host",
		"hotel", "hour", "hover", "hub", "huge", "human", "humble", "humor",
		"hundred", "hungry", "hunt", "hurdle", "hurry", "hurt", "husband",
		"hybrid", "ice", "icon", "idea", "identify", "idle", "ignore", "ill",
		"illegal", "illness", "image", "imitate", "immense", "immune",
		"impact", "impose", "improve", "impulse", "inch", "include", "income",
		"increase", "index", "indicate", "indoor", "industry", "infant",
		"inflict", "inform", "inhale", "inherit", "initial", "inject",
		"injury", "inmate", "inner", "innocent", "input", "inquiry", "insane",
		"insect", "inside", "inspire", "install", "intact", "interest", "into",
		"invest", "invite", "involve", "iron", "island", "isolate", "issue",
		"item", "ivory", "jacket", "jaguar", "jar", "jazz", "jealous", "jeans",
		"jelly", "jewel", "job", "join", "joke", "journey", "joy", "judge",
		"juice", "jump", "jungle", "junior", "junk", "just", "kangaroo",
		"keen", "keep", "ketchup", "key", "kick", "kid", "kidney", "kind",
		"kingdom", "kiss", "kit", "kitchen", "kite", "kitten", "kiwi", "knee",
		"knife", "knock", "know", "lab", "label", "labor", "ladder", "lady",
		"lake", "lamp", "language", "laptop", "large", "later", "latin",
		"laugh", "laundry", "lava", "law", "lawn", "lawsuit", "layer", "lazy",
		"leader", "leaf", "learn", "leave", "lecture", "left", "leg", "legal",
		"legend", "leisure", "lemon", "lend", "length", "lens", "leopard",
		"lesson", "letter", "level", "liar", "liberty", "library", "license",
		"life", "lift", "light", "like", "limb", "limit", "link", "lion",
		"liquid", "list", "little", "live", "lizard", "load", "loan",
		"lobster", "local", "lock", "logic", "lonely", "long", "loop",
		"lottery", "loud", "lounge", "love", "loyal", "lucky", "luggage",
		"lumber", "lunar", "lunch", "luxury", "lyrics", "machine", "mad",
		"magic", "magnet", "maid", "mail", "main", "major", "make", "mammal",
		"man", "manage", "mandate", "mango", "mansion", "manual", "maple",
		"marble", "march", "margin", "marine", "market", "marriage", "mask",
		"mass", "master", "match", "material", "math", "matrix", "matter",
		"maximum", "maze", "meadow", "mean", "measure", "meat", "mechanic",
		"medal", "media", "melody", "melt", "member", "memory", "mention",
		"menu", "mercy", "merge", "merit", "merry", "mesh", "message", "metal",
		"method", "middle", "midnight", "milk", "million", "mimic", "mind",
		"minimum", "minor", "minute", "miracle", "mirror", "misery", "miss",
		"mistake", "mix", "mixed", "mixture", "mobile", "model", "modify",
		"mom", "moment", "monitor", "monkey", "monster", "month", "moon",
		"moral", "more", "morning", "mosquito", "mother", "motion", "motor",
		"mountain", "mouse", "move", "movie", "much", "muffin", "mule",
		"multiply", "muscle", "museum", "mushroom", "music", "must", "mutual",
		"myself", "mystery", "myth", "naive", "name", "napkin", "narrow",
		"nasty", "nation", "nature", "near", "neck", "need", "negative",
		"neglect", "neither", "nephew", "nerve", "nest", "net", "network",
		"neutral", "never", "news", "next", "nice", "night", "noble", "noise",
		"nominee", "noodle", "normal", "north", "nose", "notable", "note",
		"nothing", "notice", "novel", "now", "nuclear", "number", "nurse",
		"nut", "oak", "obey", "object", "oblige", "obscure", "observe",
		"obtain", "obvious", "occur", "ocean", "october", "odor", "off",
		"offer", "office", "often", "oil", "okay", "old", "olive", "olympic",
		"omit", "once", "one", "onion", "online", "only", "open", "opera",
		"opinion", "oppose", "option", "orange", "orbit", "orchard", "order",
		"ordinary", "organ", "orient", "original", "orphan", "ostrich",
		"other", "outdoor", "outer", "output", "outside", "oval", "oven",
		"over", "own", "owner", "oxygen", "oyster", "ozone", "pact", "paddle",
		"page", "pair", "palace", "palm", "panda", "panel", "panic", "panther",
		"paper", "parade", "parent", "park", "parrot", "party", "pass",
		"patch", "path", "patient", "patrol", "pattern", "pause", "pave",
		"payment", "peace", "peanut", "pear", "peasant", "pelican", "pen",
		"penalty", "pencil", "people", "pepper", "perfect", "permit", "person",
		"pet", "phone", "photo", "phrase", "physical", "piano", "picnic",
		"picture", "piece", "pig", "pigeon", "pill", "pilot", "pink",
		"pioneer", "pipe", "pistol", "pitch", "pizza", "place", "planet",
		"plastic", "plate", "play", "please", "pledge", "pluck", "plug",
		"plunge", "poem", "poet", "point", "polar", "pole", "police", "pond",
		"pony", "pool", "popular", "portion", "position", "possible", "post",
		"potato", "pottery", "poverty", "powder", "power", "practice",
		"praise", "predict", "prefer", "prepare", "present", "pretty",
		"prevent", "price", "pride", "primary", "print", "priority", "prison",
		"private", "prize", "problem", "process", "produce", "profit",
		"program", "project", "promote", "proof", "property", "prosper",
		"protect", "proud", "provide", "public", "pudding", "pull", "pulp",
		"pulse", "pumpkin", "punch", "pupil", "puppy", "purchase", "purity",
		"purpose", "purse", "push", "put", "puzzle", "pyramid", "quality",
		"quantum", "quarter", "question", "quick", "quit", "quiz", "quote",
		"rabbit", "raccoon", "race", "rack", "radar", "radio", "rail", "rain",
		"raise", "rally", "ramp", "ranch", "random", "range", "rapid", "rare",
		"rate", "rather", "raven", "raw", "razor", "ready", "real", "reason",
		"rebel", "rebuild", "recall", "receive", "recipe", "record", "recycle",
		"reduce", "reflect", "reform", "refuse", "region", "regret", "regular",
		"reject", "relax", "release", "relief", "rely", "remain", "remember",
		"remind", "remove", "render", "renew", "rent", "reopen", "repair",
		"repeat", "replace", "report", "require", "rescue", "resemble",
		"resist", "resource", "response", "result", "retire", "retreat",
		"return", "reunion", "reveal", "review", "reward", "rhythm", "rib",
		"ribbon", "rice", "rich", "ride", "ridge", "rifle", "right", "rigid",
		"ring", "riot", "ripple", "risk", "ritual", "rival", "river", "road",
		"roast", "robot", "robust", "rocket", "romance", "roof", "rookie",
		"room", "rose", "rotate", "rough", "round", "route", "royal", "rubber",
		"rude", "rug", "rule", "run", "runway", "rural", "sad", "saddle",
		"sadness", "safe", "sail", "salad", "salmon", "salon", "salt",
		"salute", "same", "sample", "sand", "satisfy", "satoshi", "sauce",
		"sausage", "save", "say", "scale", "scan", "scare", "scatter", "scene",
		"scheme", "school", "science", "scissors", "scorpion", "scout",
		"scrap", "screen", "script", "scrub", "sea", "search", "season",
		"seat", "second", "secret", "section", "security", "seed", "seek",
		"segment", "select", "sell", "seminar", "senior", "sense", "sentence",
		"series", "service", "session", "settle", "setup", "seven", "shadow",
		"shaft", "shallow", "share", "shed", "shell", "sheriff", "shield",
		"shift", "shine", "ship", "shiver", "shock", "shoe", "shoot", "shop",
		"short", "shoulder", "shove", "shrimp", "shrug", "shuffle", "shy",
		"sibling", "sick", "side", "siege", "sight", "sign", "silent", "silk",
		"silly", "silver", "similar", "simple", "since", "sing", "siren",
		"sister", "situate", "six", "size", "skate", "sketch", "ski", "skill",
		"skin", "skirt", "skull", "slab", "slam", "sleep", "slender", "slice",
		"slide", "slight", "slim", "slogan", "slot", "slow", "slush", "small",
		"smart", "smile", "smoke", "smooth", "snack", "snake", "snap", "sniff",
		"snow", "soap", "soccer", "social", "sock", "soda", "soft", "solar",
		"soldier", "solid", "solution", "solve", "someone", "song", "soon",
		"sorry", "sort", "soul", "sound", "soup", "source", "south", "space",
		"spare", "spatial", "spawn", "speak", "special", "speed", "spell",
		"spend", "sphere", "spice", "spider", "spike", "spin", "spirit",
		"split", "spoil", "sponsor", "spoon", "sport", "spot", "spray",
		"spread", "spring", "spy", "square", "squeeze", "squirrel", "stable",
		"stadium", "staff", "stage", "stairs", "stamp", "stand", "start",
		"state", "stay", "steak", "steel", "stem", "step", "stereo", "stick",
		"still", "sting", "stock", "stomach", "stone", "stool", "story",
		"stove", "strategy", "street", "strike", "strong", "struggle",
		"student", "stuff", "stumble", "style", "subject", "submit", "subway",
		"success", "such", "sudden", "suffer", "sugar", "suggest", "suit",
		"summer", "sun", "sunny", "sunset", "super", "supply", "supreme",
		"sure", "surface", "surge", "surprise", "surround", "survey",
		"suspect", "sustain", "swallow", "swamp", "swap", "swarm", "swear",
		"sweet", "swift", "swim", "swing", "switch", "sword", "symbol",
		"symptom", "syrup", "system", "table", "tackle", "tag", "tail",
		"talent", "talk", "tank", "tape", "target", "task", "taste", "tattoo",
		"taxi", "teach", "team", "tell", "ten", "tenant", "tennis", "tent",
		"term", "test", "text", "thank", "that", "theme", "then", "theory",
		"there", "they", "thing", "this", "thought", "three", "thrive",
		"throw", "thumb", "thunder", "ticket", "tide", "tiger", "tilt",
		"timber", "time", "tiny", "tip", "tired", "tissue", "title", "toast",
		"tobacco", "today", "toddler", "toe", "together", "toilet", "token",
		"tomato", "tomorrow", "tone", "tongue", "tonight", "tool", "tooth",
		"top", "topic", "topple", "torch", "tornado", "tortoise", "toss",
		"total", "tourist", "toward", "tower", "town", "toy", "track", "trade",
		"traffic", "tragic", "train", "transfer", "trap", "trash", "travel",
		"tray", "treat", "tree", "trend", "trial", "tribe", "trick", "trigger",
		"trim", "trip", "trophy", "trouble", "truck", "true", "truly",
		"trumpet", "trust", "truth", "try", "tube", "tuition", "tumble",
		"tuna", "tunnel", "turkey", "turn", "turtle", "twelve", "twenty",
		"twice", "twin", "twist", "two", "type", "typical", "ugly", "umbrella",
		"unable", "unaware", "uncle", "uncover", "under", "undo", "unfair",
		"unfold", "unhappy", "uniform", "unique", "unit", "universe",
		"unknown", "unlock", "until", "unusual", "unveil", "update", "upgrade",
		"uphold", "upon", "upper", "upset", "urban", "urge", "usage", "use",
		"used", "useful", "useless", "usual", "utility", "vacant", "vacuum",
		"vague", "valid", "valley", "valve", "van", "vanish", "vapor",
		"various", "vast", "vault", "vehicle", "velvet", "vendor", "venture",
		"venue", "verb", "verify", "version", "very", "vessel", "veteran",
		"viable", "vibrant", "vicious", "victory", "video", "view", "village",
		"vintage", "violin", "virtual", "virus", "visa", "visit", "visual",
		"vital", "vivid", "vocal", "voice", "void", "volcano", "volume",
		"vote", "voyage", "wage", "wagon", "wait", "walk", "wall", "walnut",
		"want", "warfare", "warm", "warrior", "wash", "wasp", "waste", "water",
		"wave", "way", "wealth", "weapon", "wear", "weasel", "weather", "web",
		"wedding", "weekend", "weird", "welcome", "west", "wet", "whale",
		"what", "wheat", "wheel", "when", "where", "whip", "whisper", "wide",
		"width", "wife", "wild", "will", "win", "window", "wine", "wing",
		"wink", "winner", "winter", "wire", "wisdom", "wise", "wish",
		"witness", "wolf", "woman", "wonder", "wood", "wool", "word", "work",
		"world", "worry", "worth", "wrap", "wreck", "wrestle", "wrist",
		"write", "wrong", "yard", "year", "yellow", "you", "young", "youth",
		"zebra", "zero", "zone", "zoo" ];


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


(function(){

	"use strict;"

	function key_list() {
		
		return new Promise(function(ok){
			
			var v = this.layout.load("keylist").v;
			function fill() {
				var kk = this.KeyStore.list();
				var prim = this.KeyStore.getPrimary();
				var data = kk.map(function(x) {
					return {
						"prim":{
							"value": x == prim,
							"!change":function() {
								this.KeyStore.setPrimary(x);
								fill.call(this);
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
									this.KeyStore.unset(x);
									dlg.close();
									fill.call(this);
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
				
			}
			fill.call(this);
			v.setItemEvent("back", "click", ok);			
			v.setItemEvent("plus", "click", function(){
				this.add_new_key_dlg().then(function(kk){					
					this.KeyStore.set(kk.key, kk.name);
					if (kk.setprimary) this.KeyStore.setPrimary(kk.name);
					ok(key_list.call(this));
				}.bind(this),function(){
					ok(key_list.call(this));
				}.bind(this));
			}.bind(this));			
		}.bind(this));		
	}
	
	
	PPG.key_list = key_list;

})();

PPG.domain_sfx={"ac":false,
"com.ac":false,
"edu.ac":false,
"gov.ac":false,
"net.ac":false,
"mil.ac":false,
"org.ac":false,
"ad":false,
"nom.ad":false,
"ae":false,
"co.ae":false,
"net.ae":false,
"org.ae":false,
"sch.ae":false,
"ac.ae":false,
"gov.ae":false,
"mil.ae":false,
"aero":false,
"accident-investigation.aero":false,
"accident-prevention.aero":false,
"aerobatic.aero":false,
"aeroclub.aero":false,
"aerodrome.aero":false,
"agents.aero":false,
"aircraft.aero":false,
"airline.aero":false,
"airport.aero":false,
"air-surveillance.aero":false,
"airtraffic.aero":false,
"air-traffic-control.aero":false,
"ambulance.aero":false,
"amusement.aero":false,
"association.aero":false,
"author.aero":false,
"ballooning.aero":false,
"broker.aero":false,
"caa.aero":false,
"cargo.aero":false,
"catering.aero":false,
"certification.aero":false,
"championship.aero":false,
"charter.aero":false,
"civilaviation.aero":false,
"club.aero":false,
"conference.aero":false,
"consultant.aero":false,
"consulting.aero":false,
"control.aero":false,
"council.aero":false,
"crew.aero":false,
"design.aero":false,
"dgca.aero":false,
"educator.aero":false,
"emergency.aero":false,
"engine.aero":false,
"engineer.aero":false,
"entertainment.aero":false,
"equipment.aero":false,
"exchange.aero":false,
"express.aero":false,
"federation.aero":false,
"flight.aero":false,
"freight.aero":false,
"fuel.aero":false,
"gliding.aero":false,
"government.aero":false,
"groundhandling.aero":false,
"group.aero":false,
"hanggliding.aero":false,
"homebuilt.aero":false,
"insurance.aero":false,
"journal.aero":false,
"journalist.aero":false,
"leasing.aero":false,
"logistics.aero":false,
"magazine.aero":false,
"maintenance.aero":false,
"media.aero":false,
"microlight.aero":false,
"modelling.aero":false,
"navigation.aero":false,
"parachuting.aero":false,
"paragliding.aero":false,
"passenger-association.aero":false,
"pilot.aero":false,
"press.aero":false,
"production.aero":false,
"recreation.aero":false,
"repbody.aero":false,
"res.aero":false,
"research.aero":false,
"rotorcraft.aero":false,
"safety.aero":false,
"scientist.aero":false,
"services.aero":false,
"show.aero":false,
"skydiving.aero":false,
"software.aero":false,
"student.aero":false,
"trader.aero":false,
"trading.aero":false,
"trainer.aero":false,
"union.aero":false,
"workinggroup.aero":false,
"works.aero":false,
"af":false,
"gov.af":false,
"com.af":false,
"org.af":false,
"net.af":false,
"edu.af":false,
"ag":false,
"com.ag":false,
"org.ag":false,
"net.ag":false,
"co.ag":false,
"nom.ag":false,
"ai":false,
"off.ai":false,
"com.ai":false,
"net.ai":false,
"org.ai":false,
"al":false,
"com.al":false,
"edu.al":false,
"gov.al":false,
"mil.al":false,
"net.al":false,
"org.al":false,
"am":false,
"ao":false,
"ed.ao":false,
"gv.ao":false,
"og.ao":false,
"co.ao":false,
"pb.ao":false,
"it.ao":false,
"aq":false,
"ar":false,
"com.ar":false,
"edu.ar":false,
"gob.ar":false,
"gov.ar":false,
"int.ar":false,
"mil.ar":false,
"musica.ar":false,
"net.ar":false,
"org.ar":false,
"tur.ar":false,
"arpa":false,
"e164.arpa":false,
"in-addr.arpa":false,
"ip6.arpa":false,
"iris.arpa":false,
"uri.arpa":false,
"urn.arpa":false,
"as":false,
"gov.as":false,
"asia":false,
"at":false,
"ac.at":false,
"co.at":false,
"gv.at":false,
"or.at":false,
"au":false,
"com.au":false,
"net.au":false,
"org.au":false,
"edu.au":false,
"gov.au":false,
"asn.au":false,
"id.au":false,
"info.au":false,
"conf.au":false,
"oz.au":false,
"act.au":false,
"nsw.au":false,
"nt.au":false,
"qld.au":false,
"sa.au":false,
"tas.au":false,
"vic.au":false,
"wa.au":false,
"act.edu.au":false,
"nsw.edu.au":false,
"nt.edu.au":false,
"qld.edu.au":false,
"sa.edu.au":false,
"tas.edu.au":false,
"vic.edu.au":false,
"wa.edu.au":false,
"qld.gov.au":false,
"sa.gov.au":false,
"tas.gov.au":false,
"vic.gov.au":false,
"wa.gov.au":false,
"aw":false,
"com.aw":false,
"ax":false,
"az":false,
"com.az":false,
"net.az":false,
"int.az":false,
"gov.az":false,
"org.az":false,
"edu.az":false,
"info.az":false,
"pp.az":false,
"mil.az":false,
"name.az":false,
"pro.az":false,
"biz.az":false,
"ba":false,
"com.ba":false,
"edu.ba":false,
"gov.ba":false,
"mil.ba":false,
"net.ba":false,
"org.ba":false,
"bb":false,
"biz.bb":false,
"co.bb":false,
"com.bb":false,
"edu.bb":false,
"gov.bb":false,
"info.bb":false,
"net.bb":false,
"org.bb":false,
"store.bb":false,
"tv.bb":false,
"be":false,
"ac.be":false,
"bf":false,
"gov.bf":false,
"bg":false,
"a.bg":false,
"b.bg":false,
"c.bg":false,
"d.bg":false,
"e.bg":false,
"f.bg":false,
"g.bg":false,
"h.bg":false,
"i.bg":false,
"j.bg":false,
"k.bg":false,
"l.bg":false,
"m.bg":false,
"n.bg":false,
"o.bg":false,
"p.bg":false,
"q.bg":false,
"r.bg":false,
"s.bg":false,
"t.bg":false,
"u.bg":false,
"v.bg":false,
"w.bg":false,
"x.bg":false,
"y.bg":false,
"z.bg":false,
"0.bg":false,
"1.bg":false,
"2.bg":false,
"3.bg":false,
"4.bg":false,
"5.bg":false,
"6.bg":false,
"7.bg":false,
"8.bg":false,
"9.bg":false,
"bh":false,
"com.bh":false,
"edu.bh":false,
"net.bh":false,
"org.bh":false,
"gov.bh":false,
"bi":false,
"co.bi":false,
"com.bi":false,
"edu.bi":false,
"or.bi":false,
"org.bi":false,
"biz":false,
"bj":false,
"asso.bj":false,
"barreau.bj":false,
"gouv.bj":false,
"bm":false,
"com.bm":false,
"edu.bm":false,
"gov.bm":false,
"net.bm":false,
"org.bm":false,
"bn":false,
"com.bn":false,
"edu.bn":false,
"gov.bn":false,
"net.bn":false,
"org.bn":false,
"bo":false,
"com.bo":false,
"edu.bo":false,
"gob.bo":false,
"int.bo":false,
"org.bo":false,
"net.bo":false,
"mil.bo":false,
"tv.bo":false,
"web.bo":false,
"academia.bo":false,
"agro.bo":false,
"arte.bo":false,
"blog.bo":false,
"bolivia.bo":false,
"ciencia.bo":false,
"cooperativa.bo":false,
"democracia.bo":false,
"deporte.bo":false,
"ecologia.bo":false,
"economia.bo":false,
"empresa.bo":false,
"indigena.bo":false,
"industria.bo":false,
"info.bo":false,
"medicina.bo":false,
"movimiento.bo":false,
"musica.bo":false,
"natural.bo":false,
"nombre.bo":false,
"noticias.bo":false,
"patria.bo":false,
"politica.bo":false,
"profesional.bo":false,
"plurinacional.bo":false,
"pueblo.bo":false,
"revista.bo":false,
"salud.bo":false,
"tecnologia.bo":false,
"tksat.bo":false,
"transporte.bo":false,
"wiki.bo":false,
"br":false,
"9guacu.br":false,
"abc.br":false,
"adm.br":false,
"adv.br":false,
"agr.br":false,
"aju.br":false,
"am.br":false,
"anani.br":false,
"aparecida.br":false,
"arq.br":false,
"art.br":false,
"ato.br":false,
"b.br":false,
"barueri.br":false,
"belem.br":false,
"bhz.br":false,
"bio.br":false,
"blog.br":false,
"bmd.br":false,
"boavista.br":false,
"bsb.br":false,
"campinagrande.br":false,
"campinas.br":false,
"caxias.br":false,
"cim.br":false,
"cng.br":false,
"cnt.br":false,
"com.br":false,
"contagem.br":false,
"coop.br":false,
"cri.br":false,
"cuiaba.br":false,
"curitiba.br":false,
"def.br":false,
"ecn.br":false,
"eco.br":false,
"edu.br":false,
"emp.br":false,
"eng.br":false,
"esp.br":false,
"etc.br":false,
"eti.br":false,
"far.br":false,
"feira.br":false,
"flog.br":false,
"floripa.br":false,
"fm.br":false,
"fnd.br":false,
"fortal.br":false,
"fot.br":false,
"foz.br":false,
"fst.br":false,
"g12.br":false,
"ggf.br":false,
"goiania.br":false,
"gov.br":false,
"ac.gov.br":false,
"al.gov.br":false,
"am.gov.br":false,
"ap.gov.br":false,
"ba.gov.br":false,
"ce.gov.br":false,
"df.gov.br":false,
"es.gov.br":false,
"go.gov.br":false,
"ma.gov.br":false,
"mg.gov.br":false,
"ms.gov.br":false,
"mt.gov.br":false,
"pa.gov.br":false,
"pb.gov.br":false,
"pe.gov.br":false,
"pi.gov.br":false,
"pr.gov.br":false,
"rj.gov.br":false,
"rn.gov.br":false,
"ro.gov.br":false,
"rr.gov.br":false,
"rs.gov.br":false,
"sc.gov.br":false,
"se.gov.br":false,
"sp.gov.br":false,
"to.gov.br":false,
"gru.br":false,
"imb.br":false,
"ind.br":false,
"inf.br":false,
"jab.br":false,
"jampa.br":false,
"jdf.br":false,
"joinville.br":false,
"jor.br":false,
"jus.br":false,
"leg.br":false,
"lel.br":false,
"londrina.br":false,
"macapa.br":false,
"maceio.br":false,
"manaus.br":false,
"maringa.br":false,
"mat.br":false,
"med.br":false,
"mil.br":false,
"morena.br":false,
"mp.br":false,
"mus.br":false,
"natal.br":false,
"net.br":false,
"niteroi.br":false,
"not.br":false,
"ntr.br":false,
"odo.br":false,
"ong.br":false,
"org.br":false,
"osasco.br":false,
"palmas.br":false,
"poa.br":false,
"ppg.br":false,
"pro.br":false,
"psc.br":false,
"psi.br":false,
"pvh.br":false,
"qsl.br":false,
"radio.br":false,
"rec.br":false,
"recife.br":false,
"ribeirao.br":false,
"rio.br":false,
"riobranco.br":false,
"riopreto.br":false,
"salvador.br":false,
"sampa.br":false,
"santamaria.br":false,
"santoandre.br":false,
"saobernardo.br":false,
"saogonca.br":false,
"sjc.br":false,
"slg.br":false,
"slz.br":false,
"sorocaba.br":false,
"srv.br":false,
"taxi.br":false,
"teo.br":false,
"the.br":false,
"tmp.br":false,
"trd.br":false,
"tur.br":false,
"tv.br":false,
"udi.br":false,
"vet.br":false,
"vix.br":false,
"vlog.br":false,
"wiki.br":false,
"zlg.br":false,
"bs":false,
"com.bs":false,
"net.bs":false,
"org.bs":false,
"edu.bs":false,
"gov.bs":false,
"bt":false,
"com.bt":false,
"edu.bt":false,
"gov.bt":false,
"net.bt":false,
"org.bt":false,
"bv":false,
"bw":false,
"co.bw":false,
"org.bw":false,
"by":false,
"gov.by":false,
"mil.by":false,
"com.by":false,
"of.by":false,
"bz":false,
"com.bz":false,
"net.bz":false,
"org.bz":false,
"edu.bz":false,
"gov.bz":false,
"ca":false,
"ab.ca":false,
"bc.ca":false,
"mb.ca":false,
"nb.ca":false,
"nf.ca":false,
"nl.ca":false,
"ns.ca":false,
"nt.ca":false,
"nu.ca":false,
"on.ca":false,
"pe.ca":false,
"qc.ca":false,
"sk.ca":false,
"yk.ca":false,
"gc.ca":false,
"cat":false,
"cc":false,
"cd":false,
"gov.cd":false,
"cf":false,
"cg":false,
"ch":false,
"ci":false,
"org.ci":false,
"or.ci":false,
"com.ci":false,
"co.ci":false,
"edu.ci":false,
"ed.ci":false,
"ac.ci":false,
"net.ci":false,
"go.ci":false,
"asso.ci":false,
"aéroport.ci":false,
"int.ci":false,
"presse.ci":false,
"md.ci":false,
"gouv.ci":false,
"cl":false,
"gov.cl":false,
"gob.cl":false,
"co.cl":false,
"mil.cl":false,
"cm":false,
"co.cm":false,
"com.cm":false,
"gov.cm":false,
"net.cm":false,
"cn":false,
"ac.cn":false,
"com.cn":false,
"edu.cn":false,
"gov.cn":false,
"net.cn":false,
"org.cn":false,
"mil.cn":false,
"公司.cn":false,
"网络.cn":false,
"網絡.cn":false,
"ah.cn":false,
"bj.cn":false,
"cq.cn":false,
"fj.cn":false,
"gd.cn":false,
"gs.cn":false,
"gz.cn":false,
"gx.cn":false,
"ha.cn":false,
"hb.cn":false,
"he.cn":false,
"hi.cn":false,
"hl.cn":false,
"hn.cn":false,
"jl.cn":false,
"js.cn":false,
"jx.cn":false,
"ln.cn":false,
"nm.cn":false,
"nx.cn":false,
"qh.cn":false,
"sc.cn":false,
"sd.cn":false,
"sh.cn":false,
"sn.cn":false,
"sx.cn":false,
"tj.cn":false,
"xj.cn":false,
"xz.cn":false,
"yn.cn":false,
"zj.cn":false,
"hk.cn":false,
"mo.cn":false,
"tw.cn":false,
"co":false,
"arts.co":false,
"com.co":false,
"edu.co":false,
"firm.co":false,
"gov.co":false,
"info.co":false,
"int.co":false,
"mil.co":false,
"net.co":false,
"nom.co":false,
"org.co":false,
"rec.co":false,
"web.co":false,
"com":false,
"coop":false,
"cr":false,
"ac.cr":false,
"co.cr":false,
"ed.cr":false,
"fi.cr":false,
"go.cr":false,
"or.cr":false,
"sa.cr":false,
"cu":false,
"com.cu":false,
"edu.cu":false,
"org.cu":false,
"net.cu":false,
"gov.cu":false,
"inf.cu":false,
"cv":false,
"cw":false,
"com.cw":false,
"edu.cw":false,
"net.cw":false,
"org.cw":false,
"cx":false,
"gov.cx":false,
"cy":false,
"ac.cy":false,
"biz.cy":false,
"com.cy":false,
"ekloges.cy":false,
"gov.cy":false,
"ltd.cy":false,
"name.cy":false,
"net.cy":false,
"org.cy":false,
"parliament.cy":false,
"press.cy":false,
"pro.cy":false,
"tm.cy":false,
"cz":false,
"de":false,
"dj":false,
"dk":false,
"dm":false,
"com.dm":false,
"net.dm":false,
"org.dm":false,
"edu.dm":false,
"gov.dm":false,
"do":false,
"art.do":false,
"com.do":false,
"edu.do":false,
"gob.do":false,
"gov.do":false,
"mil.do":false,
"net.do":false,
"org.do":false,
"sld.do":false,
"web.do":false,
"dz":false,
"com.dz":false,
"org.dz":false,
"net.dz":false,
"gov.dz":false,
"edu.dz":false,
"asso.dz":false,
"pol.dz":false,
"art.dz":false,
"ec":false,
"com.ec":false,
"info.ec":false,
"net.ec":false,
"fin.ec":false,
"k12.ec":false,
"med.ec":false,
"pro.ec":false,
"org.ec":false,
"edu.ec":false,
"gov.ec":false,
"gob.ec":false,
"mil.ec":false,
"edu":false,
"ee":false,
"edu.ee":false,
"gov.ee":false,
"riik.ee":false,
"lib.ee":false,
"med.ee":false,
"com.ee":false,
"pri.ee":false,
"aip.ee":false,
"org.ee":false,
"fie.ee":false,
"eg":false,
"com.eg":false,
"edu.eg":false,
"eun.eg":false,
"gov.eg":false,
"mil.eg":false,
"name.eg":false,
"net.eg":false,
"org.eg":false,
"sci.eg":false,
"es":false,
"com.es":false,
"nom.es":false,
"org.es":false,
"gob.es":false,
"edu.es":false,
"et":false,
"com.et":false,
"gov.et":false,
"org.et":false,
"edu.et":false,
"biz.et":false,
"name.et":false,
"info.et":false,
"net.et":false,
"eu":false,
"fi":false,
"aland.fi":false,
"fm":false,
"fo":false,
"fr":false,
"com.fr":false,
"asso.fr":false,
"nom.fr":false,
"prd.fr":false,
"presse.fr":false,
"tm.fr":false,
"aeroport.fr":false,
"assedic.fr":false,
"avocat.fr":false,
"avoues.fr":false,
"cci.fr":false,
"chambagri.fr":false,
"chirurgiens-dentistes.fr":false,
"experts-comptables.fr":false,
"geometre-expert.fr":false,
"gouv.fr":false,
"greta.fr":false,
"huissier-justice.fr":false,
"medecin.fr":false,
"notaires.fr":false,
"pharmacien.fr":false,
"port.fr":false,
"veterinaire.fr":false,
"ga":false,
"gb":false,
"gd":false,
"ge":false,
"com.ge":false,
"edu.ge":false,
"gov.ge":false,
"org.ge":false,
"mil.ge":false,
"net.ge":false,
"pvt.ge":false,
"gf":false,
"gg":false,
"co.gg":false,
"net.gg":false,
"org.gg":false,
"gh":false,
"com.gh":false,
"edu.gh":false,
"gov.gh":false,
"org.gh":false,
"mil.gh":false,
"gi":false,
"com.gi":false,
"ltd.gi":false,
"gov.gi":false,
"mod.gi":false,
"edu.gi":false,
"org.gi":false,
"gl":false,
"co.gl":false,
"com.gl":false,
"edu.gl":false,
"net.gl":false,
"org.gl":false,
"gm":false,
"gn":false,
"ac.gn":false,
"com.gn":false,
"edu.gn":false,
"gov.gn":false,
"org.gn":false,
"net.gn":false,
"gov":false,
"gp":false,
"com.gp":false,
"net.gp":false,
"mobi.gp":false,
"edu.gp":false,
"org.gp":false,
"asso.gp":false,
"gq":false,
"gr":false,
"com.gr":false,
"edu.gr":false,
"net.gr":false,
"org.gr":false,
"gov.gr":false,
"gs":false,
"gt":false,
"com.gt":false,
"edu.gt":false,
"gob.gt":false,
"ind.gt":false,
"mil.gt":false,
"net.gt":false,
"org.gt":false,
"gu":false,
"com.gu":false,
"edu.gu":false,
"gov.gu":false,
"guam.gu":false,
"info.gu":false,
"net.gu":false,
"org.gu":false,
"web.gu":false,
"gw":false,
"gy":false,
"co.gy":false,
"com.gy":false,
"edu.gy":false,
"gov.gy":false,
"net.gy":false,
"org.gy":false,
"hk":false,
"com.hk":false,
"edu.hk":false,
"gov.hk":false,
"idv.hk":false,
"net.hk":false,
"org.hk":false,
"公司.hk":false,
"教育.hk":false,
"敎育.hk":false,
"政府.hk":false,
"個人.hk":false,
"个人.hk":false,
"箇人.hk":false,
"網络.hk":false,
"网络.hk":false,
"组織.hk":false,
"網絡.hk":false,
"网絡.hk":false,
"组织.hk":false,
"組織.hk":false,
"組织.hk":false,
"hm":false,
"hn":false,
"com.hn":false,
"edu.hn":false,
"org.hn":false,
"net.hn":false,
"mil.hn":false,
"gob.hn":false,
"hr":false,
"iz.hr":false,
"from.hr":false,
"name.hr":false,
"com.hr":false,
"ht":false,
"com.ht":false,
"shop.ht":false,
"firm.ht":false,
"info.ht":false,
"adult.ht":false,
"net.ht":false,
"pro.ht":false,
"org.ht":false,
"med.ht":false,
"art.ht":false,
"coop.ht":false,
"pol.ht":false,
"asso.ht":false,
"edu.ht":false,
"rel.ht":false,
"gouv.ht":false,
"perso.ht":false,
"hu":false,
"co.hu":false,
"info.hu":false,
"org.hu":false,
"priv.hu":false,
"sport.hu":false,
"tm.hu":false,
"2000.hu":false,
"agrar.hu":false,
"bolt.hu":false,
"casino.hu":false,
"city.hu":false,
"erotica.hu":false,
"erotika.hu":false,
"film.hu":false,
"forum.hu":false,
"games.hu":false,
"hotel.hu":false,
"ingatlan.hu":false,
"jogasz.hu":false,
"konyvelo.hu":false,
"lakas.hu":false,
"media.hu":false,
"news.hu":false,
"reklam.hu":false,
"sex.hu":false,
"shop.hu":false,
"suli.hu":false,
"szex.hu":false,
"tozsde.hu":false,
"utazas.hu":false,
"video.hu":false,
"id":false,
"ac.id":false,
"biz.id":false,
"co.id":false,
"desa.id":false,
"go.id":false,
"mil.id":false,
"my.id":false,
"net.id":false,
"or.id":false,
"ponpes.id":false,
"sch.id":false,
"web.id":false,
"ie":false,
"gov.ie":false,
"il":false,
"ac.il":false,
"co.il":false,
"gov.il":false,
"idf.il":false,
"k12.il":false,
"muni.il":false,
"net.il":false,
"org.il":false,
"im":false,
"ac.im":false,
"co.im":false,
"com.im":false,
"ltd.co.im":false,
"net.im":false,
"org.im":false,
"plc.co.im":false,
"tt.im":false,
"tv.im":false,
"in":false,
"co.in":false,
"firm.in":false,
"net.in":false,
"org.in":false,
"gen.in":false,
"ind.in":false,
"nic.in":false,
"ac.in":false,
"edu.in":false,
"res.in":false,
"gov.in":false,
"mil.in":false,
"info":false,
"int":false,
"eu.int":false,
"io":false,
"com.io":false,
"iq":false,
"gov.iq":false,
"edu.iq":false,
"mil.iq":false,
"com.iq":false,
"org.iq":false,
"net.iq":false,
"ir":false,
"ac.ir":false,
"co.ir":false,
"gov.ir":false,
"id.ir":false,
"net.ir":false,
"org.ir":false,
"sch.ir":false,
"ایران.ir":false,
"ايران.ir":false,
"is":false,
"net.is":false,
"com.is":false,
"edu.is":false,
"gov.is":false,
"org.is":false,
"int.is":false,
"it":false,
"gov.it":false,
"edu.it":false,
"abr.it":false,
"abruzzo.it":false,
"aosta-valley.it":false,
"aostavalley.it":false,
"bas.it":false,
"basilicata.it":false,
"cal.it":false,
"calabria.it":false,
"cam.it":false,
"campania.it":false,
"emilia-romagna.it":false,
"emiliaromagna.it":false,
"emr.it":false,
"friuli-v-giulia.it":false,
"friuli-ve-giulia.it":false,
"friuli-vegiulia.it":false,
"friuli-venezia-giulia.it":false,
"friuli-veneziagiulia.it":false,
"friuli-vgiulia.it":false,
"friuliv-giulia.it":false,
"friulive-giulia.it":false,
"friulivegiulia.it":false,
"friulivenezia-giulia.it":false,
"friuliveneziagiulia.it":false,
"friulivgiulia.it":false,
"fvg.it":false,
"laz.it":false,
"lazio.it":false,
"lig.it":false,
"liguria.it":false,
"lom.it":false,
"lombardia.it":false,
"lombardy.it":false,
"lucania.it":false,
"mar.it":false,
"marche.it":false,
"mol.it":false,
"molise.it":false,
"piedmont.it":false,
"piemonte.it":false,
"pmn.it":false,
"pug.it":false,
"puglia.it":false,
"sar.it":false,
"sardegna.it":false,
"sardinia.it":false,
"sic.it":false,
"sicilia.it":false,
"sicily.it":false,
"taa.it":false,
"tos.it":false,
"toscana.it":false,
"trentin-sud-tirol.it":false,
"trentin-süd-tirol.it":false,
"trentin-sudtirol.it":false,
"trentin-südtirol.it":false,
"trentin-sued-tirol.it":false,
"trentin-suedtirol.it":false,
"trentino-a-adige.it":false,
"trentino-aadige.it":false,
"trentino-alto-adige.it":false,
"trentino-altoadige.it":false,
"trentino-s-tirol.it":false,
"trentino-stirol.it":false,
"trentino-sud-tirol.it":false,
"trentino-süd-tirol.it":false,
"trentino-sudtirol.it":false,
"trentino-südtirol.it":false,
"trentino-sued-tirol.it":false,
"trentino-suedtirol.it":false,
"trentino.it":false,
"trentinoa-adige.it":false,
"trentinoaadige.it":false,
"trentinoalto-adige.it":false,
"trentinoaltoadige.it":false,
"trentinos-tirol.it":false,
"trentinostirol.it":false,
"trentinosud-tirol.it":false,
"trentinosüd-tirol.it":false,
"trentinosudtirol.it":false,
"trentinosüdtirol.it":false,
"trentinosued-tirol.it":false,
"trentinosuedtirol.it":false,
"trentinsud-tirol.it":false,
"trentinsüd-tirol.it":false,
"trentinsudtirol.it":false,
"trentinsüdtirol.it":false,
"trentinsued-tirol.it":false,
"trentinsuedtirol.it":false,
"tuscany.it":false,
"umb.it":false,
"umbria.it":false,
"val-d-aosta.it":false,
"val-daosta.it":false,
"vald-aosta.it":false,
"valdaosta.it":false,
"valle-aosta.it":false,
"valle-d-aosta.it":false,
"valle-daosta.it":false,
"valleaosta.it":false,
"valled-aosta.it":false,
"valledaosta.it":false,
"vallee-aoste.it":false,
"vallée-aoste.it":false,
"vallee-d-aoste.it":false,
"vallée-d-aoste.it":false,
"valleeaoste.it":false,
"valléeaoste.it":false,
"valleedaoste.it":false,
"valléedaoste.it":false,
"vao.it":false,
"vda.it":false,
"ven.it":false,
"veneto.it":false,
"ag.it":false,
"agrigento.it":false,
"al.it":false,
"alessandria.it":false,
"alto-adige.it":false,
"altoadige.it":false,
"an.it":false,
"ancona.it":false,
"andria-barletta-trani.it":false,
"andria-trani-barletta.it":false,
"andriabarlettatrani.it":false,
"andriatranibarletta.it":false,
"ao.it":false,
"aosta.it":false,
"aoste.it":false,
"ap.it":false,
"aq.it":false,
"aquila.it":false,
"ar.it":false,
"arezzo.it":false,
"ascoli-piceno.it":false,
"ascolipiceno.it":false,
"asti.it":false,
"at.it":false,
"av.it":false,
"avellino.it":false,
"ba.it":false,
"balsan-sudtirol.it":false,
"balsan-südtirol.it":false,
"balsan-suedtirol.it":false,
"balsan.it":false,
"bari.it":false,
"barletta-trani-andria.it":false,
"barlettatraniandria.it":false,
"belluno.it":false,
"benevento.it":false,
"bergamo.it":false,
"bg.it":false,
"bi.it":false,
"biella.it":false,
"bl.it":false,
"bn.it":false,
"bo.it":false,
"bologna.it":false,
"bolzano-altoadige.it":false,
"bolzano.it":false,
"bozen-sudtirol.it":false,
"bozen-südtirol.it":false,
"bozen-suedtirol.it":false,
"bozen.it":false,
"br.it":false,
"brescia.it":false,
"brindisi.it":false,
"bs.it":false,
"bt.it":false,
"bulsan-sudtirol.it":false,
"bulsan-südtirol.it":false,
"bulsan-suedtirol.it":false,
"bulsan.it":false,
"bz.it":false,
"ca.it":false,
"cagliari.it":false,
"caltanissetta.it":false,
"campidano-medio.it":false,
"campidanomedio.it":false,
"campobasso.it":false,
"carbonia-iglesias.it":false,
"carboniaiglesias.it":false,
"carrara-massa.it":false,
"carraramassa.it":false,
"caserta.it":false,
"catania.it":false,
"catanzaro.it":false,
"cb.it":false,
"ce.it":false,
"cesena-forli.it":false,
"cesena-forlì.it":false,
"cesenaforli.it":false,
"cesenaforlì.it":false,
"ch.it":false,
"chieti.it":false,
"ci.it":false,
"cl.it":false,
"cn.it":false,
"co.it":false,
"como.it":false,
"cosenza.it":false,
"cr.it":false,
"cremona.it":false,
"crotone.it":false,
"cs.it":false,
"ct.it":false,
"cuneo.it":false,
"cz.it":false,
"dell-ogliastra.it":false,
"dellogliastra.it":false,
"en.it":false,
"enna.it":false,
"fc.it":false,
"fe.it":false,
"fermo.it":false,
"ferrara.it":false,
"fg.it":false,
"fi.it":false,
"firenze.it":false,
"florence.it":false,
"fm.it":false,
"foggia.it":false,
"forli-cesena.it":false,
"forlì-cesena.it":false,
"forlicesena.it":false,
"forlìcesena.it":false,
"fr.it":false,
"frosinone.it":false,
"ge.it":false,
"genoa.it":false,
"genova.it":false,
"go.it":false,
"gorizia.it":false,
"gr.it":false,
"grosseto.it":false,
"iglesias-carbonia.it":false,
"iglesiascarbonia.it":false,
"im.it":false,
"imperia.it":false,
"is.it":false,
"isernia.it":false,
"kr.it":false,
"la-spezia.it":false,
"laquila.it":false,
"laspezia.it":false,
"latina.it":false,
"lc.it":false,
"le.it":false,
"lecce.it":false,
"lecco.it":false,
"li.it":false,
"livorno.it":false,
"lo.it":false,
"lodi.it":false,
"lt.it":false,
"lu.it":false,
"lucca.it":false,
"macerata.it":false,
"mantova.it":false,
"massa-carrara.it":false,
"massacarrara.it":false,
"matera.it":false,
"mb.it":false,
"mc.it":false,
"me.it":false,
"medio-campidano.it":false,
"mediocampidano.it":false,
"messina.it":false,
"mi.it":false,
"milan.it":false,
"milano.it":false,
"mn.it":false,
"mo.it":false,
"modena.it":false,
"monza-brianza.it":false,
"monza-e-della-brianza.it":false,
"monza.it":false,
"monzabrianza.it":false,
"monzaebrianza.it":false,
"monzaedellabrianza.it":false,
"ms.it":false,
"mt.it":false,
"na.it":false,
"naples.it":false,
"napoli.it":false,
"no.it":false,
"novara.it":false,
"nu.it":false,
"nuoro.it":false,
"og.it":false,
"ogliastra.it":false,
"olbia-tempio.it":false,
"olbiatempio.it":false,
"or.it":false,
"oristano.it":false,
"ot.it":false,
"pa.it":false,
"padova.it":false,
"padua.it":false,
"palermo.it":false,
"parma.it":false,
"pavia.it":false,
"pc.it":false,
"pd.it":false,
"pe.it":false,
"perugia.it":false,
"pesaro-urbino.it":false,
"pesarourbino.it":false,
"pescara.it":false,
"pg.it":false,
"pi.it":false,
"piacenza.it":false,
"pisa.it":false,
"pistoia.it":false,
"pn.it":false,
"po.it":false,
"pordenone.it":false,
"potenza.it":false,
"pr.it":false,
"prato.it":false,
"pt.it":false,
"pu.it":false,
"pv.it":false,
"pz.it":false,
"ra.it":false,
"ragusa.it":false,
"ravenna.it":false,
"rc.it":false,
"re.it":false,
"reggio-calabria.it":false,
"reggio-emilia.it":false,
"reggiocalabria.it":false,
"reggioemilia.it":false,
"rg.it":false,
"ri.it":false,
"rieti.it":false,
"rimini.it":false,
"rm.it":false,
"rn.it":false,
"ro.it":false,
"roma.it":false,
"rome.it":false,
"rovigo.it":false,
"sa.it":false,
"salerno.it":false,
"sassari.it":false,
"savona.it":false,
"si.it":false,
"siena.it":false,
"siracusa.it":false,
"so.it":false,
"sondrio.it":false,
"sp.it":false,
"sr.it":false,
"ss.it":false,
"suedtirol.it":false,
"südtirol.it":false,
"sv.it":false,
"ta.it":false,
"taranto.it":false,
"te.it":false,
"tempio-olbia.it":false,
"tempioolbia.it":false,
"teramo.it":false,
"terni.it":false,
"tn.it":false,
"to.it":false,
"torino.it":false,
"tp.it":false,
"tr.it":false,
"trani-andria-barletta.it":false,
"trani-barletta-andria.it":false,
"traniandriabarletta.it":false,
"tranibarlettaandria.it":false,
"trapani.it":false,
"trento.it":false,
"treviso.it":false,
"trieste.it":false,
"ts.it":false,
"turin.it":false,
"tv.it":false,
"ud.it":false,
"udine.it":false,
"urbino-pesaro.it":false,
"urbinopesaro.it":false,
"va.it":false,
"varese.it":false,
"vb.it":false,
"vc.it":false,
"ve.it":false,
"venezia.it":false,
"venice.it":false,
"verbania.it":false,
"vercelli.it":false,
"verona.it":false,
"vi.it":false,
"vibo-valentia.it":false,
"vibovalentia.it":false,
"vicenza.it":false,
"viterbo.it":false,
"vr.it":false,
"vs.it":false,
"vt.it":false,
"vv.it":false,
"je":false,
"co.je":false,
"net.je":false,
"org.je":false,
"jo":false,
"com.jo":false,
"org.jo":false,
"net.jo":false,
"edu.jo":false,
"sch.jo":false,
"gov.jo":false,
"mil.jo":false,
"name.jo":false,
"jobs":false,
"jp":false,
"ac.jp":false,
"ad.jp":false,
"co.jp":false,
"ed.jp":false,
"go.jp":false,
"gr.jp":false,
"lg.jp":false,
"ne.jp":false,
"or.jp":false,
"aichi.jp":false,
"akita.jp":false,
"aomori.jp":false,
"chiba.jp":false,
"ehime.jp":false,
"fukui.jp":false,
"fukuoka.jp":false,
"fukushima.jp":false,
"gifu.jp":false,
"gunma.jp":false,
"hiroshima.jp":false,
"hokkaido.jp":false,
"hyogo.jp":false,
"ibaraki.jp":false,
"ishikawa.jp":false,
"iwate.jp":false,
"kagawa.jp":false,
"kagoshima.jp":false,
"kanagawa.jp":false,
"kochi.jp":false,
"kumamoto.jp":false,
"kyoto.jp":false,
"mie.jp":false,
"miyagi.jp":false,
"miyazaki.jp":false,
"nagano.jp":false,
"nagasaki.jp":false,
"nara.jp":false,
"niigata.jp":false,
"oita.jp":false,
"okayama.jp":false,
"okinawa.jp":false,
"osaka.jp":false,
"saga.jp":false,
"saitama.jp":false,
"shiga.jp":false,
"shimane.jp":false,
"shizuoka.jp":false,
"tochigi.jp":false,
"tokushima.jp":false,
"tokyo.jp":false,
"tottori.jp":false,
"toyama.jp":false,
"wakayama.jp":false,
"yamagata.jp":false,
"yamaguchi.jp":false,
"yamanashi.jp":false,
"栃木.jp":false,
"愛知.jp":false,
"愛媛.jp":false,
"兵庫.jp":false,
"熊本.jp":false,
"茨城.jp":false,
"北海道.jp":false,
"千葉.jp":false,
"和歌山.jp":false,
"長崎.jp":false,
"長野.jp":false,
"新潟.jp":false,
"青森.jp":false,
"静岡.jp":false,
"東京.jp":false,
"石川.jp":false,
"埼玉.jp":false,
"三重.jp":false,
"京都.jp":false,
"佐賀.jp":false,
"大分.jp":false,
"大阪.jp":false,
"奈良.jp":false,
"宮城.jp":false,
"宮崎.jp":false,
"富山.jp":false,
"山口.jp":false,
"山形.jp":false,
"山梨.jp":false,
"岩手.jp":false,
"岐阜.jp":false,
"岡山.jp":false,
"島根.jp":false,
"広島.jp":false,
"徳島.jp":false,
"沖縄.jp":false,
"滋賀.jp":false,
"神奈川.jp":false,
"福井.jp":false,
"福岡.jp":false,
"福島.jp":false,
"秋田.jp":false,
"群馬.jp":false,
"香川.jp":false,
"高知.jp":false,
"鳥取.jp":false,
"鹿児島.jp":false,
"aisai.aichi.jp":false,
"ama.aichi.jp":false,
"anjo.aichi.jp":false,
"asuke.aichi.jp":false,
"chiryu.aichi.jp":false,
"chita.aichi.jp":false,
"fuso.aichi.jp":false,
"gamagori.aichi.jp":false,
"handa.aichi.jp":false,
"hazu.aichi.jp":false,
"hekinan.aichi.jp":false,
"higashiura.aichi.jp":false,
"ichinomiya.aichi.jp":false,
"inazawa.aichi.jp":false,
"inuyama.aichi.jp":false,
"isshiki.aichi.jp":false,
"iwakura.aichi.jp":false,
"kanie.aichi.jp":false,
"kariya.aichi.jp":false,
"kasugai.aichi.jp":false,
"kira.aichi.jp":false,
"kiyosu.aichi.jp":false,
"komaki.aichi.jp":false,
"konan.aichi.jp":false,
"kota.aichi.jp":false,
"mihama.aichi.jp":false,
"miyoshi.aichi.jp":false,
"nishio.aichi.jp":false,
"nisshin.aichi.jp":false,
"obu.aichi.jp":false,
"oguchi.aichi.jp":false,
"oharu.aichi.jp":false,
"okazaki.aichi.jp":false,
"owariasahi.aichi.jp":false,
"seto.aichi.jp":false,
"shikatsu.aichi.jp":false,
"shinshiro.aichi.jp":false,
"shitara.aichi.jp":false,
"tahara.aichi.jp":false,
"takahama.aichi.jp":false,
"tobishima.aichi.jp":false,
"toei.aichi.jp":false,
"togo.aichi.jp":false,
"tokai.aichi.jp":false,
"tokoname.aichi.jp":false,
"toyoake.aichi.jp":false,
"toyohashi.aichi.jp":false,
"toyokawa.aichi.jp":false,
"toyone.aichi.jp":false,
"toyota.aichi.jp":false,
"tsushima.aichi.jp":false,
"yatomi.aichi.jp":false,
"akita.akita.jp":false,
"daisen.akita.jp":false,
"fujisato.akita.jp":false,
"gojome.akita.jp":false,
"hachirogata.akita.jp":false,
"happou.akita.jp":false,
"higashinaruse.akita.jp":false,
"honjo.akita.jp":false,
"honjyo.akita.jp":false,
"ikawa.akita.jp":false,
"kamikoani.akita.jp":false,
"kamioka.akita.jp":false,
"katagami.akita.jp":false,
"kazuno.akita.jp":false,
"kitaakita.akita.jp":false,
"kosaka.akita.jp":false,
"kyowa.akita.jp":false,
"misato.akita.jp":false,
"mitane.akita.jp":false,
"moriyoshi.akita.jp":false,
"nikaho.akita.jp":false,
"noshiro.akita.jp":false,
"odate.akita.jp":false,
"oga.akita.jp":false,
"ogata.akita.jp":false,
"semboku.akita.jp":false,
"yokote.akita.jp":false,
"yurihonjo.akita.jp":false,
"aomori.aomori.jp":false,
"gonohe.aomori.jp":false,
"hachinohe.aomori.jp":false,
"hashikami.aomori.jp":false,
"hiranai.aomori.jp":false,
"hirosaki.aomori.jp":false,
"itayanagi.aomori.jp":false,
"kuroishi.aomori.jp":false,
"misawa.aomori.jp":false,
"mutsu.aomori.jp":false,
"nakadomari.aomori.jp":false,
"noheji.aomori.jp":false,
"oirase.aomori.jp":false,
"owani.aomori.jp":false,
"rokunohe.aomori.jp":false,
"sannohe.aomori.jp":false,
"shichinohe.aomori.jp":false,
"shingo.aomori.jp":false,
"takko.aomori.jp":false,
"towada.aomori.jp":false,
"tsugaru.aomori.jp":false,
"tsuruta.aomori.jp":false,
"abiko.chiba.jp":false,
"asahi.chiba.jp":false,
"chonan.chiba.jp":false,
"chosei.chiba.jp":false,
"choshi.chiba.jp":false,
"chuo.chiba.jp":false,
"funabashi.chiba.jp":false,
"futtsu.chiba.jp":false,
"hanamigawa.chiba.jp":false,
"ichihara.chiba.jp":false,
"ichikawa.chiba.jp":false,
"ichinomiya.chiba.jp":false,
"inzai.chiba.jp":false,
"isumi.chiba.jp":false,
"kamagaya.chiba.jp":false,
"kamogawa.chiba.jp":false,
"kashiwa.chiba.jp":false,
"katori.chiba.jp":false,
"katsuura.chiba.jp":false,
"kimitsu.chiba.jp":false,
"kisarazu.chiba.jp":false,
"kozaki.chiba.jp":false,
"kujukuri.chiba.jp":false,
"kyonan.chiba.jp":false,
"matsudo.chiba.jp":false,
"midori.chiba.jp":false,
"mihama.chiba.jp":false,
"minamiboso.chiba.jp":false,
"mobara.chiba.jp":false,
"mutsuzawa.chiba.jp":false,
"nagara.chiba.jp":false,
"nagareyama.chiba.jp":false,
"narashino.chiba.jp":false,
"narita.chiba.jp":false,
"noda.chiba.jp":false,
"oamishirasato.chiba.jp":false,
"omigawa.chiba.jp":false,
"onjuku.chiba.jp":false,
"otaki.chiba.jp":false,
"sakae.chiba.jp":false,
"sakura.chiba.jp":false,
"shimofusa.chiba.jp":false,
"shirako.chiba.jp":false,
"shiroi.chiba.jp":false,
"shisui.chiba.jp":false,
"sodegaura.chiba.jp":false,
"sosa.chiba.jp":false,
"tako.chiba.jp":false,
"tateyama.chiba.jp":false,
"togane.chiba.jp":false,
"tohnosho.chiba.jp":false,
"tomisato.chiba.jp":false,
"urayasu.chiba.jp":false,
"yachimata.chiba.jp":false,
"yachiyo.chiba.jp":false,
"yokaichiba.chiba.jp":false,
"yokoshibahikari.chiba.jp":false,
"yotsukaido.chiba.jp":false,
"ainan.ehime.jp":false,
"honai.ehime.jp":false,
"ikata.ehime.jp":false,
"imabari.ehime.jp":false,
"iyo.ehime.jp":false,
"kamijima.ehime.jp":false,
"kihoku.ehime.jp":false,
"kumakogen.ehime.jp":false,
"masaki.ehime.jp":false,
"matsuno.ehime.jp":false,
"matsuyama.ehime.jp":false,
"namikata.ehime.jp":false,
"niihama.ehime.jp":false,
"ozu.ehime.jp":false,
"saijo.ehime.jp":false,
"seiyo.ehime.jp":false,
"shikokuchuo.ehime.jp":false,
"tobe.ehime.jp":false,
"toon.ehime.jp":false,
"uchiko.ehime.jp":false,
"uwajima.ehime.jp":false,
"yawatahama.ehime.jp":false,
"echizen.fukui.jp":false,
"eiheiji.fukui.jp":false,
"fukui.fukui.jp":false,
"ikeda.fukui.jp":false,
"katsuyama.fukui.jp":false,
"mihama.fukui.jp":false,
"minamiechizen.fukui.jp":false,
"obama.fukui.jp":false,
"ohi.fukui.jp":false,
"ono.fukui.jp":false,
"sabae.fukui.jp":false,
"sakai.fukui.jp":false,
"takahama.fukui.jp":false,
"tsuruga.fukui.jp":false,
"wakasa.fukui.jp":false,
"ashiya.fukuoka.jp":false,
"buzen.fukuoka.jp":false,
"chikugo.fukuoka.jp":false,
"chikuho.fukuoka.jp":false,
"chikujo.fukuoka.jp":false,
"chikushino.fukuoka.jp":false,
"chikuzen.fukuoka.jp":false,
"chuo.fukuoka.jp":false,
"dazaifu.fukuoka.jp":false,
"fukuchi.fukuoka.jp":false,
"hakata.fukuoka.jp":false,
"higashi.fukuoka.jp":false,
"hirokawa.fukuoka.jp":false,
"hisayama.fukuoka.jp":false,
"iizuka.fukuoka.jp":false,
"inatsuki.fukuoka.jp":false,
"kaho.fukuoka.jp":false,
"kasuga.fukuoka.jp":false,
"kasuya.fukuoka.jp":false,
"kawara.fukuoka.jp":false,
"keisen.fukuoka.jp":false,
"koga.fukuoka.jp":false,
"kurate.fukuoka.jp":false,
"kurogi.fukuoka.jp":false,
"kurume.fukuoka.jp":false,
"minami.fukuoka.jp":false,
"miyako.fukuoka.jp":false,
"miyama.fukuoka.jp":false,
"miyawaka.fukuoka.jp":false,
"mizumaki.fukuoka.jp":false,
"munakata.fukuoka.jp":false,
"nakagawa.fukuoka.jp":false,
"nakama.fukuoka.jp":false,
"nishi.fukuoka.jp":false,
"nogata.fukuoka.jp":false,
"ogori.fukuoka.jp":false,
"okagaki.fukuoka.jp":false,
"okawa.fukuoka.jp":false,
"oki.fukuoka.jp":false,
"omuta.fukuoka.jp":false,
"onga.fukuoka.jp":false,
"onojo.fukuoka.jp":false,
"oto.fukuoka.jp":false,
"saigawa.fukuoka.jp":false,
"sasaguri.fukuoka.jp":false,
"shingu.fukuoka.jp":false,
"shinyoshitomi.fukuoka.jp":false,
"shonai.fukuoka.jp":false,
"soeda.fukuoka.jp":false,
"sue.fukuoka.jp":false,
"tachiarai.fukuoka.jp":false,
"tagawa.fukuoka.jp":false,
"takata.fukuoka.jp":false,
"toho.fukuoka.jp":false,
"toyotsu.fukuoka.jp":false,
"tsuiki.fukuoka.jp":false,
"ukiha.fukuoka.jp":false,
"umi.fukuoka.jp":false,
"usui.fukuoka.jp":false,
"yamada.fukuoka.jp":false,
"yame.fukuoka.jp":false,
"yanagawa.fukuoka.jp":false,
"yukuhashi.fukuoka.jp":false,
"aizubange.fukushima.jp":false,
"aizumisato.fukushima.jp":false,
"aizuwakamatsu.fukushima.jp":false,
"asakawa.fukushima.jp":false,
"bandai.fukushima.jp":false,
"date.fukushima.jp":false,
"fukushima.fukushima.jp":false,
"furudono.fukushima.jp":false,
"futaba.fukushima.jp":false,
"hanawa.fukushima.jp":false,
"higashi.fukushima.jp":false,
"hirata.fukushima.jp":false,
"hirono.fukushima.jp":false,
"iitate.fukushima.jp":false,
"inawashiro.fukushima.jp":false,
"ishikawa.fukushima.jp":false,
"iwaki.fukushima.jp":false,
"izumizaki.fukushima.jp":false,
"kagamiishi.fukushima.jp":false,
"kaneyama.fukushima.jp":false,
"kawamata.fukushima.jp":false,
"kitakata.fukushima.jp":false,
"kitashiobara.fukushima.jp":false,
"koori.fukushima.jp":false,
"koriyama.fukushima.jp":false,
"kunimi.fukushima.jp":false,
"miharu.fukushima.jp":false,
"mishima.fukushima.jp":false,
"namie.fukushima.jp":false,
"nango.fukushima.jp":false,
"nishiaizu.fukushima.jp":false,
"nishigo.fukushima.jp":false,
"okuma.fukushima.jp":false,
"omotego.fukushima.jp":false,
"ono.fukushima.jp":false,
"otama.fukushima.jp":false,
"samegawa.fukushima.jp":false,
"shimogo.fukushima.jp":false,
"shirakawa.fukushima.jp":false,
"showa.fukushima.jp":false,
"soma.fukushima.jp":false,
"sukagawa.fukushima.jp":false,
"taishin.fukushima.jp":false,
"tamakawa.fukushima.jp":false,
"tanagura.fukushima.jp":false,
"tenei.fukushima.jp":false,
"yabuki.fukushima.jp":false,
"yamato.fukushima.jp":false,
"yamatsuri.fukushima.jp":false,
"yanaizu.fukushima.jp":false,
"yugawa.fukushima.jp":false,
"anpachi.gifu.jp":false,
"ena.gifu.jp":false,
"gifu.gifu.jp":false,
"ginan.gifu.jp":false,
"godo.gifu.jp":false,
"gujo.gifu.jp":false,
"hashima.gifu.jp":false,
"hichiso.gifu.jp":false,
"hida.gifu.jp":false,
"higashishirakawa.gifu.jp":false,
"ibigawa.gifu.jp":false,
"ikeda.gifu.jp":false,
"kakamigahara.gifu.jp":false,
"kani.gifu.jp":false,
"kasahara.gifu.jp":false,
"kasamatsu.gifu.jp":false,
"kawaue.gifu.jp":false,
"kitagata.gifu.jp":false,
"mino.gifu.jp":false,
"minokamo.gifu.jp":false,
"mitake.gifu.jp":false,
"mizunami.gifu.jp":false,
"motosu.gifu.jp":false,
"nakatsugawa.gifu.jp":false,
"ogaki.gifu.jp":false,
"sakahogi.gifu.jp":false,
"seki.gifu.jp":false,
"sekigahara.gifu.jp":false,
"shirakawa.gifu.jp":false,
"tajimi.gifu.jp":false,
"takayama.gifu.jp":false,
"tarui.gifu.jp":false,
"toki.gifu.jp":false,
"tomika.gifu.jp":false,
"wanouchi.gifu.jp":false,
"yamagata.gifu.jp":false,
"yaotsu.gifu.jp":false,
"yoro.gifu.jp":false,
"annaka.gunma.jp":false,
"chiyoda.gunma.jp":false,
"fujioka.gunma.jp":false,
"higashiagatsuma.gunma.jp":false,
"isesaki.gunma.jp":false,
"itakura.gunma.jp":false,
"kanna.gunma.jp":false,
"kanra.gunma.jp":false,
"katashina.gunma.jp":false,
"kawaba.gunma.jp":false,
"kiryu.gunma.jp":false,
"kusatsu.gunma.jp":false,
"maebashi.gunma.jp":false,
"meiwa.gunma.jp":false,
"midori.gunma.jp":false,
"minakami.gunma.jp":false,
"naganohara.gunma.jp":false,
"nakanojo.gunma.jp":false,
"nanmoku.gunma.jp":false,
"numata.gunma.jp":false,
"oizumi.gunma.jp":false,
"ora.gunma.jp":false,
"ota.gunma.jp":false,
"shibukawa.gunma.jp":false,
"shimonita.gunma.jp":false,
"shinto.gunma.jp":false,
"showa.gunma.jp":false,
"takasaki.gunma.jp":false,
"takayama.gunma.jp":false,
"tamamura.gunma.jp":false,
"tatebayashi.gunma.jp":false,
"tomioka.gunma.jp":false,
"tsukiyono.gunma.jp":false,
"tsumagoi.gunma.jp":false,
"ueno.gunma.jp":false,
"yoshioka.gunma.jp":false,
"asaminami.hiroshima.jp":false,
"daiwa.hiroshima.jp":false,
"etajima.hiroshima.jp":false,
"fuchu.hiroshima.jp":false,
"fukuyama.hiroshima.jp":false,
"hatsukaichi.hiroshima.jp":false,
"higashihiroshima.hiroshima.jp":false,
"hongo.hiroshima.jp":false,
"jinsekikogen.hiroshima.jp":false,
"kaita.hiroshima.jp":false,
"kui.hiroshima.jp":false,
"kumano.hiroshima.jp":false,
"kure.hiroshima.jp":false,
"mihara.hiroshima.jp":false,
"miyoshi.hiroshima.jp":false,
"naka.hiroshima.jp":false,
"onomichi.hiroshima.jp":false,
"osakikamijima.hiroshima.jp":false,
"otake.hiroshima.jp":false,
"saka.hiroshima.jp":false,
"sera.hiroshima.jp":false,
"seranishi.hiroshima.jp":false,
"shinichi.hiroshima.jp":false,
"shobara.hiroshima.jp":false,
"takehara.hiroshima.jp":false,
"abashiri.hokkaido.jp":false,
"abira.hokkaido.jp":false,
"aibetsu.hokkaido.jp":false,
"akabira.hokkaido.jp":false,
"akkeshi.hokkaido.jp":false,
"asahikawa.hokkaido.jp":false,
"ashibetsu.hokkaido.jp":false,
"ashoro.hokkaido.jp":false,
"assabu.hokkaido.jp":false,
"atsuma.hokkaido.jp":false,
"bibai.hokkaido.jp":false,
"biei.hokkaido.jp":false,
"bifuka.hokkaido.jp":false,
"bihoro.hokkaido.jp":false,
"biratori.hokkaido.jp":false,
"chippubetsu.hokkaido.jp":false,
"chitose.hokkaido.jp":false,
"date.hokkaido.jp":false,
"ebetsu.hokkaido.jp":false,
"embetsu.hokkaido.jp":false,
"eniwa.hokkaido.jp":false,
"erimo.hokkaido.jp":false,
"esan.hokkaido.jp":false,
"esashi.hokkaido.jp":false,
"fukagawa.hokkaido.jp":false,
"fukushima.hokkaido.jp":false,
"furano.hokkaido.jp":false,
"furubira.hokkaido.jp":false,
"haboro.hokkaido.jp":false,
"hakodate.hokkaido.jp":false,
"hamatonbetsu.hokkaido.jp":false,
"hidaka.hokkaido.jp":false,
"higashikagura.hokkaido.jp":false,
"higashikawa.hokkaido.jp":false,
"hiroo.hokkaido.jp":false,
"hokuryu.hokkaido.jp":false,
"hokuto.hokkaido.jp":false,
"honbetsu.hokkaido.jp":false,
"horokanai.hokkaido.jp":false,
"horonobe.hokkaido.jp":false,
"ikeda.hokkaido.jp":false,
"imakane.hokkaido.jp":false,
"ishikari.hokkaido.jp":false,
"iwamizawa.hokkaido.jp":false,
"iwanai.hokkaido.jp":false,
"kamifurano.hokkaido.jp":false,
"kamikawa.hokkaido.jp":false,
"kamishihoro.hokkaido.jp":false,
"kamisunagawa.hokkaido.jp":false,
"kamoenai.hokkaido.jp":false,
"kayabe.hokkaido.jp":false,
"kembuchi.hokkaido.jp":false,
"kikonai.hokkaido.jp":false,
"kimobetsu.hokkaido.jp":false,
"kitahiroshima.hokkaido.jp":false,
"kitami.hokkaido.jp":false,
"kiyosato.hokkaido.jp":false,
"koshimizu.hokkaido.jp":false,
"kunneppu.hokkaido.jp":false,
"kuriyama.hokkaido.jp":false,
"kuromatsunai.hokkaido.jp":false,
"kushiro.hokkaido.jp":false,
"kutchan.hokkaido.jp":false,
"kyowa.hokkaido.jp":false,
"mashike.hokkaido.jp":false,
"matsumae.hokkaido.jp":false,
"mikasa.hokkaido.jp":false,
"minamifurano.hokkaido.jp":false,
"mombetsu.hokkaido.jp":false,
"moseushi.hokkaido.jp":false,
"mukawa.hokkaido.jp":false,
"muroran.hokkaido.jp":false,
"naie.hokkaido.jp":false,
"nakagawa.hokkaido.jp":false,
"nakasatsunai.hokkaido.jp":false,
"nakatombetsu.hokkaido.jp":false,
"nanae.hokkaido.jp":false,
"nanporo.hokkaido.jp":false,
"nayoro.hokkaido.jp":false,
"nemuro.hokkaido.jp":false,
"niikappu.hokkaido.jp":false,
"niki.hokkaido.jp":false,
"nishiokoppe.hokkaido.jp":false,
"noboribetsu.hokkaido.jp":false,
"numata.hokkaido.jp":false,
"obihiro.hokkaido.jp":false,
"obira.hokkaido.jp":false,
"oketo.hokkaido.jp":false,
"okoppe.hokkaido.jp":false,
"otaru.hokkaido.jp":false,
"otobe.hokkaido.jp":false,
"otofuke.hokkaido.jp":false,
"otoineppu.hokkaido.jp":false,
"oumu.hokkaido.jp":false,
"ozora.hokkaido.jp":false,
"pippu.hokkaido.jp":false,
"rankoshi.hokkaido.jp":false,
"rebun.hokkaido.jp":false,
"rikubetsu.hokkaido.jp":false,
"rishiri.hokkaido.jp":false,
"rishirifuji.hokkaido.jp":false,
"saroma.hokkaido.jp":false,
"sarufutsu.hokkaido.jp":false,
"shakotan.hokkaido.jp":false,
"shari.hokkaido.jp":false,
"shibecha.hokkaido.jp":false,
"shibetsu.hokkaido.jp":false,
"shikabe.hokkaido.jp":false,
"shikaoi.hokkaido.jp":false,
"shimamaki.hokkaido.jp":false,
"shimizu.hokkaido.jp":false,
"shimokawa.hokkaido.jp":false,
"shinshinotsu.hokkaido.jp":false,
"shintoku.hokkaido.jp":false,
"shiranuka.hokkaido.jp":false,
"shiraoi.hokkaido.jp":false,
"shiriuchi.hokkaido.jp":false,
"sobetsu.hokkaido.jp":false,
"sunagawa.hokkaido.jp":false,
"taiki.hokkaido.jp":false,
"takasu.hokkaido.jp":false,
"takikawa.hokkaido.jp":false,
"takinoue.hokkaido.jp":false,
"teshikaga.hokkaido.jp":false,
"tobetsu.hokkaido.jp":false,
"tohma.hokkaido.jp":false,
"tomakomai.hokkaido.jp":false,
"tomari.hokkaido.jp":false,
"toya.hokkaido.jp":false,
"toyako.hokkaido.jp":false,
"toyotomi.hokkaido.jp":false,
"toyoura.hokkaido.jp":false,
"tsubetsu.hokkaido.jp":false,
"tsukigata.hokkaido.jp":false,
"urakawa.hokkaido.jp":false,
"urausu.hokkaido.jp":false,
"uryu.hokkaido.jp":false,
"utashinai.hokkaido.jp":false,
"wakkanai.hokkaido.jp":false,
"wassamu.hokkaido.jp":false,
"yakumo.hokkaido.jp":false,
"yoichi.hokkaido.jp":false,
"aioi.hyogo.jp":false,
"akashi.hyogo.jp":false,
"ako.hyogo.jp":false,
"amagasaki.hyogo.jp":false,
"aogaki.hyogo.jp":false,
"asago.hyogo.jp":false,
"ashiya.hyogo.jp":false,
"awaji.hyogo.jp":false,
"fukusaki.hyogo.jp":false,
"goshiki.hyogo.jp":false,
"harima.hyogo.jp":false,
"himeji.hyogo.jp":false,
"ichikawa.hyogo.jp":false,
"inagawa.hyogo.jp":false,
"itami.hyogo.jp":false,
"kakogawa.hyogo.jp":false,
"kamigori.hyogo.jp":false,
"kamikawa.hyogo.jp":false,
"kasai.hyogo.jp":false,
"kasuga.hyogo.jp":false,
"kawanishi.hyogo.jp":false,
"miki.hyogo.jp":false,
"minamiawaji.hyogo.jp":false,
"nishinomiya.hyogo.jp":false,
"nishiwaki.hyogo.jp":false,
"ono.hyogo.jp":false,
"sanda.hyogo.jp":false,
"sannan.hyogo.jp":false,
"sasayama.hyogo.jp":false,
"sayo.hyogo.jp":false,
"shingu.hyogo.jp":false,
"shinonsen.hyogo.jp":false,
"shiso.hyogo.jp":false,
"sumoto.hyogo.jp":false,
"taishi.hyogo.jp":false,
"taka.hyogo.jp":false,
"takarazuka.hyogo.jp":false,
"takasago.hyogo.jp":false,
"takino.hyogo.jp":false,
"tamba.hyogo.jp":false,
"tatsuno.hyogo.jp":false,
"toyooka.hyogo.jp":false,
"yabu.hyogo.jp":false,
"yashiro.hyogo.jp":false,
"yoka.hyogo.jp":false,
"yokawa.hyogo.jp":false,
"ami.ibaraki.jp":false,
"asahi.ibaraki.jp":false,
"bando.ibaraki.jp":false,
"chikusei.ibaraki.jp":false,
"daigo.ibaraki.jp":false,
"fujishiro.ibaraki.jp":false,
"hitachi.ibaraki.jp":false,
"hitachinaka.ibaraki.jp":false,
"hitachiomiya.ibaraki.jp":false,
"hitachiota.ibaraki.jp":false,
"ibaraki.ibaraki.jp":false,
"ina.ibaraki.jp":false,
"inashiki.ibaraki.jp":false,
"itako.ibaraki.jp":false,
"iwama.ibaraki.jp":false,
"joso.ibaraki.jp":false,
"kamisu.ibaraki.jp":false,
"kasama.ibaraki.jp":false,
"kashima.ibaraki.jp":false,
"kasumigaura.ibaraki.jp":false,
"koga.ibaraki.jp":false,
"miho.ibaraki.jp":false,
"mito.ibaraki.jp":false,
"moriya.ibaraki.jp":false,
"naka.ibaraki.jp":false,
"namegata.ibaraki.jp":false,
"oarai.ibaraki.jp":false,
"ogawa.ibaraki.jp":false,
"omitama.ibaraki.jp":false,
"ryugasaki.ibaraki.jp":false,
"sakai.ibaraki.jp":false,
"sakuragawa.ibaraki.jp":false,
"shimodate.ibaraki.jp":false,
"shimotsuma.ibaraki.jp":false,
"shirosato.ibaraki.jp":false,
"sowa.ibaraki.jp":false,
"suifu.ibaraki.jp":false,
"takahagi.ibaraki.jp":false,
"tamatsukuri.ibaraki.jp":false,
"tokai.ibaraki.jp":false,
"tomobe.ibaraki.jp":false,
"tone.ibaraki.jp":false,
"toride.ibaraki.jp":false,
"tsuchiura.ibaraki.jp":false,
"tsukuba.ibaraki.jp":false,
"uchihara.ibaraki.jp":false,
"ushiku.ibaraki.jp":false,
"yachiyo.ibaraki.jp":false,
"yamagata.ibaraki.jp":false,
"yawara.ibaraki.jp":false,
"yuki.ibaraki.jp":false,
"anamizu.ishikawa.jp":false,
"hakui.ishikawa.jp":false,
"hakusan.ishikawa.jp":false,
"kaga.ishikawa.jp":false,
"kahoku.ishikawa.jp":false,
"kanazawa.ishikawa.jp":false,
"kawakita.ishikawa.jp":false,
"komatsu.ishikawa.jp":false,
"nakanoto.ishikawa.jp":false,
"nanao.ishikawa.jp":false,
"nomi.ishikawa.jp":false,
"nonoichi.ishikawa.jp":false,
"noto.ishikawa.jp":false,
"shika.ishikawa.jp":false,
"suzu.ishikawa.jp":false,
"tsubata.ishikawa.jp":false,
"tsurugi.ishikawa.jp":false,
"uchinada.ishikawa.jp":false,
"wajima.ishikawa.jp":false,
"fudai.iwate.jp":false,
"fujisawa.iwate.jp":false,
"hanamaki.iwate.jp":false,
"hiraizumi.iwate.jp":false,
"hirono.iwate.jp":false,
"ichinohe.iwate.jp":false,
"ichinoseki.iwate.jp":false,
"iwaizumi.iwate.jp":false,
"iwate.iwate.jp":false,
"joboji.iwate.jp":false,
"kamaishi.iwate.jp":false,
"kanegasaki.iwate.jp":false,
"karumai.iwate.jp":false,
"kawai.iwate.jp":false,
"kitakami.iwate.jp":false,
"kuji.iwate.jp":false,
"kunohe.iwate.jp":false,
"kuzumaki.iwate.jp":false,
"miyako.iwate.jp":false,
"mizusawa.iwate.jp":false,
"morioka.iwate.jp":false,
"ninohe.iwate.jp":false,
"noda.iwate.jp":false,
"ofunato.iwate.jp":false,
"oshu.iwate.jp":false,
"otsuchi.iwate.jp":false,
"rikuzentakata.iwate.jp":false,
"shiwa.iwate.jp":false,
"shizukuishi.iwate.jp":false,
"sumita.iwate.jp":false,
"tanohata.iwate.jp":false,
"tono.iwate.jp":false,
"yahaba.iwate.jp":false,
"yamada.iwate.jp":false,
"ayagawa.kagawa.jp":false,
"higashikagawa.kagawa.jp":false,
"kanonji.kagawa.jp":false,
"kotohira.kagawa.jp":false,
"manno.kagawa.jp":false,
"marugame.kagawa.jp":false,
"mitoyo.kagawa.jp":false,
"naoshima.kagawa.jp":false,
"sanuki.kagawa.jp":false,
"tadotsu.kagawa.jp":false,
"takamatsu.kagawa.jp":false,
"tonosho.kagawa.jp":false,
"uchinomi.kagawa.jp":false,
"utazu.kagawa.jp":false,
"zentsuji.kagawa.jp":false,
"akune.kagoshima.jp":false,
"amami.kagoshima.jp":false,
"hioki.kagoshima.jp":false,
"isa.kagoshima.jp":false,
"isen.kagoshima.jp":false,
"izumi.kagoshima.jp":false,
"kagoshima.kagoshima.jp":false,
"kanoya.kagoshima.jp":false,
"kawanabe.kagoshima.jp":false,
"kinko.kagoshima.jp":false,
"kouyama.kagoshima.jp":false,
"makurazaki.kagoshima.jp":false,
"matsumoto.kagoshima.jp":false,
"minamitane.kagoshima.jp":false,
"nakatane.kagoshima.jp":false,
"nishinoomote.kagoshima.jp":false,
"satsumasendai.kagoshima.jp":false,
"soo.kagoshima.jp":false,
"tarumizu.kagoshima.jp":false,
"yusui.kagoshima.jp":false,
"aikawa.kanagawa.jp":false,
"atsugi.kanagawa.jp":false,
"ayase.kanagawa.jp":false,
"chigasaki.kanagawa.jp":false,
"ebina.kanagawa.jp":false,
"fujisawa.kanagawa.jp":false,
"hadano.kanagawa.jp":false,
"hakone.kanagawa.jp":false,
"hiratsuka.kanagawa.jp":false,
"isehara.kanagawa.jp":false,
"kaisei.kanagawa.jp":false,
"kamakura.kanagawa.jp":false,
"kiyokawa.kanagawa.jp":false,
"matsuda.kanagawa.jp":false,
"minamiashigara.kanagawa.jp":false,
"miura.kanagawa.jp":false,
"nakai.kanagawa.jp":false,
"ninomiya.kanagawa.jp":false,
"odawara.kanagawa.jp":false,
"oi.kanagawa.jp":false,
"oiso.kanagawa.jp":false,
"sagamihara.kanagawa.jp":false,
"samukawa.kanagawa.jp":false,
"tsukui.kanagawa.jp":false,
"yamakita.kanagawa.jp":false,
"yamato.kanagawa.jp":false,
"yokosuka.kanagawa.jp":false,
"yugawara.kanagawa.jp":false,
"zama.kanagawa.jp":false,
"zushi.kanagawa.jp":false,
"aki.kochi.jp":false,
"geisei.kochi.jp":false,
"hidaka.kochi.jp":false,
"higashitsuno.kochi.jp":false,
"ino.kochi.jp":false,
"kagami.kochi.jp":false,
"kami.kochi.jp":false,
"kitagawa.kochi.jp":false,
"kochi.kochi.jp":false,
"mihara.kochi.jp":false,
"motoyama.kochi.jp":false,
"muroto.kochi.jp":false,
"nahari.kochi.jp":false,
"nakamura.kochi.jp":false,
"nankoku.kochi.jp":false,
"nishitosa.kochi.jp":false,
"niyodogawa.kochi.jp":false,
"ochi.kochi.jp":false,
"okawa.kochi.jp":false,
"otoyo.kochi.jp":false,
"otsuki.kochi.jp":false,
"sakawa.kochi.jp":false,
"sukumo.kochi.jp":false,
"susaki.kochi.jp":false,
"tosa.kochi.jp":false,
"tosashimizu.kochi.jp":false,
"toyo.kochi.jp":false,
"tsuno.kochi.jp":false,
"umaji.kochi.jp":false,
"yasuda.kochi.jp":false,
"yusuhara.kochi.jp":false,
"amakusa.kumamoto.jp":false,
"arao.kumamoto.jp":false,
"aso.kumamoto.jp":false,
"choyo.kumamoto.jp":false,
"gyokuto.kumamoto.jp":false,
"kamiamakusa.kumamoto.jp":false,
"kikuchi.kumamoto.jp":false,
"kumamoto.kumamoto.jp":false,
"mashiki.kumamoto.jp":false,
"mifune.kumamoto.jp":false,
"minamata.kumamoto.jp":false,
"minamioguni.kumamoto.jp":false,
"nagasu.kumamoto.jp":false,
"nishihara.kumamoto.jp":false,
"oguni.kumamoto.jp":false,
"ozu.kumamoto.jp":false,
"sumoto.kumamoto.jp":false,
"takamori.kumamoto.jp":false,
"uki.kumamoto.jp":false,
"uto.kumamoto.jp":false,
"yamaga.kumamoto.jp":false,
"yamato.kumamoto.jp":false,
"yatsushiro.kumamoto.jp":false,
"ayabe.kyoto.jp":false,
"fukuchiyama.kyoto.jp":false,
"higashiyama.kyoto.jp":false,
"ide.kyoto.jp":false,
"ine.kyoto.jp":false,
"joyo.kyoto.jp":false,
"kameoka.kyoto.jp":false,
"kamo.kyoto.jp":false,
"kita.kyoto.jp":false,
"kizu.kyoto.jp":false,
"kumiyama.kyoto.jp":false,
"kyotamba.kyoto.jp":false,
"kyotanabe.kyoto.jp":false,
"kyotango.kyoto.jp":false,
"maizuru.kyoto.jp":false,
"minami.kyoto.jp":false,
"minamiyamashiro.kyoto.jp":false,
"miyazu.kyoto.jp":false,
"muko.kyoto.jp":false,
"nagaokakyo.kyoto.jp":false,
"nakagyo.kyoto.jp":false,
"nantan.kyoto.jp":false,
"oyamazaki.kyoto.jp":false,
"sakyo.kyoto.jp":false,
"seika.kyoto.jp":false,
"tanabe.kyoto.jp":false,
"uji.kyoto.jp":false,
"ujitawara.kyoto.jp":false,
"wazuka.kyoto.jp":false,
"yamashina.kyoto.jp":false,
"yawata.kyoto.jp":false,
"asahi.mie.jp":false,
"inabe.mie.jp":false,
"ise.mie.jp":false,
"kameyama.mie.jp":false,
"kawagoe.mie.jp":false,
"kiho.mie.jp":false,
"kisosaki.mie.jp":false,
"kiwa.mie.jp":false,
"komono.mie.jp":false,
"kumano.mie.jp":false,
"kuwana.mie.jp":false,
"matsusaka.mie.jp":false,
"meiwa.mie.jp":false,
"mihama.mie.jp":false,
"minamiise.mie.jp":false,
"misugi.mie.jp":false,
"miyama.mie.jp":false,
"nabari.mie.jp":false,
"shima.mie.jp":false,
"suzuka.mie.jp":false,
"tado.mie.jp":false,
"taiki.mie.jp":false,
"taki.mie.jp":false,
"tamaki.mie.jp":false,
"toba.mie.jp":false,
"tsu.mie.jp":false,
"udono.mie.jp":false,
"ureshino.mie.jp":false,
"watarai.mie.jp":false,
"yokkaichi.mie.jp":false,
"furukawa.miyagi.jp":false,
"higashimatsushima.miyagi.jp":false,
"ishinomaki.miyagi.jp":false,
"iwanuma.miyagi.jp":false,
"kakuda.miyagi.jp":false,
"kami.miyagi.jp":false,
"kawasaki.miyagi.jp":false,
"marumori.miyagi.jp":false,
"matsushima.miyagi.jp":false,
"minamisanriku.miyagi.jp":false,
"misato.miyagi.jp":false,
"murata.miyagi.jp":false,
"natori.miyagi.jp":false,
"ogawara.miyagi.jp":false,
"ohira.miyagi.jp":false,
"onagawa.miyagi.jp":false,
"osaki.miyagi.jp":false,
"rifu.miyagi.jp":false,
"semine.miyagi.jp":false,
"shibata.miyagi.jp":false,
"shichikashuku.miyagi.jp":false,
"shikama.miyagi.jp":false,
"shiogama.miyagi.jp":false,
"shiroishi.miyagi.jp":false,
"tagajo.miyagi.jp":false,
"taiwa.miyagi.jp":false,
"tome.miyagi.jp":false,
"tomiya.miyagi.jp":false,
"wakuya.miyagi.jp":false,
"watari.miyagi.jp":false,
"yamamoto.miyagi.jp":false,
"zao.miyagi.jp":false,
"aya.miyazaki.jp":false,
"ebino.miyazaki.jp":false,
"gokase.miyazaki.jp":false,
"hyuga.miyazaki.jp":false,
"kadogawa.miyazaki.jp":false,
"kawaminami.miyazaki.jp":false,
"kijo.miyazaki.jp":false,
"kitagawa.miyazaki.jp":false,
"kitakata.miyazaki.jp":false,
"kitaura.miyazaki.jp":false,
"kobayashi.miyazaki.jp":false,
"kunitomi.miyazaki.jp":false,
"kushima.miyazaki.jp":false,
"mimata.miyazaki.jp":false,
"miyakonojo.miyazaki.jp":false,
"miyazaki.miyazaki.jp":false,
"morotsuka.miyazaki.jp":false,
"nichinan.miyazaki.jp":false,
"nishimera.miyazaki.jp":false,
"nobeoka.miyazaki.jp":false,
"saito.miyazaki.jp":false,
"shiiba.miyazaki.jp":false,
"shintomi.miyazaki.jp":false,
"takaharu.miyazaki.jp":false,
"takanabe.miyazaki.jp":false,
"takazaki.miyazaki.jp":false,
"tsuno.miyazaki.jp":false,
"achi.nagano.jp":false,
"agematsu.nagano.jp":false,
"anan.nagano.jp":false,
"aoki.nagano.jp":false,
"asahi.nagano.jp":false,
"azumino.nagano.jp":false,
"chikuhoku.nagano.jp":false,
"chikuma.nagano.jp":false,
"chino.nagano.jp":false,
"fujimi.nagano.jp":false,
"hakuba.nagano.jp":false,
"hara.nagano.jp":false,
"hiraya.nagano.jp":false,
"iida.nagano.jp":false,
"iijima.nagano.jp":false,
"iiyama.nagano.jp":false,
"iizuna.nagano.jp":false,
"ikeda.nagano.jp":false,
"ikusaka.nagano.jp":false,
"ina.nagano.jp":false,
"karuizawa.nagano.jp":false,
"kawakami.nagano.jp":false,
"kiso.nagano.jp":false,
"kisofukushima.nagano.jp":false,
"kitaaiki.nagano.jp":false,
"komagane.nagano.jp":false,
"komoro.nagano.jp":false,
"matsukawa.nagano.jp":false,
"matsumoto.nagano.jp":false,
"miasa.nagano.jp":false,
"minamiaiki.nagano.jp":false,
"minamimaki.nagano.jp":false,
"minamiminowa.nagano.jp":false,
"minowa.nagano.jp":false,
"miyada.nagano.jp":false,
"miyota.nagano.jp":false,
"mochizuki.nagano.jp":false,
"nagano.nagano.jp":false,
"nagawa.nagano.jp":false,
"nagiso.nagano.jp":false,
"nakagawa.nagano.jp":false,
"nakano.nagano.jp":false,
"nozawaonsen.nagano.jp":false,
"obuse.nagano.jp":false,
"ogawa.nagano.jp":false,
"okaya.nagano.jp":false,
"omachi.nagano.jp":false,
"omi.nagano.jp":false,
"ookuwa.nagano.jp":false,
"ooshika.nagano.jp":false,
"otaki.nagano.jp":false,
"otari.nagano.jp":false,
"sakae.nagano.jp":false,
"sakaki.nagano.jp":false,
"saku.nagano.jp":false,
"sakuho.nagano.jp":false,
"shimosuwa.nagano.jp":false,
"shinanomachi.nagano.jp":false,
"shiojiri.nagano.jp":false,
"suwa.nagano.jp":false,
"suzaka.nagano.jp":false,
"takagi.nagano.jp":false,
"takamori.nagano.jp":false,
"takayama.nagano.jp":false,
"tateshina.nagano.jp":false,
"tatsuno.nagano.jp":false,
"togakushi.nagano.jp":false,
"togura.nagano.jp":false,
"tomi.nagano.jp":false,
"ueda.nagano.jp":false,
"wada.nagano.jp":false,
"yamagata.nagano.jp":false,
"yamanouchi.nagano.jp":false,
"yasaka.nagano.jp":false,
"yasuoka.nagano.jp":false,
"chijiwa.nagasaki.jp":false,
"futsu.nagasaki.jp":false,
"goto.nagasaki.jp":false,
"hasami.nagasaki.jp":false,
"hirado.nagasaki.jp":false,
"iki.nagasaki.jp":false,
"isahaya.nagasaki.jp":false,
"kawatana.nagasaki.jp":false,
"kuchinotsu.nagasaki.jp":false,
"matsuura.nagasaki.jp":false,
"nagasaki.nagasaki.jp":false,
"obama.nagasaki.jp":false,
"omura.nagasaki.jp":false,
"oseto.nagasaki.jp":false,
"saikai.nagasaki.jp":false,
"sasebo.nagasaki.jp":false,
"seihi.nagasaki.jp":false,
"shimabara.nagasaki.jp":false,
"shinkamigoto.nagasaki.jp":false,
"togitsu.nagasaki.jp":false,
"tsushima.nagasaki.jp":false,
"unzen.nagasaki.jp":false,
"ando.nara.jp":false,
"gose.nara.jp":false,
"heguri.nara.jp":false,
"higashiyoshino.nara.jp":false,
"ikaruga.nara.jp":false,
"ikoma.nara.jp":false,
"kamikitayama.nara.jp":false,
"kanmaki.nara.jp":false,
"kashiba.nara.jp":false,
"kashihara.nara.jp":false,
"katsuragi.nara.jp":false,
"kawai.nara.jp":false,
"kawakami.nara.jp":false,
"kawanishi.nara.jp":false,
"koryo.nara.jp":false,
"kurotaki.nara.jp":false,
"mitsue.nara.jp":false,
"miyake.nara.jp":false,
"nara.nara.jp":false,
"nosegawa.nara.jp":false,
"oji.nara.jp":false,
"ouda.nara.jp":false,
"oyodo.nara.jp":false,
"sakurai.nara.jp":false,
"sango.nara.jp":false,
"shimoichi.nara.jp":false,
"shimokitayama.nara.jp":false,
"shinjo.nara.jp":false,
"soni.nara.jp":false,
"takatori.nara.jp":false,
"tawaramoto.nara.jp":false,
"tenkawa.nara.jp":false,
"tenri.nara.jp":false,
"uda.nara.jp":false,
"yamatokoriyama.nara.jp":false,
"yamatotakada.nara.jp":false,
"yamazoe.nara.jp":false,
"yoshino.nara.jp":false,
"aga.niigata.jp":false,
"agano.niigata.jp":false,
"gosen.niigata.jp":false,
"itoigawa.niigata.jp":false,
"izumozaki.niigata.jp":false,
"joetsu.niigata.jp":false,
"kamo.niigata.jp":false,
"kariwa.niigata.jp":false,
"kashiwazaki.niigata.jp":false,
"minamiuonuma.niigata.jp":false,
"mitsuke.niigata.jp":false,
"muika.niigata.jp":false,
"murakami.niigata.jp":false,
"myoko.niigata.jp":false,
"nagaoka.niigata.jp":false,
"niigata.niigata.jp":false,
"ojiya.niigata.jp":false,
"omi.niigata.jp":false,
"sado.niigata.jp":false,
"sanjo.niigata.jp":false,
"seiro.niigata.jp":false,
"seirou.niigata.jp":false,
"sekikawa.niigata.jp":false,
"shibata.niigata.jp":false,
"tagami.niigata.jp":false,
"tainai.niigata.jp":false,
"tochio.niigata.jp":false,
"tokamachi.niigata.jp":false,
"tsubame.niigata.jp":false,
"tsunan.niigata.jp":false,
"uonuma.niigata.jp":false,
"yahiko.niigata.jp":false,
"yoita.niigata.jp":false,
"yuzawa.niigata.jp":false,
"beppu.oita.jp":false,
"bungoono.oita.jp":false,
"bungotakada.oita.jp":false,
"hasama.oita.jp":false,
"hiji.oita.jp":false,
"himeshima.oita.jp":false,
"hita.oita.jp":false,
"kamitsue.oita.jp":false,
"kokonoe.oita.jp":false,
"kuju.oita.jp":false,
"kunisaki.oita.jp":false,
"kusu.oita.jp":false,
"oita.oita.jp":false,
"saiki.oita.jp":false,
"taketa.oita.jp":false,
"tsukumi.oita.jp":false,
"usa.oita.jp":false,
"usuki.oita.jp":false,
"yufu.oita.jp":false,
"akaiwa.okayama.jp":false,
"asakuchi.okayama.jp":false,
"bizen.okayama.jp":false,
"hayashima.okayama.jp":false,
"ibara.okayama.jp":false,
"kagamino.okayama.jp":false,
"kasaoka.okayama.jp":false,
"kibichuo.okayama.jp":false,
"kumenan.okayama.jp":false,
"kurashiki.okayama.jp":false,
"maniwa.okayama.jp":false,
"misaki.okayama.jp":false,
"nagi.okayama.jp":false,
"niimi.okayama.jp":false,
"nishiawakura.okayama.jp":false,
"okayama.okayama.jp":false,
"satosho.okayama.jp":false,
"setouchi.okayama.jp":false,
"shinjo.okayama.jp":false,
"shoo.okayama.jp":false,
"soja.okayama.jp":false,
"takahashi.okayama.jp":false,
"tamano.okayama.jp":false,
"tsuyama.okayama.jp":false,
"wake.okayama.jp":false,
"yakage.okayama.jp":false,
"aguni.okinawa.jp":false,
"ginowan.okinawa.jp":false,
"ginoza.okinawa.jp":false,
"gushikami.okinawa.jp":false,
"haebaru.okinawa.jp":false,
"higashi.okinawa.jp":false,
"hirara.okinawa.jp":false,
"iheya.okinawa.jp":false,
"ishigaki.okinawa.jp":false,
"ishikawa.okinawa.jp":false,
"itoman.okinawa.jp":false,
"izena.okinawa.jp":false,
"kadena.okinawa.jp":false,
"kin.okinawa.jp":false,
"kitadaito.okinawa.jp":false,
"kitanakagusuku.okinawa.jp":false,
"kumejima.okinawa.jp":false,
"kunigami.okinawa.jp":false,
"minamidaito.okinawa.jp":false,
"motobu.okinawa.jp":false,
"nago.okinawa.jp":false,
"naha.okinawa.jp":false,
"nakagusuku.okinawa.jp":false,
"nakijin.okinawa.jp":false,
"nanjo.okinawa.jp":false,
"nishihara.okinawa.jp":false,
"ogimi.okinawa.jp":false,
"okinawa.okinawa.jp":false,
"onna.okinawa.jp":false,
"shimoji.okinawa.jp":false,
"taketomi.okinawa.jp":false,
"tarama.okinawa.jp":false,
"tokashiki.okinawa.jp":false,
"tomigusuku.okinawa.jp":false,
"tonaki.okinawa.jp":false,
"urasoe.okinawa.jp":false,
"uruma.okinawa.jp":false,
"yaese.okinawa.jp":false,
"yomitan.okinawa.jp":false,
"yonabaru.okinawa.jp":false,
"yonaguni.okinawa.jp":false,
"zamami.okinawa.jp":false,
"abeno.osaka.jp":false,
"chihayaakasaka.osaka.jp":false,
"chuo.osaka.jp":false,
"daito.osaka.jp":false,
"fujiidera.osaka.jp":false,
"habikino.osaka.jp":false,
"hannan.osaka.jp":false,
"higashiosaka.osaka.jp":false,
"higashisumiyoshi.osaka.jp":false,
"higashiyodogawa.osaka.jp":false,
"hirakata.osaka.jp":false,
"ibaraki.osaka.jp":false,
"ikeda.osaka.jp":false,
"izumi.osaka.jp":false,
"izumiotsu.osaka.jp":false,
"izumisano.osaka.jp":false,
"kadoma.osaka.jp":false,
"kaizuka.osaka.jp":false,
"kanan.osaka.jp":false,
"kashiwara.osaka.jp":false,
"katano.osaka.jp":false,
"kawachinagano.osaka.jp":false,
"kishiwada.osaka.jp":false,
"kita.osaka.jp":false,
"kumatori.osaka.jp":false,
"matsubara.osaka.jp":false,
"minato.osaka.jp":false,
"minoh.osaka.jp":false,
"misaki.osaka.jp":false,
"moriguchi.osaka.jp":false,
"neyagawa.osaka.jp":false,
"nishi.osaka.jp":false,
"nose.osaka.jp":false,
"osakasayama.osaka.jp":false,
"sakai.osaka.jp":false,
"sayama.osaka.jp":false,
"sennan.osaka.jp":false,
"settsu.osaka.jp":false,
"shijonawate.osaka.jp":false,
"shimamoto.osaka.jp":false,
"suita.osaka.jp":false,
"tadaoka.osaka.jp":false,
"taishi.osaka.jp":false,
"tajiri.osaka.jp":false,
"takaishi.osaka.jp":false,
"takatsuki.osaka.jp":false,
"tondabayashi.osaka.jp":false,
"toyonaka.osaka.jp":false,
"toyono.osaka.jp":false,
"yao.osaka.jp":false,
"ariake.saga.jp":false,
"arita.saga.jp":false,
"fukudomi.saga.jp":false,
"genkai.saga.jp":false,
"hamatama.saga.jp":false,
"hizen.saga.jp":false,
"imari.saga.jp":false,
"kamimine.saga.jp":false,
"kanzaki.saga.jp":false,
"karatsu.saga.jp":false,
"kashima.saga.jp":false,
"kitagata.saga.jp":false,
"kitahata.saga.jp":false,
"kiyama.saga.jp":false,
"kouhoku.saga.jp":false,
"kyuragi.saga.jp":false,
"nishiarita.saga.jp":false,
"ogi.saga.jp":false,
"omachi.saga.jp":false,
"ouchi.saga.jp":false,
"saga.saga.jp":false,
"shiroishi.saga.jp":false,
"taku.saga.jp":false,
"tara.saga.jp":false,
"tosu.saga.jp":false,
"yoshinogari.saga.jp":false,
"arakawa.saitama.jp":false,
"asaka.saitama.jp":false,
"chichibu.saitama.jp":false,
"fujimi.saitama.jp":false,
"fujimino.saitama.jp":false,
"fukaya.saitama.jp":false,
"hanno.saitama.jp":false,
"hanyu.saitama.jp":false,
"hasuda.saitama.jp":false,
"hatogaya.saitama.jp":false,
"hatoyama.saitama.jp":false,
"hidaka.saitama.jp":false,
"higashichichibu.saitama.jp":false,
"higashimatsuyama.saitama.jp":false,
"honjo.saitama.jp":false,
"ina.saitama.jp":false,
"iruma.saitama.jp":false,
"iwatsuki.saitama.jp":false,
"kamiizumi.saitama.jp":false,
"kamikawa.saitama.jp":false,
"kamisato.saitama.jp":false,
"kasukabe.saitama.jp":false,
"kawagoe.saitama.jp":false,
"kawaguchi.saitama.jp":false,
"kawajima.saitama.jp":false,
"kazo.saitama.jp":false,
"kitamoto.saitama.jp":false,
"koshigaya.saitama.jp":false,
"kounosu.saitama.jp":false,
"kuki.saitama.jp":false,
"kumagaya.saitama.jp":false,
"matsubushi.saitama.jp":false,
"minano.saitama.jp":false,
"misato.saitama.jp":false,
"miyashiro.saitama.jp":false,
"miyoshi.saitama.jp":false,
"moroyama.saitama.jp":false,
"nagatoro.saitama.jp":false,
"namegawa.saitama.jp":false,
"niiza.saitama.jp":false,
"ogano.saitama.jp":false,
"ogawa.saitama.jp":false,
"ogose.saitama.jp":false,
"okegawa.saitama.jp":false,
"omiya.saitama.jp":false,
"otaki.saitama.jp":false,
"ranzan.saitama.jp":false,
"ryokami.saitama.jp":false,
"saitama.saitama.jp":false,
"sakado.saitama.jp":false,
"satte.saitama.jp":false,
"sayama.saitama.jp":false,
"shiki.saitama.jp":false,
"shiraoka.saitama.jp":false,
"soka.saitama.jp":false,
"sugito.saitama.jp":false,
"toda.saitama.jp":false,
"tokigawa.saitama.jp":false,
"tokorozawa.saitama.jp":false,
"tsurugashima.saitama.jp":false,
"urawa.saitama.jp":false,
"warabi.saitama.jp":false,
"yashio.saitama.jp":false,
"yokoze.saitama.jp":false,
"yono.saitama.jp":false,
"yorii.saitama.jp":false,
"yoshida.saitama.jp":false,
"yoshikawa.saitama.jp":false,
"yoshimi.saitama.jp":false,
"aisho.shiga.jp":false,
"gamo.shiga.jp":false,
"higashiomi.shiga.jp":false,
"hikone.shiga.jp":false,
"koka.shiga.jp":false,
"konan.shiga.jp":false,
"kosei.shiga.jp":false,
"koto.shiga.jp":false,
"kusatsu.shiga.jp":false,
"maibara.shiga.jp":false,
"moriyama.shiga.jp":false,
"nagahama.shiga.jp":false,
"nishiazai.shiga.jp":false,
"notogawa.shiga.jp":false,
"omihachiman.shiga.jp":false,
"otsu.shiga.jp":false,
"ritto.shiga.jp":false,
"ryuoh.shiga.jp":false,
"takashima.shiga.jp":false,
"takatsuki.shiga.jp":false,
"torahime.shiga.jp":false,
"toyosato.shiga.jp":false,
"yasu.shiga.jp":false,
"akagi.shimane.jp":false,
"ama.shimane.jp":false,
"gotsu.shimane.jp":false,
"hamada.shimane.jp":false,
"higashiizumo.shimane.jp":false,
"hikawa.shimane.jp":false,
"hikimi.shimane.jp":false,
"izumo.shimane.jp":false,
"kakinoki.shimane.jp":false,
"masuda.shimane.jp":false,
"matsue.shimane.jp":false,
"misato.shimane.jp":false,
"nishinoshima.shimane.jp":false,
"ohda.shimane.jp":false,
"okinoshima.shimane.jp":false,
"okuizumo.shimane.jp":false,
"shimane.shimane.jp":false,
"tamayu.shimane.jp":false,
"tsuwano.shimane.jp":false,
"unnan.shimane.jp":false,
"yakumo.shimane.jp":false,
"yasugi.shimane.jp":false,
"yatsuka.shimane.jp":false,
"arai.shizuoka.jp":false,
"atami.shizuoka.jp":false,
"fuji.shizuoka.jp":false,
"fujieda.shizuoka.jp":false,
"fujikawa.shizuoka.jp":false,
"fujinomiya.shizuoka.jp":false,
"fukuroi.shizuoka.jp":false,
"gotemba.shizuoka.jp":false,
"haibara.shizuoka.jp":false,
"hamamatsu.shizuoka.jp":false,
"higashiizu.shizuoka.jp":false,
"ito.shizuoka.jp":false,
"iwata.shizuoka.jp":false,
"izu.shizuoka.jp":false,
"izunokuni.shizuoka.jp":false,
"kakegawa.shizuoka.jp":false,
"kannami.shizuoka.jp":false,
"kawanehon.shizuoka.jp":false,
"kawazu.shizuoka.jp":false,
"kikugawa.shizuoka.jp":false,
"kosai.shizuoka.jp":false,
"makinohara.shizuoka.jp":false,
"matsuzaki.shizuoka.jp":false,
"minamiizu.shizuoka.jp":false,
"mishima.shizuoka.jp":false,
"morimachi.shizuoka.jp":false,
"nishiizu.shizuoka.jp":false,
"numazu.shizuoka.jp":false,
"omaezaki.shizuoka.jp":false,
"shimada.shizuoka.jp":false,
"shimizu.shizuoka.jp":false,
"shimoda.shizuoka.jp":false,
"shizuoka.shizuoka.jp":false,
"susono.shizuoka.jp":false,
"yaizu.shizuoka.jp":false,
"yoshida.shizuoka.jp":false,
"ashikaga.tochigi.jp":false,
"bato.tochigi.jp":false,
"haga.tochigi.jp":false,
"ichikai.tochigi.jp":false,
"iwafune.tochigi.jp":false,
"kaminokawa.tochigi.jp":false,
"kanuma.tochigi.jp":false,
"karasuyama.tochigi.jp":false,
"kuroiso.tochigi.jp":false,
"mashiko.tochigi.jp":false,
"mibu.tochigi.jp":false,
"moka.tochigi.jp":false,
"motegi.tochigi.jp":false,
"nasu.tochigi.jp":false,
"nasushiobara.tochigi.jp":false,
"nikko.tochigi.jp":false,
"nishikata.tochigi.jp":false,
"nogi.tochigi.jp":false,
"ohira.tochigi.jp":false,
"ohtawara.tochigi.jp":false,
"oyama.tochigi.jp":false,
"sakura.tochigi.jp":false,
"sano.tochigi.jp":false,
"shimotsuke.tochigi.jp":false,
"shioya.tochigi.jp":false,
"takanezawa.tochigi.jp":false,
"tochigi.tochigi.jp":false,
"tsuga.tochigi.jp":false,
"ujiie.tochigi.jp":false,
"utsunomiya.tochigi.jp":false,
"yaita.tochigi.jp":false,
"aizumi.tokushima.jp":false,
"anan.tokushima.jp":false,
"ichiba.tokushima.jp":false,
"itano.tokushima.jp":false,
"kainan.tokushima.jp":false,
"komatsushima.tokushima.jp":false,
"matsushige.tokushima.jp":false,
"mima.tokushima.jp":false,
"minami.tokushima.jp":false,
"miyoshi.tokushima.jp":false,
"mugi.tokushima.jp":false,
"nakagawa.tokushima.jp":false,
"naruto.tokushima.jp":false,
"sanagochi.tokushima.jp":false,
"shishikui.tokushima.jp":false,
"tokushima.tokushima.jp":false,
"wajiki.tokushima.jp":false,
"adachi.tokyo.jp":false,
"akiruno.tokyo.jp":false,
"akishima.tokyo.jp":false,
"aogashima.tokyo.jp":false,
"arakawa.tokyo.jp":false,
"bunkyo.tokyo.jp":false,
"chiyoda.tokyo.jp":false,
"chofu.tokyo.jp":false,
"chuo.tokyo.jp":false,
"edogawa.tokyo.jp":false,
"fuchu.tokyo.jp":false,
"fussa.tokyo.jp":false,
"hachijo.tokyo.jp":false,
"hachioji.tokyo.jp":false,
"hamura.tokyo.jp":false,
"higashikurume.tokyo.jp":false,
"higashimurayama.tokyo.jp":false,
"higashiyamato.tokyo.jp":false,
"hino.tokyo.jp":false,
"hinode.tokyo.jp":false,
"hinohara.tokyo.jp":false,
"inagi.tokyo.jp":false,
"itabashi.tokyo.jp":false,
"katsushika.tokyo.jp":false,
"kita.tokyo.jp":false,
"kiyose.tokyo.jp":false,
"kodaira.tokyo.jp":false,
"koganei.tokyo.jp":false,
"kokubunji.tokyo.jp":false,
"komae.tokyo.jp":false,
"koto.tokyo.jp":false,
"kouzushima.tokyo.jp":false,
"kunitachi.tokyo.jp":false,
"machida.tokyo.jp":false,
"meguro.tokyo.jp":false,
"minato.tokyo.jp":false,
"mitaka.tokyo.jp":false,
"mizuho.tokyo.jp":false,
"musashimurayama.tokyo.jp":false,
"musashino.tokyo.jp":false,
"nakano.tokyo.jp":false,
"nerima.tokyo.jp":false,
"ogasawara.tokyo.jp":false,
"okutama.tokyo.jp":false,
"ome.tokyo.jp":false,
"oshima.tokyo.jp":false,
"ota.tokyo.jp":false,
"setagaya.tokyo.jp":false,
"shibuya.tokyo.jp":false,
"shinagawa.tokyo.jp":false,
"shinjuku.tokyo.jp":false,
"suginami.tokyo.jp":false,
"sumida.tokyo.jp":false,
"tachikawa.tokyo.jp":false,
"taito.tokyo.jp":false,
"tama.tokyo.jp":false,
"toshima.tokyo.jp":false,
"chizu.tottori.jp":false,
"hino.tottori.jp":false,
"kawahara.tottori.jp":false,
"koge.tottori.jp":false,
"kotoura.tottori.jp":false,
"misasa.tottori.jp":false,
"nanbu.tottori.jp":false,
"nichinan.tottori.jp":false,
"sakaiminato.tottori.jp":false,
"tottori.tottori.jp":false,
"wakasa.tottori.jp":false,
"yazu.tottori.jp":false,
"yonago.tottori.jp":false,
"asahi.toyama.jp":false,
"fuchu.toyama.jp":false,
"fukumitsu.toyama.jp":false,
"funahashi.toyama.jp":false,
"himi.toyama.jp":false,
"imizu.toyama.jp":false,
"inami.toyama.jp":false,
"johana.toyama.jp":false,
"kamiichi.toyama.jp":false,
"kurobe.toyama.jp":false,
"nakaniikawa.toyama.jp":false,
"namerikawa.toyama.jp":false,
"nanto.toyama.jp":false,
"nyuzen.toyama.jp":false,
"oyabe.toyama.jp":false,
"taira.toyama.jp":false,
"takaoka.toyama.jp":false,
"tateyama.toyama.jp":false,
"toga.toyama.jp":false,
"tonami.toyama.jp":false,
"toyama.toyama.jp":false,
"unazuki.toyama.jp":false,
"uozu.toyama.jp":false,
"yamada.toyama.jp":false,
"arida.wakayama.jp":false,
"aridagawa.wakayama.jp":false,
"gobo.wakayama.jp":false,
"hashimoto.wakayama.jp":false,
"hidaka.wakayama.jp":false,
"hirogawa.wakayama.jp":false,
"inami.wakayama.jp":false,
"iwade.wakayama.jp":false,
"kainan.wakayama.jp":false,
"kamitonda.wakayama.jp":false,
"katsuragi.wakayama.jp":false,
"kimino.wakayama.jp":false,
"kinokawa.wakayama.jp":false,
"kitayama.wakayama.jp":false,
"koya.wakayama.jp":false,
"koza.wakayama.jp":false,
"kozagawa.wakayama.jp":false,
"kudoyama.wakayama.jp":false,
"kushimoto.wakayama.jp":false,
"mihama.wakayama.jp":false,
"misato.wakayama.jp":false,
"nachikatsuura.wakayama.jp":false,
"shingu.wakayama.jp":false,
"shirahama.wakayama.jp":false,
"taiji.wakayama.jp":false,
"tanabe.wakayama.jp":false,
"wakayama.wakayama.jp":false,
"yuasa.wakayama.jp":false,
"yura.wakayama.jp":false,
"asahi.yamagata.jp":false,
"funagata.yamagata.jp":false,
"higashine.yamagata.jp":false,
"iide.yamagata.jp":false,
"kahoku.yamagata.jp":false,
"kaminoyama.yamagata.jp":false,
"kaneyama.yamagata.jp":false,
"kawanishi.yamagata.jp":false,
"mamurogawa.yamagata.jp":false,
"mikawa.yamagata.jp":false,
"murayama.yamagata.jp":false,
"nagai.yamagata.jp":false,
"nakayama.yamagata.jp":false,
"nanyo.yamagata.jp":false,
"nishikawa.yamagata.jp":false,
"obanazawa.yamagata.jp":false,
"oe.yamagata.jp":false,
"oguni.yamagata.jp":false,
"ohkura.yamagata.jp":false,
"oishida.yamagata.jp":false,
"sagae.yamagata.jp":false,
"sakata.yamagata.jp":false,
"sakegawa.yamagata.jp":false,
"shinjo.yamagata.jp":false,
"shirataka.yamagata.jp":false,
"shonai.yamagata.jp":false,
"takahata.yamagata.jp":false,
"tendo.yamagata.jp":false,
"tozawa.yamagata.jp":false,
"tsuruoka.yamagata.jp":false,
"yamagata.yamagata.jp":false,
"yamanobe.yamagata.jp":false,
"yonezawa.yamagata.jp":false,
"yuza.yamagata.jp":false,
"abu.yamaguchi.jp":false,
"hagi.yamaguchi.jp":false,
"hikari.yamaguchi.jp":false,
"hofu.yamaguchi.jp":false,
"iwakuni.yamaguchi.jp":false,
"kudamatsu.yamaguchi.jp":false,
"mitou.yamaguchi.jp":false,
"nagato.yamaguchi.jp":false,
"oshima.yamaguchi.jp":false,
"shimonoseki.yamaguchi.jp":false,
"shunan.yamaguchi.jp":false,
"tabuse.yamaguchi.jp":false,
"tokuyama.yamaguchi.jp":false,
"toyota.yamaguchi.jp":false,
"ube.yamaguchi.jp":false,
"yuu.yamaguchi.jp":false,
"chuo.yamanashi.jp":false,
"doshi.yamanashi.jp":false,
"fuefuki.yamanashi.jp":false,
"fujikawa.yamanashi.jp":false,
"fujikawaguchiko.yamanashi.jp":false,
"fujiyoshida.yamanashi.jp":false,
"hayakawa.yamanashi.jp":false,
"hokuto.yamanashi.jp":false,
"ichikawamisato.yamanashi.jp":false,
"kai.yamanashi.jp":false,
"kofu.yamanashi.jp":false,
"koshu.yamanashi.jp":false,
"kosuge.yamanashi.jp":false,
"minami-alps.yamanashi.jp":false,
"minobu.yamanashi.jp":false,
"nakamichi.yamanashi.jp":false,
"nanbu.yamanashi.jp":false,
"narusawa.yamanashi.jp":false,
"nirasaki.yamanashi.jp":false,
"nishikatsura.yamanashi.jp":false,
"oshino.yamanashi.jp":false,
"otsuki.yamanashi.jp":false,
"showa.yamanashi.jp":false,
"tabayama.yamanashi.jp":false,
"tsuru.yamanashi.jp":false,
"uenohara.yamanashi.jp":false,
"yamanakako.yamanashi.jp":false,
"yamanashi.yamanashi.jp":false,
"ke":false,
"ac.ke":false,
"co.ke":false,
"go.ke":false,
"info.ke":false,
"me.ke":false,
"mobi.ke":false,
"ne.ke":false,
"or.ke":false,
"sc.ke":false,
"kg":false,
"org.kg":false,
"net.kg":false,
"com.kg":false,
"edu.kg":false,
"gov.kg":false,
"mil.kg":false,
"ki":false,
"edu.ki":false,
"biz.ki":false,
"net.ki":false,
"org.ki":false,
"gov.ki":false,
"info.ki":false,
"com.ki":false,
"km":false,
"org.km":false,
"nom.km":false,
"gov.km":false,
"prd.km":false,
"tm.km":false,
"edu.km":false,
"mil.km":false,
"ass.km":false,
"com.km":false,
"coop.km":false,
"asso.km":false,
"presse.km":false,
"medecin.km":false,
"notaires.km":false,
"pharmaciens.km":false,
"veterinaire.km":false,
"gouv.km":false,
"kn":false,
"net.kn":false,
"org.kn":false,
"edu.kn":false,
"gov.kn":false,
"kp":false,
"com.kp":false,
"edu.kp":false,
"gov.kp":false,
"org.kp":false,
"rep.kp":false,
"tra.kp":false,
"kr":false,
"ac.kr":false,
"co.kr":false,
"es.kr":false,
"go.kr":false,
"hs.kr":false,
"kg.kr":false,
"mil.kr":false,
"ms.kr":false,
"ne.kr":false,
"or.kr":false,
"pe.kr":false,
"re.kr":false,
"sc.kr":false,
"busan.kr":false,
"chungbuk.kr":false,
"chungnam.kr":false,
"daegu.kr":false,
"daejeon.kr":false,
"gangwon.kr":false,
"gwangju.kr":false,
"gyeongbuk.kr":false,
"gyeonggi.kr":false,
"gyeongnam.kr":false,
"incheon.kr":false,
"jeju.kr":false,
"jeonbuk.kr":false,
"jeonnam.kr":false,
"seoul.kr":false,
"ulsan.kr":false,
"kw":false,
"com.kw":false,
"edu.kw":false,
"emb.kw":false,
"gov.kw":false,
"ind.kw":false,
"net.kw":false,
"org.kw":false,
"ky":false,
"edu.ky":false,
"gov.ky":false,
"com.ky":false,
"org.ky":false,
"net.ky":false,
"kz":false,
"org.kz":false,
"edu.kz":false,
"net.kz":false,
"gov.kz":false,
"mil.kz":false,
"com.kz":false,
"la":false,
"int.la":false,
"net.la":false,
"info.la":false,
"edu.la":false,
"gov.la":false,
"per.la":false,
"com.la":false,
"org.la":false,
"lb":false,
"com.lb":false,
"edu.lb":false,
"gov.lb":false,
"net.lb":false,
"org.lb":false,
"lc":false,
"com.lc":false,
"net.lc":false,
"co.lc":false,
"org.lc":false,
"edu.lc":false,
"gov.lc":false,
"li":false,
"lk":false,
"gov.lk":false,
"sch.lk":false,
"net.lk":false,
"int.lk":false,
"com.lk":false,
"org.lk":false,
"edu.lk":false,
"ngo.lk":false,
"soc.lk":false,
"web.lk":false,
"ltd.lk":false,
"assn.lk":false,
"grp.lk":false,
"hotel.lk":false,
"ac.lk":false,
"lr":false,
"com.lr":false,
"edu.lr":false,
"gov.lr":false,
"org.lr":false,
"net.lr":false,
"ls":false,
"co.ls":false,
"org.ls":false,
"lt":false,
"gov.lt":false,
"lu":false,
"lv":false,
"com.lv":false,
"edu.lv":false,
"gov.lv":false,
"org.lv":false,
"mil.lv":false,
"id.lv":false,
"net.lv":false,
"asn.lv":false,
"conf.lv":false,
"ly":false,
"com.ly":false,
"net.ly":false,
"gov.ly":false,
"plc.ly":false,
"edu.ly":false,
"sch.ly":false,
"med.ly":false,
"org.ly":false,
"id.ly":false,
"ma":false,
"co.ma":false,
"net.ma":false,
"gov.ma":false,
"org.ma":false,
"ac.ma":false,
"press.ma":false,
"mc":false,
"tm.mc":false,
"asso.mc":false,
"md":false,
"me":false,
"co.me":false,
"net.me":false,
"org.me":false,
"edu.me":false,
"ac.me":false,
"gov.me":false,
"its.me":false,
"priv.me":false,
"mg":false,
"org.mg":false,
"nom.mg":false,
"gov.mg":false,
"prd.mg":false,
"tm.mg":false,
"edu.mg":false,
"mil.mg":false,
"com.mg":false,
"co.mg":false,
"mh":false,
"mil":false,
"mk":false,
"com.mk":false,
"org.mk":false,
"net.mk":false,
"edu.mk":false,
"gov.mk":false,
"inf.mk":false,
"name.mk":false,
"ml":false,
"com.ml":false,
"edu.ml":false,
"gouv.ml":false,
"gov.ml":false,
"net.ml":false,
"org.ml":false,
"presse.ml":false,
"mn":false,
"gov.mn":false,
"edu.mn":false,
"org.mn":false,
"mo":false,
"com.mo":false,
"net.mo":false,
"org.mo":false,
"edu.mo":false,
"gov.mo":false,
"mobi":false,
"mp":false,
"mq":false,
"mr":false,
"gov.mr":false,
"ms":false,
"com.ms":false,
"edu.ms":false,
"gov.ms":false,
"net.ms":false,
"org.ms":false,
"mt":false,
"com.mt":false,
"edu.mt":false,
"net.mt":false,
"org.mt":false,
"mu":false,
"com.mu":false,
"net.mu":false,
"org.mu":false,
"gov.mu":false,
"ac.mu":false,
"co.mu":false,
"or.mu":false,
"museum":false,
"academy.museum":false,
"agriculture.museum":false,
"air.museum":false,
"airguard.museum":false,
"alabama.museum":false,
"alaska.museum":false,
"amber.museum":false,
"ambulance.museum":false,
"american.museum":false,
"americana.museum":false,
"americanantiques.museum":false,
"americanart.museum":false,
"amsterdam.museum":false,
"and.museum":false,
"annefrank.museum":false,
"anthro.museum":false,
"anthropology.museum":false,
"antiques.museum":false,
"aquarium.museum":false,
"arboretum.museum":false,
"archaeological.museum":false,
"archaeology.museum":false,
"architecture.museum":false,
"art.museum":false,
"artanddesign.museum":false,
"artcenter.museum":false,
"artdeco.museum":false,
"arteducation.museum":false,
"artgallery.museum":false,
"arts.museum":false,
"artsandcrafts.museum":false,
"asmatart.museum":false,
"assassination.museum":false,
"assisi.museum":false,
"association.museum":false,
"astronomy.museum":false,
"atlanta.museum":false,
"austin.museum":false,
"australia.museum":false,
"automotive.museum":false,
"aviation.museum":false,
"axis.museum":false,
"badajoz.museum":false,
"baghdad.museum":false,
"bahn.museum":false,
"bale.museum":false,
"baltimore.museum":false,
"barcelona.museum":false,
"baseball.museum":false,
"basel.museum":false,
"baths.museum":false,
"bauern.museum":false,
"beauxarts.museum":false,
"beeldengeluid.museum":false,
"bellevue.museum":false,
"bergbau.museum":false,
"berkeley.museum":false,
"berlin.museum":false,
"bern.museum":false,
"bible.museum":false,
"bilbao.museum":false,
"bill.museum":false,
"birdart.museum":false,
"birthplace.museum":false,
"bonn.museum":false,
"boston.museum":false,
"botanical.museum":false,
"botanicalgarden.museum":false,
"botanicgarden.museum":false,
"botany.museum":false,
"brandywinevalley.museum":false,
"brasil.museum":false,
"bristol.museum":false,
"british.museum":false,
"britishcolumbia.museum":false,
"broadcast.museum":false,
"brunel.museum":false,
"brussel.museum":false,
"brussels.museum":false,
"bruxelles.museum":false,
"building.museum":false,
"burghof.museum":false,
"bus.museum":false,
"bushey.museum":false,
"cadaques.museum":false,
"california.museum":false,
"cambridge.museum":false,
"can.museum":false,
"canada.museum":false,
"capebreton.museum":false,
"carrier.museum":false,
"cartoonart.museum":false,
"casadelamoneda.museum":false,
"castle.museum":false,
"castres.museum":false,
"celtic.museum":false,
"center.museum":false,
"chattanooga.museum":false,
"cheltenham.museum":false,
"chesapeakebay.museum":false,
"chicago.museum":false,
"children.museum":false,
"childrens.museum":false,
"childrensgarden.museum":false,
"chiropractic.museum":false,
"chocolate.museum":false,
"christiansburg.museum":false,
"cincinnati.museum":false,
"cinema.museum":false,
"circus.museum":false,
"civilisation.museum":false,
"civilization.museum":false,
"civilwar.museum":false,
"clinton.museum":false,
"clock.museum":false,
"coal.museum":false,
"coastaldefence.museum":false,
"cody.museum":false,
"coldwar.museum":false,
"collection.museum":false,
"colonialwilliamsburg.museum":false,
"coloradoplateau.museum":false,
"columbia.museum":false,
"columbus.museum":false,
"communication.museum":false,
"communications.museum":false,
"community.museum":false,
"computer.museum":false,
"computerhistory.museum":false,
"comunicações.museum":false,
"contemporary.museum":false,
"contemporaryart.museum":false,
"convent.museum":false,
"copenhagen.museum":false,
"corporation.museum":false,
"correios-e-telecomunicações.museum":false,
"corvette.museum":false,
"costume.museum":false,
"countryestate.museum":false,
"county.museum":false,
"crafts.museum":false,
"cranbrook.museum":false,
"creation.museum":false,
"cultural.museum":false,
"culturalcenter.museum":false,
"culture.museum":false,
"cyber.museum":false,
"cymru.museum":false,
"dali.museum":false,
"dallas.museum":false,
"database.museum":false,
"ddr.museum":false,
"decorativearts.museum":false,
"delaware.museum":false,
"delmenhorst.museum":false,
"denmark.museum":false,
"depot.museum":false,
"design.museum":false,
"detroit.museum":false,
"dinosaur.museum":false,
"discovery.museum":false,
"dolls.museum":false,
"donostia.museum":false,
"durham.museum":false,
"eastafrica.museum":false,
"eastcoast.museum":false,
"education.museum":false,
"educational.museum":false,
"egyptian.museum":false,
"eisenbahn.museum":false,
"elburg.museum":false,
"elvendrell.museum":false,
"embroidery.museum":false,
"encyclopedic.museum":false,
"england.museum":false,
"entomology.museum":false,
"environment.museum":false,
"environmentalconservation.museum":false,
"epilepsy.museum":false,
"essex.museum":false,
"estate.museum":false,
"ethnology.museum":false,
"exeter.museum":false,
"exhibition.museum":false,
"family.museum":false,
"farm.museum":false,
"farmequipment.museum":false,
"farmers.museum":false,
"farmstead.museum":false,
"field.museum":false,
"figueres.museum":false,
"filatelia.museum":false,
"film.museum":false,
"fineart.museum":false,
"finearts.museum":false,
"finland.museum":false,
"flanders.museum":false,
"florida.museum":false,
"force.museum":false,
"fortmissoula.museum":false,
"fortworth.museum":false,
"foundation.museum":false,
"francaise.museum":false,
"frankfurt.museum":false,
"franziskaner.museum":false,
"freemasonry.museum":false,
"freiburg.museum":false,
"fribourg.museum":false,
"frog.museum":false,
"fundacio.museum":false,
"furniture.museum":false,
"gallery.museum":false,
"garden.museum":false,
"gateway.museum":false,
"geelvinck.museum":false,
"gemological.museum":false,
"geology.museum":false,
"georgia.museum":false,
"giessen.museum":false,
"glas.museum":false,
"glass.museum":false,
"gorge.museum":false,
"grandrapids.museum":false,
"graz.museum":false,
"guernsey.museum":false,
"halloffame.museum":false,
"hamburg.museum":false,
"handson.museum":false,
"harvestcelebration.museum":false,
"hawaii.museum":false,
"health.museum":false,
"heimatunduhren.museum":false,
"hellas.museum":false,
"helsinki.museum":false,
"hembygdsforbund.museum":false,
"heritage.museum":false,
"histoire.museum":false,
"historical.museum":false,
"historicalsociety.museum":false,
"historichouses.museum":false,
"historisch.museum":false,
"historisches.museum":false,
"history.museum":false,
"historyofscience.museum":false,
"horology.museum":false,
"house.museum":false,
"humanities.museum":false,
"illustration.museum":false,
"imageandsound.museum":false,
"indian.museum":false,
"indiana.museum":false,
"indianapolis.museum":false,
"indianmarket.museum":false,
"intelligence.museum":false,
"interactive.museum":false,
"iraq.museum":false,
"iron.museum":false,
"isleofman.museum":false,
"jamison.museum":false,
"jefferson.museum":false,
"jerusalem.museum":false,
"jewelry.museum":false,
"jewish.museum":false,
"jewishart.museum":false,
"jfk.museum":false,
"journalism.museum":false,
"judaica.museum":false,
"judygarland.museum":false,
"juedisches.museum":false,
"juif.museum":false,
"karate.museum":false,
"karikatur.museum":false,
"kids.museum":false,
"koebenhavn.museum":false,
"koeln.museum":false,
"kunst.museum":false,
"kunstsammlung.museum":false,
"kunstunddesign.museum":false,
"labor.museum":false,
"labour.museum":false,
"lajolla.museum":false,
"lancashire.museum":false,
"landes.museum":false,
"lans.museum":false,
"läns.museum":false,
"larsson.museum":false,
"lewismiller.museum":false,
"lincoln.museum":false,
"linz.museum":false,
"living.museum":false,
"livinghistory.museum":false,
"localhistory.museum":false,
"london.museum":false,
"losangeles.museum":false,
"louvre.museum":false,
"loyalist.museum":false,
"lucerne.museum":false,
"luxembourg.museum":false,
"luzern.museum":false,
"mad.museum":false,
"madrid.museum":false,
"mallorca.museum":false,
"manchester.museum":false,
"mansion.museum":false,
"mansions.museum":false,
"manx.museum":false,
"marburg.museum":false,
"maritime.museum":false,
"maritimo.museum":false,
"maryland.museum":false,
"marylhurst.museum":false,
"media.museum":false,
"medical.museum":false,
"medizinhistorisches.museum":false,
"meeres.museum":false,
"memorial.museum":false,
"mesaverde.museum":false,
"michigan.museum":false,
"midatlantic.museum":false,
"military.museum":false,
"mill.museum":false,
"miners.museum":false,
"mining.museum":false,
"minnesota.museum":false,
"missile.museum":false,
"missoula.museum":false,
"modern.museum":false,
"moma.museum":false,
"money.museum":false,
"monmouth.museum":false,
"monticello.museum":false,
"montreal.museum":false,
"moscow.museum":false,
"motorcycle.museum":false,
"muenchen.museum":false,
"muenster.museum":false,
"mulhouse.museum":false,
"muncie.museum":false,
"museet.museum":false,
"museumcenter.museum":false,
"museumvereniging.museum":false,
"music.museum":false,
"national.museum":false,
"nationalfirearms.museum":false,
"nationalheritage.museum":false,
"nativeamerican.museum":false,
"naturalhistory.museum":false,
"naturalhistorymuseum.museum":false,
"naturalsciences.museum":false,
"nature.museum":false,
"naturhistorisches.museum":false,
"natuurwetenschappen.museum":false,
"naumburg.museum":false,
"naval.museum":false,
"nebraska.museum":false,
"neues.museum":false,
"newhampshire.museum":false,
"newjersey.museum":false,
"newmexico.museum":false,
"newport.museum":false,
"newspaper.museum":false,
"newyork.museum":false,
"niepce.museum":false,
"norfolk.museum":false,
"north.museum":false,
"nrw.museum":false,
"nuernberg.museum":false,
"nuremberg.museum":false,
"nyc.museum":false,
"nyny.museum":false,
"oceanographic.museum":false,
"oceanographique.museum":false,
"omaha.museum":false,
"online.museum":false,
"ontario.museum":false,
"openair.museum":false,
"oregon.museum":false,
"oregontrail.museum":false,
"otago.museum":false,
"oxford.museum":false,
"pacific.museum":false,
"paderborn.museum":false,
"palace.museum":false,
"paleo.museum":false,
"palmsprings.museum":false,
"panama.museum":false,
"paris.museum":false,
"pasadena.museum":false,
"pharmacy.museum":false,
"philadelphia.museum":false,
"philadelphiaarea.museum":false,
"philately.museum":false,
"phoenix.museum":false,
"photography.museum":false,
"pilots.museum":false,
"pittsburgh.museum":false,
"planetarium.museum":false,
"plantation.museum":false,
"plants.museum":false,
"plaza.museum":false,
"portal.museum":false,
"portland.museum":false,
"portlligat.museum":false,
"posts-and-telecommunications.museum":false,
"preservation.museum":false,
"presidio.museum":false,
"press.museum":false,
"project.museum":false,
"public.museum":false,
"pubol.museum":false,
"quebec.museum":false,
"railroad.museum":false,
"railway.museum":false,
"research.museum":false,
"resistance.museum":false,
"riodejaneiro.museum":false,
"rochester.museum":false,
"rockart.museum":false,
"roma.museum":false,
"russia.museum":false,
"saintlouis.museum":false,
"salem.museum":false,
"salvadordali.museum":false,
"salzburg.museum":false,
"sandiego.museum":false,
"sanfrancisco.museum":false,
"santabarbara.museum":false,
"santacruz.museum":false,
"santafe.museum":false,
"saskatchewan.museum":false,
"satx.museum":false,
"savannahga.museum":false,
"schlesisches.museum":false,
"schoenbrunn.museum":false,
"schokoladen.museum":false,
"school.museum":false,
"schweiz.museum":false,
"science.museum":false,
"scienceandhistory.museum":false,
"scienceandindustry.museum":false,
"sciencecenter.museum":false,
"sciencecenters.museum":false,
"science-fiction.museum":false,
"sciencehistory.museum":false,
"sciences.museum":false,
"sciencesnaturelles.museum":false,
"scotland.museum":false,
"seaport.museum":false,
"settlement.museum":false,
"settlers.museum":false,
"shell.museum":false,
"sherbrooke.museum":false,
"sibenik.museum":false,
"silk.museum":false,
"ski.museum":false,
"skole.museum":false,
"society.museum":false,
"sologne.museum":false,
"soundandvision.museum":false,
"southcarolina.museum":false,
"southwest.museum":false,
"space.museum":false,
"spy.museum":false,
"square.museum":false,
"stadt.museum":false,
"stalbans.museum":false,
"starnberg.museum":false,
"state.museum":false,
"stateofdelaware.museum":false,
"station.museum":false,
"steam.museum":false,
"steiermark.museum":false,
"stjohn.museum":false,
"stockholm.museum":false,
"stpetersburg.museum":false,
"stuttgart.museum":false,
"suisse.museum":false,
"surgeonshall.museum":false,
"surrey.museum":false,
"svizzera.museum":false,
"sweden.museum":false,
"sydney.museum":false,
"tank.museum":false,
"tcm.museum":false,
"technology.museum":false,
"telekommunikation.museum":false,
"television.museum":false,
"texas.museum":false,
"textile.museum":false,
"theater.museum":false,
"time.museum":false,
"timekeeping.museum":false,
"topology.museum":false,
"torino.museum":false,
"touch.museum":false,
"town.museum":false,
"transport.museum":false,
"tree.museum":false,
"trolley.museum":false,
"trust.museum":false,
"trustee.museum":false,
"uhren.museum":false,
"ulm.museum":false,
"undersea.museum":false,
"university.museum":false,
"usa.museum":false,
"usantiques.museum":false,
"usarts.museum":false,
"uscountryestate.museum":false,
"usculture.museum":false,
"usdecorativearts.museum":false,
"usgarden.museum":false,
"ushistory.museum":false,
"ushuaia.museum":false,
"uslivinghistory.museum":false,
"utah.museum":false,
"uvic.museum":false,
"valley.museum":false,
"vantaa.museum":false,
"versailles.museum":false,
"viking.museum":false,
"village.museum":false,
"virginia.museum":false,
"virtual.museum":false,
"virtuel.museum":false,
"vlaanderen.museum":false,
"volkenkunde.museum":false,
"wales.museum":false,
"wallonie.museum":false,
"war.museum":false,
"washingtondc.museum":false,
"watchandclock.museum":false,
"watch-and-clock.museum":false,
"western.museum":false,
"westfalen.museum":false,
"whaling.museum":false,
"wildlife.museum":false,
"williamsburg.museum":false,
"windmill.museum":false,
"workshop.museum":false,
"york.museum":false,
"yorkshire.museum":false,
"yosemite.museum":false,
"youth.museum":false,
"zoological.museum":false,
"zoology.museum":false,
"ירושלים.museum":false,
"иком.museum":false,
"mv":false,
"aero.mv":false,
"biz.mv":false,
"com.mv":false,
"coop.mv":false,
"edu.mv":false,
"gov.mv":false,
"info.mv":false,
"int.mv":false,
"mil.mv":false,
"museum.mv":false,
"name.mv":false,
"net.mv":false,
"org.mv":false,
"pro.mv":false,
"mw":false,
"ac.mw":false,
"biz.mw":false,
"co.mw":false,
"com.mw":false,
"coop.mw":false,
"edu.mw":false,
"gov.mw":false,
"int.mw":false,
"museum.mw":false,
"net.mw":false,
"org.mw":false,
"mx":false,
"com.mx":false,
"org.mx":false,
"gob.mx":false,
"edu.mx":false,
"net.mx":false,
"my":false,
"com.my":false,
"net.my":false,
"org.my":false,
"gov.my":false,
"edu.my":false,
"mil.my":false,
"name.my":false,
"mz":false,
"ac.mz":false,
"adv.mz":false,
"co.mz":false,
"edu.mz":false,
"gov.mz":false,
"mil.mz":false,
"net.mz":false,
"org.mz":false,
"na":false,
"info.na":false,
"pro.na":false,
"name.na":false,
"school.na":false,
"or.na":false,
"dr.na":false,
"us.na":false,
"mx.na":false,
"ca.na":false,
"in.na":false,
"cc.na":false,
"tv.na":false,
"ws.na":false,
"mobi.na":false,
"co.na":false,
"com.na":false,
"org.na":false,
"name":false,
"nc":false,
"asso.nc":false,
"nom.nc":false,
"ne":false,
"net":false,
"nf":false,
"com.nf":false,
"net.nf":false,
"per.nf":false,
"rec.nf":false,
"web.nf":false,
"arts.nf":false,
"firm.nf":false,
"info.nf":false,
"other.nf":false,
"store.nf":false,
"ng":false,
"com.ng":false,
"edu.ng":false,
"gov.ng":false,
"i.ng":false,
"mil.ng":false,
"mobi.ng":false,
"name.ng":false,
"net.ng":false,
"org.ng":false,
"sch.ng":false,
"ni":false,
"ac.ni":false,
"biz.ni":false,
"co.ni":false,
"com.ni":false,
"edu.ni":false,
"gob.ni":false,
"in.ni":false,
"info.ni":false,
"int.ni":false,
"mil.ni":false,
"net.ni":false,
"nom.ni":false,
"org.ni":false,
"web.ni":false,
"nl":false,
"bv.nl":false,
"no":false,
"fhs.no":false,
"vgs.no":false,
"fylkesbibl.no":false,
"folkebibl.no":false,
"museum.no":false,
"idrett.no":false,
"priv.no":false,
"mil.no":false,
"stat.no":false,
"dep.no":false,
"kommune.no":false,
"herad.no":false,
"aa.no":false,
"ah.no":false,
"bu.no":false,
"fm.no":false,
"hl.no":false,
"hm.no":false,
"jan-mayen.no":false,
"mr.no":false,
"nl.no":false,
"nt.no":false,
"of.no":false,
"ol.no":false,
"oslo.no":false,
"rl.no":false,
"sf.no":false,
"st.no":false,
"svalbard.no":false,
"tm.no":false,
"tr.no":false,
"va.no":false,
"vf.no":false,
"gs.aa.no":false,
"gs.ah.no":false,
"gs.bu.no":false,
"gs.fm.no":false,
"gs.hl.no":false,
"gs.hm.no":false,
"gs.jan-mayen.no":false,
"gs.mr.no":false,
"gs.nl.no":false,
"gs.nt.no":false,
"gs.of.no":false,
"gs.ol.no":false,
"gs.oslo.no":false,
"gs.rl.no":false,
"gs.sf.no":false,
"gs.st.no":false,
"gs.svalbard.no":false,
"gs.tm.no":false,
"gs.tr.no":false,
"gs.va.no":false,
"gs.vf.no":false,
"akrehamn.no":false,
"åkrehamn.no":false,
"algard.no":false,
"ålgård.no":false,
"arna.no":false,
"brumunddal.no":false,
"bryne.no":false,
"bronnoysund.no":false,
"brønnøysund.no":false,
"drobak.no":false,
"drøbak.no":false,
"egersund.no":false,
"fetsund.no":false,
"floro.no":false,
"florø.no":false,
"fredrikstad.no":false,
"hokksund.no":false,
"honefoss.no":false,
"hønefoss.no":false,
"jessheim.no":false,
"jorpeland.no":false,
"jørpeland.no":false,
"kirkenes.no":false,
"kopervik.no":false,
"krokstadelva.no":false,
"langevag.no":false,
"langevåg.no":false,
"leirvik.no":false,
"mjondalen.no":false,
"mjøndalen.no":false,
"mo-i-rana.no":false,
"mosjoen.no":false,
"mosjøen.no":false,
"nesoddtangen.no":false,
"orkanger.no":false,
"osoyro.no":false,
"osøyro.no":false,
"raholt.no":false,
"råholt.no":false,
"sandnessjoen.no":false,
"sandnessjøen.no":false,
"skedsmokorset.no":false,
"slattum.no":false,
"spjelkavik.no":false,
"stathelle.no":false,
"stavern.no":false,
"stjordalshalsen.no":false,
"stjørdalshalsen.no":false,
"tananger.no":false,
"tranby.no":false,
"vossevangen.no":false,
"afjord.no":false,
"åfjord.no":false,
"agdenes.no":false,
"al.no":false,
"ål.no":false,
"alesund.no":false,
"ålesund.no":false,
"alstahaug.no":false,
"alta.no":false,
"áltá.no":false,
"alaheadju.no":false,
"álaheadju.no":false,
"alvdal.no":false,
"amli.no":false,
"åmli.no":false,
"amot.no":false,
"åmot.no":false,
"andebu.no":false,
"andoy.no":false,
"andøy.no":false,
"andasuolo.no":false,
"ardal.no":false,
"årdal.no":false,
"aremark.no":false,
"arendal.no":false,
"ås.no":false,
"aseral.no":false,
"åseral.no":false,
"asker.no":false,
"askim.no":false,
"askvoll.no":false,
"askoy.no":false,
"askøy.no":false,
"asnes.no":false,
"åsnes.no":false,
"audnedaln.no":false,
"aukra.no":false,
"aure.no":false,
"aurland.no":false,
"aurskog-holand.no":false,
"aurskog-høland.no":false,
"austevoll.no":false,
"austrheim.no":false,
"averoy.no":false,
"averøy.no":false,
"balestrand.no":false,
"ballangen.no":false,
"balat.no":false,
"bálát.no":false,
"balsfjord.no":false,
"bahccavuotna.no":false,
"báhccavuotna.no":false,
"bamble.no":false,
"bardu.no":false,
"beardu.no":false,
"beiarn.no":false,
"bajddar.no":false,
"bájddar.no":false,
"baidar.no":false,
"báidár.no":false,
"berg.no":false,
"bergen.no":false,
"berlevag.no":false,
"berlevåg.no":false,
"bearalvahki.no":false,
"bearalváhki.no":false,
"bindal.no":false,
"birkenes.no":false,
"bjarkoy.no":false,
"bjarkøy.no":false,
"bjerkreim.no":false,
"bjugn.no":false,
"bodo.no":false,
"bodø.no":false,
"badaddja.no":false,
"bådåddjå.no":false,
"budejju.no":false,
"bokn.no":false,
"bremanger.no":false,
"bronnoy.no":false,
"brønnøy.no":false,
"bygland.no":false,
"bykle.no":false,
"barum.no":false,
"bærum.no":false,
"bo.telemark.no":false,
"bø.telemark.no":false,
"bo.nordland.no":false,
"bø.nordland.no":false,
"bievat.no":false,
"bievát.no":false,
"bomlo.no":false,
"bømlo.no":false,
"batsfjord.no":false,
"båtsfjord.no":false,
"bahcavuotna.no":false,
"báhcavuotna.no":false,
"dovre.no":false,
"drammen.no":false,
"drangedal.no":false,
"dyroy.no":false,
"dyrøy.no":false,
"donna.no":false,
"dønna.no":false,
"eid.no":false,
"eidfjord.no":false,
"eidsberg.no":false,
"eidskog.no":false,
"eidsvoll.no":false,
"eigersund.no":false,
"elverum.no":false,
"enebakk.no":false,
"engerdal.no":false,
"etne.no":false,
"etnedal.no":false,
"evenes.no":false,
"evenassi.no":false,
"evenášši.no":false,
"evje-og-hornnes.no":false,
"farsund.no":false,
"fauske.no":false,
"fuossko.no":false,
"fuoisku.no":false,
"fedje.no":false,
"fet.no":false,
"finnoy.no":false,
"finnøy.no":false,
"fitjar.no":false,
"fjaler.no":false,
"fjell.no":false,
"flakstad.no":false,
"flatanger.no":false,
"flekkefjord.no":false,
"flesberg.no":false,
"flora.no":false,
"fla.no":false,
"flå.no":false,
"folldal.no":false,
"forsand.no":false,
"fosnes.no":false,
"frei.no":false,
"frogn.no":false,
"froland.no":false,
"frosta.no":false,
"frana.no":false,
"fræna.no":false,
"froya.no":false,
"frøya.no":false,
"fusa.no":false,
"fyresdal.no":false,
"forde.no":false,
"førde.no":false,
"gamvik.no":false,
"gangaviika.no":false,
"gáŋgaviika.no":false,
"gaular.no":false,
"gausdal.no":false,
"gildeskal.no":false,
"gildeskål.no":false,
"giske.no":false,
"gjemnes.no":false,
"gjerdrum.no":false,
"gjerstad.no":false,
"gjesdal.no":false,
"gjovik.no":false,
"gjøvik.no":false,
"gloppen.no":false,
"gol.no":false,
"gran.no":false,
"grane.no":false,
"granvin.no":false,
"gratangen.no":false,
"grimstad.no":false,
"grong.no":false,
"kraanghke.no":false,
"kråanghke.no":false,
"grue.no":false,
"gulen.no":false,
"hadsel.no":false,
"halden.no":false,
"halsa.no":false,
"hamar.no":false,
"hamaroy.no":false,
"habmer.no":false,
"hábmer.no":false,
"hapmir.no":false,
"hápmir.no":false,
"hammerfest.no":false,
"hammarfeasta.no":false,
"hámmárfeasta.no":false,
"haram.no":false,
"hareid.no":false,
"harstad.no":false,
"hasvik.no":false,
"aknoluokta.no":false,
"ákŋoluokta.no":false,
"hattfjelldal.no":false,
"aarborte.no":false,
"haugesund.no":false,
"hemne.no":false,
"hemnes.no":false,
"hemsedal.no":false,
"heroy.more-og-romsdal.no":false,
"herøy.møre-og-romsdal.no":false,
"heroy.nordland.no":false,
"herøy.nordland.no":false,
"hitra.no":false,
"hjartdal.no":false,
"hjelmeland.no":false,
"hobol.no":false,
"hobøl.no":false,
"hof.no":false,
"hol.no":false,
"hole.no":false,
"holmestrand.no":false,
"holtalen.no":false,
"holtålen.no":false,
"hornindal.no":false,
"horten.no":false,
"hurdal.no":false,
"hurum.no":false,
"hvaler.no":false,
"hyllestad.no":false,
"hagebostad.no":false,
"hægebostad.no":false,
"hoyanger.no":false,
"høyanger.no":false,
"hoylandet.no":false,
"høylandet.no":false,
"ha.no":false,
"hå.no":false,
"ibestad.no":false,
"inderoy.no":false,
"inderøy.no":false,
"iveland.no":false,
"jevnaker.no":false,
"jondal.no":false,
"jolster.no":false,
"jølster.no":false,
"karasjok.no":false,
"karasjohka.no":false,
"kárášjohka.no":false,
"karlsoy.no":false,
"galsa.no":false,
"gálsá.no":false,
"karmoy.no":false,
"karmøy.no":false,
"kautokeino.no":false,
"guovdageaidnu.no":false,
"klepp.no":false,
"klabu.no":false,
"klæbu.no":false,
"kongsberg.no":false,
"kongsvinger.no":false,
"kragero.no":false,
"kragerø.no":false,
"kristiansand.no":false,
"kristiansund.no":false,
"krodsherad.no":false,
"krødsherad.no":false,
"kvalsund.no":false,
"rahkkeravju.no":false,
"ráhkkerávju.no":false,
"kvam.no":false,
"kvinesdal.no":false,
"kvinnherad.no":false,
"kviteseid.no":false,
"kvitsoy.no":false,
"kvitsøy.no":false,
"kvafjord.no":false,
"kvæfjord.no":false,
"giehtavuoatna.no":false,
"kvanangen.no":false,
"kvænangen.no":false,
"navuotna.no":false,
"návuotna.no":false,
"kafjord.no":false,
"kåfjord.no":false,
"gaivuotna.no":false,
"gáivuotna.no":false,
"larvik.no":false,
"lavangen.no":false,
"lavagis.no":false,
"loabat.no":false,
"loabát.no":false,
"lebesby.no":false,
"davvesiida.no":false,
"leikanger.no":false,
"leirfjord.no":false,
"leka.no":false,
"leksvik.no":false,
"lenvik.no":false,
"leangaviika.no":false,
"leaŋgaviika.no":false,
"lesja.no":false,
"levanger.no":false,
"lier.no":false,
"lierne.no":false,
"lillehammer.no":false,
"lillesand.no":false,
"lindesnes.no":false,
"lindas.no":false,
"lindås.no":false,
"lom.no":false,
"loppa.no":false,
"lahppi.no":false,
"láhppi.no":false,
"lund.no":false,
"lunner.no":false,
"luroy.no":false,
"lurøy.no":false,
"luster.no":false,
"lyngdal.no":false,
"lyngen.no":false,
"ivgu.no":false,
"lardal.no":false,
"lerdal.no":false,
"lærdal.no":false,
"lodingen.no":false,
"lødingen.no":false,
"lorenskog.no":false,
"lørenskog.no":false,
"loten.no":false,
"løten.no":false,
"malvik.no":false,
"masoy.no":false,
"måsøy.no":false,
"muosat.no":false,
"muosát.no":false,
"mandal.no":false,
"marker.no":false,
"marnardal.no":false,
"masfjorden.no":false,
"meland.no":false,
"meldal.no":false,
"melhus.no":false,
"meloy.no":false,
"meløy.no":false,
"meraker.no":false,
"meråker.no":false,
"moareke.no":false,
"moåreke.no":false,
"midsund.no":false,
"midtre-gauldal.no":false,
"modalen.no":false,
"modum.no":false,
"molde.no":false,
"moskenes.no":false,
"moss.no":false,
"mosvik.no":false,
"malselv.no":false,
"målselv.no":false,
"malatvuopmi.no":false,
"málatvuopmi.no":false,
"namdalseid.no":false,
"aejrie.no":false,
"namsos.no":false,
"namsskogan.no":false,
"naamesjevuemie.no":false,
"nååmesjevuemie.no":false,
"laakesvuemie.no":false,
"nannestad.no":false,
"narvik.no":false,
"narviika.no":false,
"naustdal.no":false,
"nedre-eiker.no":false,
"nes.akershus.no":false,
"nes.buskerud.no":false,
"nesna.no":false,
"nesodden.no":false,
"nesseby.no":false,
"unjarga.no":false,
"unjárga.no":false,
"nesset.no":false,
"nissedal.no":false,
"nittedal.no":false,
"nord-aurdal.no":false,
"nord-fron.no":false,
"nord-odal.no":false,
"norddal.no":false,
"nordkapp.no":false,
"davvenjarga.no":false,
"davvenjárga.no":false,
"nordre-land.no":false,
"nordreisa.no":false,
"raisa.no":false,
"ráisa.no":false,
"nore-og-uvdal.no":false,
"notodden.no":false,
"naroy.no":false,
"nærøy.no":false,
"notteroy.no":false,
"nøtterøy.no":false,
"odda.no":false,
"oksnes.no":false,
"øksnes.no":false,
"oppdal.no":false,
"oppegard.no":false,
"oppegård.no":false,
"orkdal.no":false,
"orland.no":false,
"ørland.no":false,
"orskog.no":false,
"ørskog.no":false,
"orsta.no":false,
"ørsta.no":false,
"os.hedmark.no":false,
"os.hordaland.no":false,
"osen.no":false,
"osteroy.no":false,
"osterøy.no":false,
"ostre-toten.no":false,
"østre-toten.no":false,
"overhalla.no":false,
"ovre-eiker.no":false,
"øvre-eiker.no":false,
"oyer.no":false,
"øyer.no":false,
"oygarden.no":false,
"øygarden.no":false,
"oystre-slidre.no":false,
"øystre-slidre.no":false,
"porsanger.no":false,
"porsangu.no":false,
"porsáŋgu.no":false,
"porsgrunn.no":false,
"radoy.no":false,
"radøy.no":false,
"rakkestad.no":false,
"rana.no":false,
"ruovat.no":false,
"randaberg.no":false,
"rauma.no":false,
"rendalen.no":false,
"rennebu.no":false,
"rennesoy.no":false,
"rennesøy.no":false,
"rindal.no":false,
"ringebu.no":false,
"ringerike.no":false,
"ringsaker.no":false,
"rissa.no":false,
"risor.no":false,
"risør.no":false,
"roan.no":false,
"rollag.no":false,
"rygge.no":false,
"ralingen.no":false,
"rælingen.no":false,
"rodoy.no":false,
"rødøy.no":false,
"romskog.no":false,
"rømskog.no":false,
"roros.no":false,
"røros.no":false,
"rost.no":false,
"røst.no":false,
"royken.no":false,
"røyken.no":false,
"royrvik.no":false,
"røyrvik.no":false,
"rade.no":false,
"råde.no":false,
"salangen.no":false,
"siellak.no":false,
"saltdal.no":false,
"salat.no":false,
"sálát.no":false,
"sálat.no":false,
"samnanger.no":false,
"sande.more-og-romsdal.no":false,
"sande.møre-og-romsdal.no":false,
"sande.vestfold.no":false,
"sandefjord.no":false,
"sandnes.no":false,
"sandoy.no":false,
"sandøy.no":false,
"sarpsborg.no":false,
"sauda.no":false,
"sauherad.no":false,
"sel.no":false,
"selbu.no":false,
"selje.no":false,
"seljord.no":false,
"sigdal.no":false,
"siljan.no":false,
"sirdal.no":false,
"skaun.no":false,
"skedsmo.no":false,
"ski.no":false,
"skien.no":false,
"skiptvet.no":false,
"skjervoy.no":false,
"skjervøy.no":false,
"skierva.no":false,
"skiervá.no":false,
"skjak.no":false,
"skjåk.no":false,
"skodje.no":false,
"skanland.no":false,
"skånland.no":false,
"skanit.no":false,
"skánit.no":false,
"smola.no":false,
"smøla.no":false,
"snillfjord.no":false,
"snasa.no":false,
"snåsa.no":false,
"snoasa.no":false,
"snaase.no":false,
"snåase.no":false,
"sogndal.no":false,
"sokndal.no":false,
"sola.no":false,
"solund.no":false,
"songdalen.no":false,
"sortland.no":false,
"spydeberg.no":false,
"stange.no":false,
"stavanger.no":false,
"steigen.no":false,
"steinkjer.no":false,
"stjordal.no":false,
"stjørdal.no":false,
"stokke.no":false,
"stor-elvdal.no":false,
"stord.no":false,
"stordal.no":false,
"storfjord.no":false,
"omasvuotna.no":false,
"strand.no":false,
"stranda.no":false,
"stryn.no":false,
"sula.no":false,
"suldal.no":false,
"sund.no":false,
"sunndal.no":false,
"surnadal.no":false,
"sveio.no":false,
"svelvik.no":false,
"sykkylven.no":false,
"sogne.no":false,
"søgne.no":false,
"somna.no":false,
"sømna.no":false,
"sondre-land.no":false,
"søndre-land.no":false,
"sor-aurdal.no":false,
"sør-aurdal.no":false,
"sor-fron.no":false,
"sør-fron.no":false,
"sor-odal.no":false,
"sør-odal.no":false,
"sor-varanger.no":false,
"sør-varanger.no":false,
"matta-varjjat.no":false,
"mátta-várjjat.no":false,
"sorfold.no":false,
"sørfold.no":false,
"sorreisa.no":false,
"sørreisa.no":false,
"sorum.no":false,
"sørum.no":false,
"tana.no":false,
"deatnu.no":false,
"time.no":false,
"tingvoll.no":false,
"tinn.no":false,
"tjeldsund.no":false,
"dielddanuorri.no":false,
"tjome.no":false,
"tjøme.no":false,
"tokke.no":false,
"tolga.no":false,
"torsken.no":false,
"tranoy.no":false,
"tranøy.no":false,
"tromso.no":false,
"tromsø.no":false,
"tromsa.no":false,
"romsa.no":false,
"trondheim.no":false,
"troandin.no":false,
"trysil.no":false,
"trana.no":false,
"træna.no":false,
"trogstad.no":false,
"trøgstad.no":false,
"tvedestrand.no":false,
"tydal.no":false,
"tynset.no":false,
"tysfjord.no":false,
"divtasvuodna.no":false,
"divttasvuotna.no":false,
"tysnes.no":false,
"tysvar.no":false,
"tysvær.no":false,
"tonsberg.no":false,
"tønsberg.no":false,
"ullensaker.no":false,
"ullensvang.no":false,
"ulvik.no":false,
"utsira.no":false,
"vadso.no":false,
"vadsø.no":false,
"cahcesuolo.no":false,
"čáhcesuolo.no":false,
"vaksdal.no":false,
"valle.no":false,
"vang.no":false,
"vanylven.no":false,
"vardo.no":false,
"vardø.no":false,
"varggat.no":false,
"várggát.no":false,
"vefsn.no":false,
"vaapste.no":false,
"vega.no":false,
"vegarshei.no":false,
"vegårshei.no":false,
"vennesla.no":false,
"verdal.no":false,
"verran.no":false,
"vestby.no":false,
"vestnes.no":false,
"vestre-slidre.no":false,
"vestre-toten.no":false,
"vestvagoy.no":false,
"vestvågøy.no":false,
"vevelstad.no":false,
"vik.no":false,
"vikna.no":false,
"vindafjord.no":false,
"volda.no":false,
"voss.no":false,
"varoy.no":false,
"værøy.no":false,
"vagan.no":false,
"vågan.no":false,
"voagat.no":false,
"vagsoy.no":false,
"vågsøy.no":false,
"vaga.no":false,
"vågå.no":false,
"valer.ostfold.no":false,
"våler.østfold.no":false,
"valer.hedmark.no":false,
"våler.hedmark.no":false,
"nr":false,
"biz.nr":false,
"info.nr":false,
"gov.nr":false,
"edu.nr":false,
"org.nr":false,
"net.nr":false,
"com.nr":false,
"nu":false,
"nz":false,
"ac.nz":false,
"co.nz":false,
"cri.nz":false,
"geek.nz":false,
"gen.nz":false,
"govt.nz":false,
"health.nz":false,
"iwi.nz":false,
"kiwi.nz":false,
"maori.nz":false,
"mil.nz":false,
"māori.nz":false,
"net.nz":false,
"org.nz":false,
"parliament.nz":false,
"school.nz":false,
"om":false,
"co.om":false,
"com.om":false,
"edu.om":false,
"gov.om":false,
"med.om":false,
"museum.om":false,
"net.om":false,
"org.om":false,
"pro.om":false,
"onion":false,
"org":false,
"pa":false,
"ac.pa":false,
"gob.pa":false,
"com.pa":false,
"org.pa":false,
"sld.pa":false,
"edu.pa":false,
"net.pa":false,
"ing.pa":false,
"abo.pa":false,
"med.pa":false,
"nom.pa":false,
"pe":false,
"edu.pe":false,
"gob.pe":false,
"nom.pe":false,
"mil.pe":false,
"org.pe":false,
"com.pe":false,
"net.pe":false,
"pf":false,
"com.pf":false,
"org.pf":false,
"edu.pf":false,
"ph":false,
"com.ph":false,
"net.ph":false,
"org.ph":false,
"gov.ph":false,
"edu.ph":false,
"ngo.ph":false,
"mil.ph":false,
"i.ph":false,
"pk":false,
"com.pk":false,
"net.pk":false,
"edu.pk":false,
"org.pk":false,
"fam.pk":false,
"biz.pk":false,
"web.pk":false,
"gov.pk":false,
"gob.pk":false,
"gok.pk":false,
"gon.pk":false,
"gop.pk":false,
"gos.pk":false,
"info.pk":false,
"pl":false,
"com.pl":false,
"net.pl":false,
"org.pl":false,
"aid.pl":false,
"agro.pl":false,
"atm.pl":false,
"auto.pl":false,
"biz.pl":false,
"edu.pl":false,
"gmina.pl":false,
"gsm.pl":false,
"info.pl":false,
"mail.pl":false,
"miasta.pl":false,
"media.pl":false,
"mil.pl":false,
"nieruchomosci.pl":false,
"nom.pl":false,
"pc.pl":false,
"powiat.pl":false,
"priv.pl":false,
"realestate.pl":false,
"rel.pl":false,
"sex.pl":false,
"shop.pl":false,
"sklep.pl":false,
"sos.pl":false,
"szkola.pl":false,
"targi.pl":false,
"tm.pl":false,
"tourism.pl":false,
"travel.pl":false,
"turystyka.pl":false,
"gov.pl":false,
"ap.gov.pl":false,
"ic.gov.pl":false,
"is.gov.pl":false,
"us.gov.pl":false,
"kmpsp.gov.pl":false,
"kppsp.gov.pl":false,
"kwpsp.gov.pl":false,
"psp.gov.pl":false,
"wskr.gov.pl":false,
"kwp.gov.pl":false,
"mw.gov.pl":false,
"ug.gov.pl":false,
"um.gov.pl":false,
"umig.gov.pl":false,
"ugim.gov.pl":false,
"upow.gov.pl":false,
"uw.gov.pl":false,
"starostwo.gov.pl":false,
"pa.gov.pl":false,
"po.gov.pl":false,
"psse.gov.pl":false,
"pup.gov.pl":false,
"rzgw.gov.pl":false,
"sa.gov.pl":false,
"so.gov.pl":false,
"sr.gov.pl":false,
"wsa.gov.pl":false,
"sko.gov.pl":false,
"uzs.gov.pl":false,
"wiih.gov.pl":false,
"winb.gov.pl":false,
"pinb.gov.pl":false,
"wios.gov.pl":false,
"witd.gov.pl":false,
"wzmiuw.gov.pl":false,
"piw.gov.pl":false,
"wiw.gov.pl":false,
"griw.gov.pl":false,
"wif.gov.pl":false,
"oum.gov.pl":false,
"sdn.gov.pl":false,
"zp.gov.pl":false,
"uppo.gov.pl":false,
"mup.gov.pl":false,
"wuoz.gov.pl":false,
"konsulat.gov.pl":false,
"oirm.gov.pl":false,
"augustow.pl":false,
"babia-gora.pl":false,
"bedzin.pl":false,
"beskidy.pl":false,
"bialowieza.pl":false,
"bialystok.pl":false,
"bielawa.pl":false,
"bieszczady.pl":false,
"boleslawiec.pl":false,
"bydgoszcz.pl":false,
"bytom.pl":false,
"cieszyn.pl":false,
"czeladz.pl":false,
"czest.pl":false,
"dlugoleka.pl":false,
"elblag.pl":false,
"elk.pl":false,
"glogow.pl":false,
"gniezno.pl":false,
"gorlice.pl":false,
"grajewo.pl":false,
"ilawa.pl":false,
"jaworzno.pl":false,
"jelenia-gora.pl":false,
"jgora.pl":false,
"kalisz.pl":false,
"kazimierz-dolny.pl":false,
"karpacz.pl":false,
"kartuzy.pl":false,
"kaszuby.pl":false,
"katowice.pl":false,
"kepno.pl":false,
"ketrzyn.pl":false,
"klodzko.pl":false,
"kobierzyce.pl":false,
"kolobrzeg.pl":false,
"konin.pl":false,
"konskowola.pl":false,
"kutno.pl":false,
"lapy.pl":false,
"lebork.pl":false,
"legnica.pl":false,
"lezajsk.pl":false,
"limanowa.pl":false,
"lomza.pl":false,
"lowicz.pl":false,
"lubin.pl":false,
"lukow.pl":false,
"malbork.pl":false,
"malopolska.pl":false,
"mazowsze.pl":false,
"mazury.pl":false,
"mielec.pl":false,
"mielno.pl":false,
"mragowo.pl":false,
"naklo.pl":false,
"nowaruda.pl":false,
"nysa.pl":false,
"olawa.pl":false,
"olecko.pl":false,
"olkusz.pl":false,
"olsztyn.pl":false,
"opoczno.pl":false,
"opole.pl":false,
"ostroda.pl":false,
"ostroleka.pl":false,
"ostrowiec.pl":false,
"ostrowwlkp.pl":false,
"pila.pl":false,
"pisz.pl":false,
"podhale.pl":false,
"podlasie.pl":false,
"polkowice.pl":false,
"pomorze.pl":false,
"pomorskie.pl":false,
"prochowice.pl":false,
"pruszkow.pl":false,
"przeworsk.pl":false,
"pulawy.pl":false,
"radom.pl":false,
"rawa-maz.pl":false,
"rybnik.pl":false,
"rzeszow.pl":false,
"sanok.pl":false,
"sejny.pl":false,
"slask.pl":false,
"slupsk.pl":false,
"sosnowiec.pl":false,
"stalowa-wola.pl":false,
"skoczow.pl":false,
"starachowice.pl":false,
"stargard.pl":false,
"suwalki.pl":false,
"swidnica.pl":false,
"swiebodzin.pl":false,
"swinoujscie.pl":false,
"szczecin.pl":false,
"szczytno.pl":false,
"tarnobrzeg.pl":false,
"tgory.pl":false,
"turek.pl":false,
"tychy.pl":false,
"ustka.pl":false,
"walbrzych.pl":false,
"warmia.pl":false,
"warszawa.pl":false,
"waw.pl":false,
"wegrow.pl":false,
"wielun.pl":false,
"wlocl.pl":false,
"wloclawek.pl":false,
"wodzislaw.pl":false,
"wolomin.pl":false,
"wroclaw.pl":false,
"zachpomor.pl":false,
"zagan.pl":false,
"zarow.pl":false,
"zgora.pl":false,
"zgorzelec.pl":false,
"pm":false,
"pn":false,
"gov.pn":false,
"co.pn":false,
"org.pn":false,
"edu.pn":false,
"net.pn":false,
"post":false,
"pr":false,
"com.pr":false,
"net.pr":false,
"org.pr":false,
"gov.pr":false,
"edu.pr":false,
"isla.pr":false,
"pro.pr":false,
"biz.pr":false,
"info.pr":false,
"name.pr":false,
"est.pr":false,
"prof.pr":false,
"ac.pr":false,
"pro":false,
"aaa.pro":false,
"aca.pro":false,
"acct.pro":false,
"avocat.pro":false,
"bar.pro":false,
"cpa.pro":false,
"eng.pro":false,
"jur.pro":false,
"law.pro":false,
"med.pro":false,
"recht.pro":false,
"ps":false,
"edu.ps":false,
"gov.ps":false,
"sec.ps":false,
"plo.ps":false,
"com.ps":false,
"org.ps":false,
"net.ps":false,
"pt":false,
"net.pt":false,
"gov.pt":false,
"org.pt":false,
"edu.pt":false,
"int.pt":false,
"publ.pt":false,
"com.pt":false,
"nome.pt":false,
"pw":false,
"co.pw":false,
"ne.pw":false,
"or.pw":false,
"ed.pw":false,
"go.pw":false,
"belau.pw":false,
"py":false,
"com.py":false,
"coop.py":false,
"edu.py":false,
"gov.py":false,
"mil.py":false,
"net.py":false,
"org.py":false,
"qa":false,
"com.qa":false,
"edu.qa":false,
"gov.qa":false,
"mil.qa":false,
"name.qa":false,
"net.qa":false,
"org.qa":false,
"sch.qa":false,
"re":false,
"asso.re":false,
"com.re":false,
"nom.re":false,
"ro":false,
"arts.ro":false,
"com.ro":false,
"firm.ro":false,
"info.ro":false,
"nom.ro":false,
"nt.ro":false,
"org.ro":false,
"rec.ro":false,
"store.ro":false,
"tm.ro":false,
"www.ro":false,
"rs":false,
"ac.rs":false,
"co.rs":false,
"edu.rs":false,
"gov.rs":false,
"in.rs":false,
"org.rs":false,
"ru":false,
"ac.ru":false,
"edu.ru":false,
"gov.ru":false,
"int.ru":false,
"mil.ru":false,
"test.ru":false,
"rw":false,
"gov.rw":false,
"net.rw":false,
"edu.rw":false,
"ac.rw":false,
"com.rw":false,
"co.rw":false,
"int.rw":false,
"mil.rw":false,
"gouv.rw":false,
"sa":false,
"com.sa":false,
"net.sa":false,
"org.sa":false,
"gov.sa":false,
"med.sa":false,
"pub.sa":false,
"edu.sa":false,
"sch.sa":false,
"sb":false,
"com.sb":false,
"edu.sb":false,
"gov.sb":false,
"net.sb":false,
"org.sb":false,
"sc":false,
"com.sc":false,
"gov.sc":false,
"net.sc":false,
"org.sc":false,
"edu.sc":false,
"sd":false,
"com.sd":false,
"net.sd":false,
"org.sd":false,
"edu.sd":false,
"med.sd":false,
"tv.sd":false,
"gov.sd":false,
"info.sd":false,
"se":false,
"a.se":false,
"ac.se":false,
"b.se":false,
"bd.se":false,
"brand.se":false,
"c.se":false,
"d.se":false,
"e.se":false,
"f.se":false,
"fh.se":false,
"fhsk.se":false,
"fhv.se":false,
"g.se":false,
"h.se":false,
"i.se":false,
"k.se":false,
"komforb.se":false,
"kommunalforbund.se":false,
"komvux.se":false,
"l.se":false,
"lanbib.se":false,
"m.se":false,
"n.se":false,
"naturbruksgymn.se":false,
"o.se":false,
"org.se":false,
"p.se":false,
"parti.se":false,
"pp.se":false,
"press.se":false,
"r.se":false,
"s.se":false,
"t.se":false,
"tm.se":false,
"u.se":false,
"w.se":false,
"x.se":false,
"y.se":false,
"z.se":false,
"sg":false,
"com.sg":false,
"net.sg":false,
"org.sg":false,
"gov.sg":false,
"edu.sg":false,
"per.sg":false,
"sh":false,
"com.sh":false,
"net.sh":false,
"gov.sh":false,
"org.sh":false,
"mil.sh":false,
"si":false,
"sj":false,
"sk":false,
"sl":false,
"com.sl":false,
"net.sl":false,
"edu.sl":false,
"gov.sl":false,
"org.sl":false,
"sm":false,
"sn":false,
"art.sn":false,
"com.sn":false,
"edu.sn":false,
"gouv.sn":false,
"org.sn":false,
"perso.sn":false,
"univ.sn":false,
"so":false,
"com.so":false,
"net.so":false,
"org.so":false,
"sr":false,
"st":false,
"co.st":false,
"com.st":false,
"consulado.st":false,
"edu.st":false,
"embaixada.st":false,
"gov.st":false,
"mil.st":false,
"net.st":false,
"org.st":false,
"principe.st":false,
"saotome.st":false,
"store.st":false,
"su":false,
"sv":false,
"com.sv":false,
"edu.sv":false,
"gob.sv":false,
"org.sv":false,
"red.sv":false,
"sx":false,
"gov.sx":false,
"sy":false,
"edu.sy":false,
"gov.sy":false,
"net.sy":false,
"mil.sy":false,
"com.sy":false,
"org.sy":false,
"sz":false,
"co.sz":false,
"ac.sz":false,
"org.sz":false,
"tc":false,
"td":false,
"tel":false,
"tf":false,
"tg":false,
"th":false,
"ac.th":false,
"co.th":false,
"go.th":false,
"in.th":false,
"mi.th":false,
"net.th":false,
"or.th":false,
"tj":false,
"ac.tj":false,
"biz.tj":false,
"co.tj":false,
"com.tj":false,
"edu.tj":false,
"go.tj":false,
"gov.tj":false,
"int.tj":false,
"mil.tj":false,
"name.tj":false,
"net.tj":false,
"nic.tj":false,
"org.tj":false,
"test.tj":false,
"web.tj":false,
"tk":false,
"tl":false,
"gov.tl":false,
"tm":false,
"com.tm":false,
"co.tm":false,
"org.tm":false,
"net.tm":false,
"nom.tm":false,
"gov.tm":false,
"mil.tm":false,
"edu.tm":false,
"tn":false,
"com.tn":false,
"ens.tn":false,
"fin.tn":false,
"gov.tn":false,
"ind.tn":false,
"intl.tn":false,
"nat.tn":false,
"net.tn":false,
"org.tn":false,
"info.tn":false,
"perso.tn":false,
"tourism.tn":false,
"edunet.tn":false,
"rnrt.tn":false,
"rns.tn":false,
"rnu.tn":false,
"mincom.tn":false,
"agrinet.tn":false,
"defense.tn":false,
"turen.tn":false,
"to":false,
"com.to":false,
"gov.to":false,
"net.to":false,
"org.to":false,
"edu.to":false,
"mil.to":false,
"tr":false,
"com.tr":false,
"info.tr":false,
"biz.tr":false,
"net.tr":false,
"org.tr":false,
"web.tr":false,
"gen.tr":false,
"tv.tr":false,
"av.tr":false,
"dr.tr":false,
"bbs.tr":false,
"name.tr":false,
"tel.tr":false,
"gov.tr":false,
"bel.tr":false,
"pol.tr":false,
"mil.tr":false,
"k12.tr":false,
"edu.tr":false,
"kep.tr":false,
"nc.tr":false,
"gov.nc.tr":false,
"tt":false,
"co.tt":false,
"com.tt":false,
"org.tt":false,
"net.tt":false,
"biz.tt":false,
"info.tt":false,
"pro.tt":false,
"int.tt":false,
"coop.tt":false,
"jobs.tt":false,
"mobi.tt":false,
"travel.tt":false,
"museum.tt":false,
"aero.tt":false,
"name.tt":false,
"gov.tt":false,
"edu.tt":false,
"tv":false,
"tw":false,
"edu.tw":false,
"gov.tw":false,
"mil.tw":false,
"com.tw":false,
"net.tw":false,
"org.tw":false,
"idv.tw":false,
"game.tw":false,
"ebiz.tw":false,
"club.tw":false,
"網路.tw":false,
"組織.tw":false,
"商業.tw":false,
"tz":false,
"ac.tz":false,
"co.tz":false,
"go.tz":false,
"hotel.tz":false,
"info.tz":false,
"me.tz":false,
"mil.tz":false,
"mobi.tz":false,
"ne.tz":false,
"or.tz":false,
"sc.tz":false,
"tv.tz":false,
"ua":false,
"com.ua":false,
"edu.ua":false,
"gov.ua":false,
"in.ua":false,
"net.ua":false,
"org.ua":false,
"cherkassy.ua":false,
"cherkasy.ua":false,
"chernigov.ua":false,
"chernihiv.ua":false,
"chernivtsi.ua":false,
"chernovtsy.ua":false,
"ck.ua":false,
"cn.ua":false,
"cr.ua":false,
"crimea.ua":false,
"cv.ua":false,
"dn.ua":false,
"dnepropetrovsk.ua":false,
"dnipropetrovsk.ua":false,
"dominic.ua":false,
"donetsk.ua":false,
"dp.ua":false,
"if.ua":false,
"ivano-frankivsk.ua":false,
"kh.ua":false,
"kharkiv.ua":false,
"kharkov.ua":false,
"kherson.ua":false,
"khmelnitskiy.ua":false,
"khmelnytskyi.ua":false,
"kiev.ua":false,
"kirovograd.ua":false,
"km.ua":false,
"kr.ua":false,
"krym.ua":false,
"ks.ua":false,
"kv.ua":false,
"kyiv.ua":false,
"lg.ua":false,
"lt.ua":false,
"lugansk.ua":false,
"lutsk.ua":false,
"lv.ua":false,
"lviv.ua":false,
"mk.ua":false,
"mykolaiv.ua":false,
"nikolaev.ua":false,
"od.ua":false,
"odesa.ua":false,
"odessa.ua":false,
"pl.ua":false,
"poltava.ua":false,
"rivne.ua":false,
"rovno.ua":false,
"rv.ua":false,
"sb.ua":false,
"sebastopol.ua":false,
"sevastopol.ua":false,
"sm.ua":false,
"sumy.ua":false,
"te.ua":false,
"ternopil.ua":false,
"uz.ua":false,
"uzhgorod.ua":false,
"vinnica.ua":false,
"vinnytsia.ua":false,
"vn.ua":false,
"volyn.ua":false,
"yalta.ua":false,
"zaporizhzhe.ua":false,
"zaporizhzhia.ua":false,
"zhitomir.ua":false,
"zhytomyr.ua":false,
"zp.ua":false,
"zt.ua":false,
"ug":false,
"co.ug":false,
"or.ug":false,
"ac.ug":false,
"sc.ug":false,
"go.ug":false,
"ne.ug":false,
"com.ug":false,
"org.ug":false,
"uk":false,
"ac.uk":false,
"co.uk":false,
"gov.uk":false,
"ltd.uk":false,
"me.uk":false,
"net.uk":false,
"nhs.uk":false,
"org.uk":false,
"plc.uk":false,
"police.uk":false,
"us":false,
"dni.us":false,
"fed.us":false,
"isa.us":false,
"kids.us":false,
"nsn.us":false,
"ak.us":false,
"al.us":false,
"ar.us":false,
"as.us":false,
"az.us":false,
"ca.us":false,
"co.us":false,
"ct.us":false,
"dc.us":false,
"de.us":false,
"fl.us":false,
"ga.us":false,
"gu.us":false,
"hi.us":false,
"ia.us":false,
"id.us":false,
"il.us":false,
"in.us":false,
"ks.us":false,
"ky.us":false,
"la.us":false,
"ma.us":false,
"md.us":false,
"me.us":false,
"mi.us":false,
"mn.us":false,
"mo.us":false,
"ms.us":false,
"mt.us":false,
"nc.us":false,
"nd.us":false,
"ne.us":false,
"nh.us":false,
"nj.us":false,
"nm.us":false,
"nv.us":false,
"ny.us":false,
"oh.us":false,
"ok.us":false,
"or.us":false,
"pa.us":false,
"pr.us":false,
"ri.us":false,
"sc.us":false,
"sd.us":false,
"tn.us":false,
"tx.us":false,
"ut.us":false,
"vi.us":false,
"vt.us":false,
"va.us":false,
"wa.us":false,
"wi.us":false,
"wv.us":false,
"wy.us":false,
"k12.ak.us":false,
"k12.al.us":false,
"k12.ar.us":false,
"k12.as.us":false,
"k12.az.us":false,
"k12.ca.us":false,
"k12.co.us":false,
"k12.ct.us":false,
"k12.dc.us":false,
"k12.de.us":false,
"k12.fl.us":false,
"k12.ga.us":false,
"k12.gu.us":false,
"k12.ia.us":false,
"k12.id.us":false,
"k12.il.us":false,
"k12.in.us":false,
"k12.ks.us":false,
"k12.ky.us":false,
"k12.la.us":false,
"k12.ma.us":false,
"k12.md.us":false,
"k12.me.us":false,
"k12.mi.us":false,
"k12.mn.us":false,
"k12.mo.us":false,
"k12.ms.us":false,
"k12.mt.us":false,
"k12.nc.us":false,
"k12.ne.us":false,
"k12.nh.us":false,
"k12.nj.us":false,
"k12.nm.us":false,
"k12.nv.us":false,
"k12.ny.us":false,
"k12.oh.us":false,
"k12.ok.us":false,
"k12.or.us":false,
"k12.pa.us":false,
"k12.pr.us":false,
"k12.ri.us":false,
"k12.sc.us":false,
"k12.tn.us":false,
"k12.tx.us":false,
"k12.ut.us":false,
"k12.vi.us":false,
"k12.vt.us":false,
"k12.va.us":false,
"k12.wa.us":false,
"k12.wi.us":false,
"k12.wy.us":false,
"cc.ak.us":false,
"cc.al.us":false,
"cc.ar.us":false,
"cc.as.us":false,
"cc.az.us":false,
"cc.ca.us":false,
"cc.co.us":false,
"cc.ct.us":false,
"cc.dc.us":false,
"cc.de.us":false,
"cc.fl.us":false,
"cc.ga.us":false,
"cc.gu.us":false,
"cc.hi.us":false,
"cc.ia.us":false,
"cc.id.us":false,
"cc.il.us":false,
"cc.in.us":false,
"cc.ks.us":false,
"cc.ky.us":false,
"cc.la.us":false,
"cc.ma.us":false,
"cc.md.us":false,
"cc.me.us":false,
"cc.mi.us":false,
"cc.mn.us":false,
"cc.mo.us":false,
"cc.ms.us":false,
"cc.mt.us":false,
"cc.nc.us":false,
"cc.nd.us":false,
"cc.ne.us":false,
"cc.nh.us":false,
"cc.nj.us":false,
"cc.nm.us":false,
"cc.nv.us":false,
"cc.ny.us":false,
"cc.oh.us":false,
"cc.ok.us":false,
"cc.or.us":false,
"cc.pa.us":false,
"cc.pr.us":false,
"cc.ri.us":false,
"cc.sc.us":false,
"cc.sd.us":false,
"cc.tn.us":false,
"cc.tx.us":false,
"cc.ut.us":false,
"cc.vi.us":false,
"cc.vt.us":false,
"cc.va.us":false,
"cc.wa.us":false,
"cc.wi.us":false,
"cc.wv.us":false,
"cc.wy.us":false,
"lib.ak.us":false,
"lib.al.us":false,
"lib.ar.us":false,
"lib.as.us":false,
"lib.az.us":false,
"lib.ca.us":false,
"lib.co.us":false,
"lib.ct.us":false,
"lib.dc.us":false,
"lib.fl.us":false,
"lib.ga.us":false,
"lib.gu.us":false,
"lib.hi.us":false,
"lib.ia.us":false,
"lib.id.us":false,
"lib.il.us":false,
"lib.in.us":false,
"lib.ks.us":false,
"lib.ky.us":false,
"lib.la.us":false,
"lib.ma.us":false,
"lib.md.us":false,
"lib.me.us":false,
"lib.mi.us":false,
"lib.mn.us":false,
"lib.mo.us":false,
"lib.ms.us":false,
"lib.mt.us":false,
"lib.nc.us":false,
"lib.nd.us":false,
"lib.ne.us":false,
"lib.nh.us":false,
"lib.nj.us":false,
"lib.nm.us":false,
"lib.nv.us":false,
"lib.ny.us":false,
"lib.oh.us":false,
"lib.ok.us":false,
"lib.or.us":false,
"lib.pa.us":false,
"lib.pr.us":false,
"lib.ri.us":false,
"lib.sc.us":false,
"lib.sd.us":false,
"lib.tn.us":false,
"lib.tx.us":false,
"lib.ut.us":false,
"lib.vi.us":false,
"lib.vt.us":false,
"lib.va.us":false,
"lib.wa.us":false,
"lib.wi.us":false,
"lib.wy.us":false,
"pvt.k12.ma.us":false,
"chtr.k12.ma.us":false,
"paroch.k12.ma.us":false,
"ann-arbor.mi.us":false,
"cog.mi.us":false,
"dst.mi.us":false,
"eaton.mi.us":false,
"gen.mi.us":false,
"mus.mi.us":false,
"tec.mi.us":false,
"washtenaw.mi.us":false,
"uy":false,
"com.uy":false,
"edu.uy":false,
"gub.uy":false,
"mil.uy":false,
"net.uy":false,
"org.uy":false,
"uz":false,
"co.uz":false,
"com.uz":false,
"net.uz":false,
"org.uz":false,
"va":false,
"vc":false,
"com.vc":false,
"net.vc":false,
"org.vc":false,
"gov.vc":false,
"mil.vc":false,
"edu.vc":false,
"ve":false,
"arts.ve":false,
"co.ve":false,
"com.ve":false,
"e12.ve":false,
"edu.ve":false,
"firm.ve":false,
"gob.ve":false,
"gov.ve":false,
"info.ve":false,
"int.ve":false,
"mil.ve":false,
"net.ve":false,
"org.ve":false,
"rec.ve":false,
"store.ve":false,
"tec.ve":false,
"web.ve":false,
"vg":false,
"vi":false,
"co.vi":false,
"com.vi":false,
"k12.vi":false,
"net.vi":false,
"org.vi":false,
"vn":false,
"com.vn":false,
"net.vn":false,
"org.vn":false,
"edu.vn":false,
"gov.vn":false,
"int.vn":false,
"ac.vn":false,
"biz.vn":false,
"info.vn":false,
"name.vn":false,
"pro.vn":false,
"health.vn":false,
"vu":false,
"com.vu":false,
"edu.vu":false,
"net.vu":false,
"org.vu":false,
"wf":false,
"ws":false,
"com.ws":false,
"net.ws":false,
"org.ws":false,
"gov.ws":false,
"edu.ws":false,
"yt":false,
"امارات":false,
"հայ":false,
"বাংলা":false,
"бг":false,
"бел":false,
"中国":false,
"中國":false,
"الجزائر":false,
"مصر":false,
"ею":false,
"გე":false,
"ελ":false,
"香港":false,
"公司.香港":false,
"教育.香港":false,
"政府.香港":false,
"個人.香港":false,
"網絡.香港":false,
"組織.香港":false,
"ಭಾರತ":false,
"ଭାରତ":false,
"ভাৰত":false,
"भारतम्":false,
"भारोत":false,
"ڀارت":false,
"ഭാരതം":false,
"भारत":false,
"بارت":false,
"بھارت":false,
"భారత్":false,
"ભારત":false,
"ਭਾਰਤ":false,
"ভারত":false,
"இந்தியா":false,
"ایران":false,
"ايران":false,
"عراق":false,
"الاردن":false,
"한국":false,
"қаз":false,
"ලංකා":false,
"இலங்கை":false,
"المغرب":false,
"мкд":false,
"мон":false,
"澳門":false,
"澳门":false,
"مليسيا":false,
"عمان":false,
"پاکستان":false,
"پاكستان":false,
"فلسطين":false,
"срб":false,
"пр.срб":false,
"орг.срб":false,
"обр.срб":false,
"од.срб":false,
"упр.срб":false,
"ак.срб":false,
"рф":false,
"قطر":false,
"السعودية":false,
"السعودیة":false,
"السعودیۃ":false,
"السعوديه":false,
"سودان":false,
"新加坡":false,
"சிங்கப்பூர்":false,
"سورية":false,
"سوريا":false,
"ไทย":false,
"ศึกษา.ไทย":false,
"ธุรกิจ.ไทย":false,
"รัฐบาล.ไทย":false,
"ทหาร.ไทย":false,
"เน็ต.ไทย":false,
"องค์กร.ไทย":false,
"تونس":false,
"台灣":false,
"台湾":false,
"臺灣":false,
"укр":false,
"اليمن":false,
"xxx":false,
"ac.za":false,
"agric.za":false,
"alt.za":false,
"co.za":false,
"edu.za":false,
"gov.za":false,
"grondar.za":false,
"law.za":false,
"mil.za":false,
"net.za":false,
"ngo.za":false,
"nis.za":false,
"nom.za":false,
"org.za":false,
"school.za":false,
"tm.za":false,
"web.za":false,
"zm":false,
"ac.zm":false,
"biz.zm":false,
"co.zm":false,
"com.zm":false,
"edu.zm":false,
"gov.zm":false,
"info.zm":false,
"mil.zm":false,
"net.zm":false,
"org.zm":false,
"sch.zm":false,
"zw":false,
"ac.zw":false,
"co.zw":false,
"gov.zw":false,
"mil.zw":false,
"org.zw":false,
"aaa":false,
"aarp":false,
"abarth":false,
"abb":false,
"abbott":false,
"abbvie":false,
"abc":false,
"able":false,
"abogado":false,
"abudhabi":false,
"academy":false,
"accenture":false,
"accountant":false,
"accountants":false,
"aco":false,
"active":false,
"actor":false,
"adac":false,
"ads":false,
"adult":false,
"aeg":false,
"aetna":false,
"afamilycompany":false,
"afl":false,
"africa":false,
"agakhan":false,
"agency":false,
"aig":false,
"aigo":false,
"airbus":false,
"airforce":false,
"airtel":false,
"akdn":false,
"alfaromeo":false,
"alibaba":false,
"alipay":false,
"allfinanz":false,
"allstate":false,
"ally":false,
"alsace":false,
"alstom":false,
"americanexpress":false,
"americanfamily":false,
"amex":false,
"amfam":false,
"amica":false,
"amsterdam":false,
"analytics":false,
"android":false,
"anquan":false,
"anz":false,
"aol":false,
"apartments":false,
"app":false,
"apple":false,
"aquarelle":false,
"arab":false,
"aramco":false,
"archi":false,
"army":false,
"art":false,
"arte":false,
"asda":false,
"associates":false,
"athleta":false,
"attorney":false,
"auction":false,
"audi":false,
"audible":false,
"audio":false,
"auspost":false,
"author":false,
"auto":false,
"autos":false,
"avianca":false,
"aws":false,
"axa":false,
"azure":false,
"baby":false,
"baidu":false,
"banamex":false,
"bananarepublic":false,
"band":false,
"bank":false,
"bar":false,
"barcelona":false,
"barclaycard":false,
"barclays":false,
"barefoot":false,
"bargains":false,
"baseball":false,
"basketball":false,
"bauhaus":false,
"bayern":false,
"bbc":false,
"bbt":false,
"bbva":false,
"bcg":false,
"bcn":false,
"beats":false,
"beauty":false,
"beer":false,
"bentley":false,
"berlin":false,
"best":false,
"bestbuy":false,
"bet":false,
"bharti":false,
"bible":false,
"bid":false,
"bike":false,
"bing":false,
"bingo":false,
"bio":false,
"black":false,
"blackfriday":false,
"blanco":false,
"blockbuster":false,
"blog":false,
"bloomberg":false,
"blue":false,
"bms":false,
"bmw":false,
"bnl":false,
"bnpparibas":false,
"boats":false,
"boehringer":false,
"bofa":false,
"bom":false,
"bond":false,
"boo":false,
"book":false,
"booking":false,
"bosch":false,
"bostik":false,
"boston":false,
"bot":false,
"boutique":false,
"box":false,
"bradesco":false,
"bridgestone":false,
"broadway":false,
"broker":false,
"brother":false,
"brussels":false,
"budapest":false,
"bugatti":false,
"build":false,
"builders":false,
"business":false,
"buy":false,
"buzz":false,
"bzh":false,
"cab":false,
"cafe":false,
"cal":false,
"call":false,
"calvinklein":false,
"cam":false,
"camera":false,
"camp":false,
"cancerresearch":false,
"canon":false,
"capetown":false,
"capital":false,
"capitalone":false,
"car":false,
"caravan":false,
"cards":false,
"care":false,
"career":false,
"careers":false,
"cars":false,
"cartier":false,
"casa":false,
"case":false,
"caseih":false,
"cash":false,
"casino":false,
"catering":false,
"catholic":false,
"cba":false,
"cbn":false,
"cbre":false,
"cbs":false,
"ceb":false,
"center":false,
"ceo":false,
"cern":false,
"cfa":false,
"cfd":false,
"chanel":false,
"channel":false,
"charity":false,
"chase":false,
"chat":false,
"cheap":false,
"chintai":false,
"christmas":false,
"chrome":false,
"chrysler":false,
"church":false,
"cipriani":false,
"circle":false,
"cisco":false,
"citadel":false,
"citi":false,
"citic":false,
"city":false,
"cityeats":false,
"claims":false,
"cleaning":false,
"click":false,
"clinic":false,
"clinique":false,
"clothing":false,
"cloud":false,
"club":false,
"clubmed":false,
"coach":false,
"codes":false,
"coffee":false,
"college":false,
"cologne":false,
"comcast":false,
"commbank":false,
"community":false,
"company":false,
"compare":false,
"computer":false,
"comsec":false,
"condos":false,
"construction":false,
"consulting":false,
"contact":false,
"contractors":false,
"cooking":false,
"cookingchannel":false,
"cool":false,
"corsica":false,
"country":false,
"coupon":false,
"coupons":false,
"courses":false,
"credit":false,
"creditcard":false,
"creditunion":false,
"cricket":false,
"crown":false,
"crs":false,
"cruise":false,
"cruises":false,
"csc":false,
"cuisinella":false,
"cymru":false,
"cyou":false,
"dabur":false,
"dad":false,
"dance":false,
"data":false,
"date":false,
"dating":false,
"datsun":false,
"day":false,
"dclk":false,
"dds":false,
"deal":false,
"dealer":false,
"deals":false,
"degree":false,
"delivery":false,
"dell":false,
"deloitte":false,
"delta":false,
"democrat":false,
"dental":false,
"dentist":false,
"desi":false,
"design":false,
"dev":false,
"dhl":false,
"diamonds":false,
"diet":false,
"digital":false,
"direct":false,
"directory":false,
"discount":false,
"discover":false,
"dish":false,
"diy":false,
"dnp":false,
"docs":false,
"doctor":false,
"dodge":false,
"dog":false,
"doha":false,
"domains":false,
"dot":false,
"download":false,
"drive":false,
"dtv":false,
"dubai":false,
"duck":false,
"dunlop":false,
"duns":false,
"dupont":false,
"durban":false,
"dvag":false,
"dvr":false,
"earth":false,
"eat":false,
"eco":false,
"edeka":false,
"education":false,
"email":false,
"emerck":false,
"energy":false,
"engineer":false,
"engineering":false,
"enterprises":false,
"epost":false,
"epson":false,
"equipment":false,
"ericsson":false,
"erni":false,
"esq":false,
"estate":false,
"esurance":false,
"etisalat":false,
"eurovision":false,
"eus":false,
"events":false,
"everbank":false,
"exchange":false,
"expert":false,
"exposed":false,
"express":false,
"extraspace":false,
"fage":false,
"fail":false,
"fairwinds":false,
"faith":false,
"family":false,
"fan":false,
"fans":false,
"farm":false,
"farmers":false,
"fashion":false,
"fast":false,
"fedex":false,
"feedback":false,
"ferrari":false,
"ferrero":false,
"fiat":false,
"fidelity":false,
"fido":false,
"film":false,
"final":false,
"finance":false,
"financial":false,
"fire":false,
"firestone":false,
"firmdale":false,
"fish":false,
"fishing":false,
"fit":false,
"fitness":false,
"flickr":false,
"flights":false,
"flir":false,
"florist":false,
"flowers":false,
"fly":false,
"foo":false,
"food":false,
"foodnetwork":false,
"football":false,
"ford":false,
"forex":false,
"forsale":false,
"forum":false,
"foundation":false,
"fox":false,
"free":false,
"fresenius":false,
"frl":false,
"frogans":false,
"frontdoor":false,
"frontier":false,
"ftr":false,
"fujitsu":false,
"fujixerox":false,
"fun":false,
"fund":false,
"furniture":false,
"futbol":false,
"fyi":false,
"gal":false,
"gallery":false,
"gallo":false,
"gallup":false,
"game":false,
"games":false,
"gap":false,
"garden":false,
"gbiz":false,
"gdn":false,
"gea":false,
"gent":false,
"genting":false,
"george":false,
"ggee":false,
"gift":false,
"gifts":false,
"gives":false,
"giving":false,
"glade":false,
"glass":false,
"gle":false,
"global":false,
"globo":false,
"gmail":false,
"gmbh":false,
"gmo":false,
"gmx":false,
"godaddy":false,
"gold":false,
"goldpoint":false,
"golf":false,
"goo":false,
"goodyear":false,
"goog":false,
"google":false,
"gop":false,
"got":false,
"grainger":false,
"graphics":false,
"gratis":false,
"green":false,
"gripe":false,
"grocery":false,
"group":false,
"guardian":false,
"gucci":false,
"guge":false,
"guide":false,
"guitars":false,
"guru":false,
"hair":false,
"hamburg":false,
"hangout":false,
"haus":false,
"hbo":false,
"hdfc":false,
"hdfcbank":false,
"health":false,
"healthcare":false,
"help":false,
"helsinki":false,
"here":false,
"hermes":false,
"hgtv":false,
"hiphop":false,
"hisamitsu":false,
"hitachi":false,
"hiv":false,
"hkt":false,
"hockey":false,
"holdings":false,
"holiday":false,
"homedepot":false,
"homegoods":false,
"homes":false,
"homesense":false,
"honda":false,
"honeywell":false,
"horse":false,
"hospital":false,
"host":false,
"hosting":false,
"hot":false,
"hoteles":false,
"hotels":false,
"hotmail":false,
"house":false,
"how":false,
"hsbc":false,
"hughes":false,
"hyatt":false,
"hyundai":false,
"ibm":false,
"icbc":false,
"ice":false,
"icu":false,
"ieee":false,
"ifm":false,
"ikano":false,
"imamat":false,
"imdb":false,
"immo":false,
"immobilien":false,
"inc":false,
"industries":false,
"infiniti":false,
"ing":false,
"ink":false,
"institute":false,
"insurance":false,
"insure":false,
"intel":false,
"international":false,
"intuit":false,
"investments":false,
"ipiranga":false,
"irish":false,
"iselect":false,
"ismaili":false,
"ist":false,
"istanbul":false,
"itau":false,
"itv":false,
"iveco":false,
"jaguar":false,
"java":false,
"jcb":false,
"jcp":false,
"jeep":false,
"jetzt":false,
"jewelry":false,
"jio":false,
"jll":false,
"jmp":false,
"jnj":false,
"joburg":false,
"jot":false,
"joy":false,
"jpmorgan":false,
"jprs":false,
"juegos":false,
"juniper":false,
"kaufen":false,
"kddi":false,
"kerryhotels":false,
"kerrylogistics":false,
"kerryproperties":false,
"kfh":false,
"kia":false,
"kim":false,
"kinder":false,
"kindle":false,
"kitchen":false,
"kiwi":false,
"koeln":false,
"komatsu":false,
"kosher":false,
"kpmg":false,
"kpn":false,
"krd":false,
"kred":false,
"kuokgroup":false,
"kyoto":false,
"lacaixa":false,
"ladbrokes":false,
"lamborghini":false,
"lamer":false,
"lancaster":false,
"lancia":false,
"lancome":false,
"land":false,
"landrover":false,
"lanxess":false,
"lasalle":false,
"lat":false,
"latino":false,
"latrobe":false,
"law":false,
"lawyer":false,
"lds":false,
"lease":false,
"leclerc":false,
"lefrak":false,
"legal":false,
"lego":false,
"lexus":false,
"lgbt":false,
"liaison":false,
"lidl":false,
"life":false,
"lifeinsurance":false,
"lifestyle":false,
"lighting":false,
"like":false,
"lilly":false,
"limited":false,
"limo":false,
"lincoln":false,
"linde":false,
"link":false,
"lipsy":false,
"live":false,
"living":false,
"lixil":false,
"llc":false,
"loan":false,
"loans":false,
"locker":false,
"locus":false,
"loft":false,
"lol":false,
"london":false,
"lotte":false,
"lotto":false,
"love":false,
"lpl":false,
"lplfinancial":false,
"ltd":false,
"ltda":false,
"lundbeck":false,
"lupin":false,
"luxe":false,
"luxury":false,
"macys":false,
"madrid":false,
"maif":false,
"maison":false,
"makeup":false,
"man":false,
"management":false,
"mango":false,
"map":false,
"market":false,
"marketing":false,
"markets":false,
"marriott":false,
"marshalls":false,
"maserati":false,
"mattel":false,
"mba":false,
"mckinsey":false,
"med":false,
"media":false,
"meet":false,
"melbourne":false,
"meme":false,
"memorial":false,
"men":false,
"menu":false,
"merckmsd":false,
"metlife":false,
"miami":false,
"microsoft":false,
"mini":false,
"mint":false,
"mit":false,
"mitsubishi":false,
"mlb":false,
"mls":false,
"mma":false,
"mobile":false,
"mobily":false,
"moda":false,
"moe":false,
"moi":false,
"mom":false,
"monash":false,
"money":false,
"monster":false,
"mopar":false,
"mormon":false,
"mortgage":false,
"moscow":false,
"moto":false,
"motorcycles":false,
"mov":false,
"movie":false,
"movistar":false,
"msd":false,
"mtn":false,
"mtr":false,
"mutual":false,
"nab":false,
"nadex":false,
"nagoya":false,
"nationwide":false,
"natura":false,
"navy":false,
"nba":false,
"nec":false,
"netbank":false,
"netflix":false,
"network":false,
"neustar":false,
"new":false,
"newholland":false,
"news":false,
"next":false,
"nextdirect":false,
"nexus":false,
"nfl":false,
"ngo":false,
"nhk":false,
"nico":false,
"nike":false,
"nikon":false,
"ninja":false,
"nissan":false,
"nissay":false,
"nokia":false,
"northwesternmutual":false,
"norton":false,
"now":false,
"nowruz":false,
"nowtv":false,
"nra":false,
"nrw":false,
"ntt":false,
"nyc":false,
"obi":false,
"observer":false,
"off":false,
"office":false,
"okinawa":false,
"olayan":false,
"olayangroup":false,
"oldnavy":false,
"ollo":false,
"omega":false,
"one":false,
"ong":false,
"onl":false,
"online":false,
"onyourside":false,
"ooo":false,
"open":false,
"oracle":false,
"orange":false,
"organic":false,
"origins":false,
"osaka":false,
"otsuka":false,
"ott":false,
"ovh":false,
"page":false,
"panasonic":false,
"paris":false,
"pars":false,
"partners":false,
"parts":false,
"party":false,
"passagens":false,
"pay":false,
"pccw":false,
"pet":false,
"pfizer":false,
"pharmacy":false,
"phd":false,
"philips":false,
"phone":false,
"photo":false,
"photography":false,
"photos":false,
"physio":false,
"piaget":false,
"pics":false,
"pictet":false,
"pictures":false,
"pid":false,
"pin":false,
"ping":false,
"pink":false,
"pioneer":false,
"pizza":false,
"place":false,
"play":false,
"playstation":false,
"plumbing":false,
"plus":false,
"pnc":false,
"pohl":false,
"poker":false,
"politie":false,
"porn":false,
"pramerica":false,
"praxi":false,
"press":false,
"prime":false,
"prod":false,
"productions":false,
"prof":false,
"progressive":false,
"promo":false,
"properties":false,
"property":false,
"protection":false,
"pru":false,
"prudential":false,
"pub":false,
"pwc":false,
"qpon":false,
"quebec":false,
"quest":false,
"qvc":false,
"racing":false,
"radio":false,
"raid":false,
"read":false,
"realestate":false,
"realtor":false,
"realty":false,
"recipes":false,
"red":false,
"redstone":false,
"redumbrella":false,
"rehab":false,
"reise":false,
"reisen":false,
"reit":false,
"reliance":false,
"ren":false,
"rent":false,
"rentals":false,
"repair":false,
"report":false,
"republican":false,
"rest":false,
"restaurant":false,
"review":false,
"reviews":false,
"rexroth":false,
"rich":false,
"richardli":false,
"ricoh":false,
"rightathome":false,
"ril":false,
"rio":false,
"rip":false,
"rmit":false,
"rocher":false,
"rocks":false,
"rodeo":false,
"rogers":false,
"room":false,
"rsvp":false,
"rugby":false,
"ruhr":false,
"run":false,
"rwe":false,
"ryukyu":false,
"saarland":false,
"safe":false,
"safety":false,
"sakura":false,
"sale":false,
"salon":false,
"samsclub":false,
"samsung":false,
"sandvik":false,
"sandvikcoromant":false,
"sanofi":false,
"sap":false,
"sarl":false,
"sas":false,
"save":false,
"saxo":false,
"sbi":false,
"sbs":false,
"sca":false,
"scb":false,
"schaeffler":false,
"schmidt":false,
"scholarships":false,
"school":false,
"schule":false,
"schwarz":false,
"science":false,
"scjohnson":false,
"scor":false,
"scot":false,
"search":false,
"seat":false,
"secure":false,
"security":false,
"seek":false,
"select":false,
"sener":false,
"services":false,
"ses":false,
"seven":false,
"sew":false,
"sex":false,
"sexy":false,
"sfr":false,
"shangrila":false,
"sharp":false,
"shaw":false,
"shell":false,
"shia":false,
"shiksha":false,
"shoes":false,
"shop":false,
"shopping":false,
"shouji":false,
"show":false,
"showtime":false,
"shriram":false,
"silk":false,
"sina":false,
"singles":false,
"site":false,
"ski":false,
"skin":false,
"sky":false,
"skype":false,
"sling":false,
"smart":false,
"smile":false,
"sncf":false,
"soccer":false,
"social":false,
"softbank":false,
"software":false,
"sohu":false,
"solar":false,
"solutions":false,
"song":false,
"sony":false,
"soy":false,
"space":false,
"spiegel":false,
"sport":false,
"spot":false,
"spreadbetting":false,
"srl":false,
"srt":false,
"stada":false,
"staples":false,
"star":false,
"starhub":false,
"statebank":false,
"statefarm":false,
"statoil":false,
"stc":false,
"stcgroup":false,
"stockholm":false,
"storage":false,
"store":false,
"stream":false,
"studio":false,
"study":false,
"style":false,
"sucks":false,
"supplies":false,
"supply":false,
"support":false,
"surf":false,
"surgery":false,
"suzuki":false,
"swatch":false,
"swiftcover":false,
"swiss":false,
"sydney":false,
"symantec":false,
"systems":false,
"tab":false,
"taipei":false,
"talk":false,
"taobao":false,
"target":false,
"tatamotors":false,
"tatar":false,
"tattoo":false,
"tax":false,
"taxi":false,
"tci":false,
"tdk":false,
"team":false,
"tech":false,
"technology":false,
"telefonica":false,
"temasek":false,
"tennis":false,
"teva":false,
"thd":false,
"theater":false,
"theatre":false,
"tiaa":false,
"tickets":false,
"tienda":false,
"tiffany":false,
"tips":false,
"tires":false,
"tirol":false,
"tjmaxx":false,
"tjx":false,
"tkmaxx":false,
"tmall":false,
"today":false,
"tokyo":false,
"tools":false,
"top":false,
"toray":false,
"toshiba":false,
"total":false,
"tours":false,
"town":false,
"toyota":false,
"toys":false,
"trade":false,
"trading":false,
"training":false,
"travel":false,
"travelchannel":false,
"travelers":false,
"travelersinsurance":false,
"trust":false,
"trv":false,
"tube":false,
"tui":false,
"tunes":false,
"tushu":false,
"tvs":false,
"ubank":false,
"ubs":false,
"uconnect":false,
"unicom":false,
"university":false,
"uno":false,
"uol":false,
"ups":false,
"vacations":false,
"vana":false,
"vanguard":false,
"vegas":false,
"ventures":false,
"verisign":false,
"versicherung":false,
"vet":false,
"viajes":false,
"video":false,
"vig":false,
"viking":false,
"villas":false,
"vin":false,
"vip":false,
"virgin":false,
"visa":false,
"vision":false,
"vistaprint":false,
"viva":false,
"vivo":false,
"vlaanderen":false,
"vodka":false,
"volkswagen":false,
"volvo":false,
"vote":false,
"voting":false,
"voto":false,
"voyage":false,
"vuelos":false,
"wales":false,
"walmart":false,
"walter":false,
"wang":false,
"wanggou":false,
"warman":false,
"watch":false,
"watches":false,
"weather":false,
"weatherchannel":false,
"webcam":false,
"weber":false,
"website":false,
"wed":false,
"wedding":false,
"weibo":false,
"weir":false,
"whoswho":false,
"wien":false,
"wiki":false,
"williamhill":false,
"win":false,
"windows":false,
"wine":false,
"winners":false,
"wme":false,
"wolterskluwer":false,
"woodside":false,
"work":false,
"works":false,
"world":false,
"wow":false,
"wtc":false,
"wtf":false,
"xbox":false,
"xerox":false,
"xfinity":false,
"xihuan":false,
"xin":false,
"कॉम":false,
"セール":false,
"佛山":false,
"慈善":false,
"集团":false,
"在线":false,
"大众汽车":false,
"点看":false,
"คอม":false,
"八卦":false,
"موقع":false,
"公益":false,
"公司":false,
"香格里拉":false,
"网站":false,
"移动":false,
"我爱你":false,
"москва":false,
"католик":false,
"онлайн":false,
"сайт":false,
"联通":false,
"קום":false,
"时尚":false,
"微博":false,
"淡马锡":false,
"ファッション":false,
"орг":false,
"नेट":false,
"ストア":false,
"삼성":false,
"商标":false,
"商店":false,
"商城":false,
"дети":false,
"ポイント":false,
"新闻":false,
"工行":false,
"家電":false,
"كوم":false,
"中文网":false,
"中信":false,
"娱乐":false,
"谷歌":false,
"電訊盈科":false,
"购物":false,
"クラウド":false,
"通販":false,
"网店":false,
"संगठन":false,
"餐厅":false,
"网络":false,
"ком":false,
"诺基亚":false,
"食品":false,
"飞利浦":false,
"手表":false,
"手机":false,
"ارامكو":false,
"العليان":false,
"اتصالات":false,
"بازار":false,
"موبايلي":false,
"ابوظبي":false,
"كاثوليك":false,
"همراه":false,
"닷컴":false,
"政府":false,
"شبكة":false,
"بيتك":false,
"عرب":false,
"机构":false,
"组织机构":false,
"健康":false,
"招聘":false,
"рус":false,
"珠宝":false,
"大拿":false,
"みんな":false,
"グーグル":false,
"世界":false,
"書籍":false,
"网址":false,
"닷넷":false,
"コム":false,
"天主教":false,
"游戏":false,
"vermögensberater":false,
"vermögensberatung":false,
"企业":false,
"信息":false,
"嘉里大酒店":false,
"嘉里":false,
"广东":false,
"政务":false,
"xyz":false,
"yachts":false,
"yahoo":false,
"yamaxun":false,
"yandex":false,
"yodobashi":false,
"yoga":false,
"yokohama":false,
"you":false,
"youtube":false,
"yun":false,
"zappos":false,
"zara":false,
"zero":false,
"zip":false,
"zippo":false,
"zone":false,
"zuerich":false,
"cc.ua":false,
"inf.ua":false,
"ltd.ua":false,
"beep.pl":false,
"alwaysdata.net":false,
"cloudfront.net":false,
"us-east-1.amazonaws.com":false,
"cn-north-1.eb.amazonaws.com.cn":false,
"cn-northwest-1.eb.amazonaws.com.cn":false,
"elasticbeanstalk.com":false,
"ap-northeast-1.elasticbeanstalk.com":false,
"ap-northeast-2.elasticbeanstalk.com":false,
"ap-northeast-3.elasticbeanstalk.com":false,
"ap-south-1.elasticbeanstalk.com":false,
"ap-southeast-1.elasticbeanstalk.com":false,
"ap-southeast-2.elasticbeanstalk.com":false,
"ca-central-1.elasticbeanstalk.com":false,
"eu-central-1.elasticbeanstalk.com":false,
"eu-west-1.elasticbeanstalk.com":false,
"eu-west-2.elasticbeanstalk.com":false,
"eu-west-3.elasticbeanstalk.com":false,
"sa-east-1.elasticbeanstalk.com":false,
"us-east-1.elasticbeanstalk.com":false,
"us-east-2.elasticbeanstalk.com":false,
"us-gov-west-1.elasticbeanstalk.com":false,
"us-west-1.elasticbeanstalk.com":false,
"us-west-2.elasticbeanstalk.com":false,
"s3.amazonaws.com":false,
"s3-ap-northeast-1.amazonaws.com":false,
"s3-ap-northeast-2.amazonaws.com":false,
"s3-ap-south-1.amazonaws.com":false,
"s3-ap-southeast-1.amazonaws.com":false,
"s3-ap-southeast-2.amazonaws.com":false,
"s3-ca-central-1.amazonaws.com":false,
"s3-eu-central-1.amazonaws.com":false,
"s3-eu-west-1.amazonaws.com":false,
"s3-eu-west-2.amazonaws.com":false,
"s3-eu-west-3.amazonaws.com":false,
"s3-external-1.amazonaws.com":false,
"s3-fips-us-gov-west-1.amazonaws.com":false,
"s3-sa-east-1.amazonaws.com":false,
"s3-us-gov-west-1.amazonaws.com":false,
"s3-us-east-2.amazonaws.com":false,
"s3-us-west-1.amazonaws.com":false,
"s3-us-west-2.amazonaws.com":false,
"s3.ap-northeast-2.amazonaws.com":false,
"s3.ap-south-1.amazonaws.com":false,
"s3.cn-north-1.amazonaws.com.cn":false,
"s3.ca-central-1.amazonaws.com":false,
"s3.eu-central-1.amazonaws.com":false,
"s3.eu-west-2.amazonaws.com":false,
"s3.eu-west-3.amazonaws.com":false,
"s3.us-east-2.amazonaws.com":false,
"s3.dualstack.ap-northeast-1.amazonaws.com":false,
"s3.dualstack.ap-northeast-2.amazonaws.com":false,
"s3.dualstack.ap-south-1.amazonaws.com":false,
"s3.dualstack.ap-southeast-1.amazonaws.com":false,
"s3.dualstack.ap-southeast-2.amazonaws.com":false,
"s3.dualstack.ca-central-1.amazonaws.com":false,
"s3.dualstack.eu-central-1.amazonaws.com":false,
"s3.dualstack.eu-west-1.amazonaws.com":false,
"s3.dualstack.eu-west-2.amazonaws.com":false,
"s3.dualstack.eu-west-3.amazonaws.com":false,
"s3.dualstack.sa-east-1.amazonaws.com":false,
"s3.dualstack.us-east-1.amazonaws.com":false,
"s3.dualstack.us-east-2.amazonaws.com":false,
"s3-website-us-east-1.amazonaws.com":false,
"s3-website-us-west-1.amazonaws.com":false,
"s3-website-us-west-2.amazonaws.com":false,
"s3-website-ap-northeast-1.amazonaws.com":false,
"s3-website-ap-southeast-1.amazonaws.com":false,
"s3-website-ap-southeast-2.amazonaws.com":false,
"s3-website-eu-west-1.amazonaws.com":false,
"s3-website-sa-east-1.amazonaws.com":false,
"s3-website.ap-northeast-2.amazonaws.com":false,
"s3-website.ap-south-1.amazonaws.com":false,
"s3-website.ca-central-1.amazonaws.com":false,
"s3-website.eu-central-1.amazonaws.com":false,
"s3-website.eu-west-2.amazonaws.com":false,
"s3-website.eu-west-3.amazonaws.com":false,
"s3-website.us-east-2.amazonaws.com":false,
"t3l3p0rt.net":false,
"tele.amune.org":false,
"apigee.io":false,
"on-aptible.com":false,
"user.party.eus":false,
"pimienta.org":false,
"poivron.org":false,
"potager.org":false,
"sweetpepper.org":false,
"myasustor.com":false,
"myfritz.net":false,
"backplaneapp.io":false,
"betainabox.com":false,
"bnr.la":false,
"blackbaudcdn.net":false,
"boomla.net":false,
"boxfuse.io":false,
"square7.ch":false,
"bplaced.com":false,
"bplaced.de":false,
"square7.de":false,
"bplaced.net":false,
"square7.net":false,
"browsersafetymark.io":false,
"mycd.eu":false,
"ae.org":false,
"ar.com":false,
"br.com":false,
"cn.com":false,
"com.de":false,
"com.se":false,
"de.com":false,
"eu.com":false,
"gb.com":false,
"gb.net":false,
"hu.com":false,
"hu.net":false,
"jp.net":false,
"jpn.com":false,
"kr.com":false,
"mex.com":false,
"no.com":false,
"qc.com":false,
"ru.com":false,
"sa.com":false,
"se.net":false,
"uk.com":false,
"uk.net":false,
"us.com":false,
"uy.com":false,
"za.bz":false,
"za.com":false,
"africa.com":false,
"gr.com":false,
"in.net":false,
"us.org":false,
"co.com":false,
"c.la":false,
"certmgr.org":false,
"xenapponazure.com":false,
"virtueeldomein.nl":false,
"cleverapps.io":false,
"c66.me":false,
"cloud66.ws":false,
"jdevcloud.com":false,
"wpdevcloud.com":false,
"cloudaccess.host":false,
"freesite.host":false,
"cloudaccess.net":false,
"cloudcontrolled.com":false,
"cloudcontrolapp.com":false,
"co.ca":false,
"co.cz":false,
"c.cdn77.org":false,
"cdn77-ssl.net":false,
"r.cdn77.net":false,
"rsc.cdn77.org":false,
"ssl.origin.cdn77-secure.org":false,
"cloudns.asia":false,
"cloudns.biz":false,
"cloudns.club":false,
"cloudns.cc":false,
"cloudns.eu":false,
"cloudns.in":false,
"cloudns.info":false,
"cloudns.org":false,
"cloudns.pro":false,
"cloudns.pw":false,
"cloudns.us":false,
"cloudeity.net":false,
"cnpy.gdn":false,
"co.nl":false,
"co.no":false,
"webhosting.be":false,
"hosting-cluster.nl":false,
"dyn.cosidns.de":false,
"dynamisches-dns.de":false,
"dnsupdater.de":false,
"internet-dns.de":false,
"l-o-g-i-n.de":false,
"dynamic-dns.info":false,
"feste-ip.net":false,
"knx-server.net":false,
"static-access.net":false,
"realm.cz":false,
"cupcake.is":false,
"cyon.link":false,
"cyon.site":false,
"daplie.me":false,
"localhost.daplie.me":false,
"dattolocal.com":false,
"dattorelay.com":false,
"dattoweb.com":false,
"mydatto.com":false,
"dattolocal.net":false,
"mydatto.net":false,
"biz.dk":false,
"co.dk":false,
"firm.dk":false,
"reg.dk":false,
"store.dk":false,
"debian.net":false,
"dedyn.io":false,
"dnshome.de":false,
"drayddns.com":false,
"dreamhosters.com":false,
"mydrobo.com":false,
"drud.io":false,
"drud.us":false,
"duckdns.org":false,
"dy.fi":false,
"tunk.org":false,
"dyndns-at-home.com":false,
"dyndns-at-work.com":false,
"dyndns-blog.com":false,
"dyndns-free.com":false,
"dyndns-home.com":false,
"dyndns-ip.com":false,
"dyndns-mail.com":false,
"dyndns-office.com":false,
"dyndns-pics.com":false,
"dyndns-remote.com":false,
"dyndns-server.com":false,
"dyndns-web.com":false,
"dyndns-wiki.com":false,
"dyndns-work.com":false,
"dyndns.biz":false,
"dyndns.info":false,
"dyndns.org":false,
"dyndns.tv":false,
"at-band-camp.net":false,
"ath.cx":false,
"barrel-of-knowledge.info":false,
"barrell-of-knowledge.info":false,
"better-than.tv":false,
"blogdns.com":false,
"blogdns.net":false,
"blogdns.org":false,
"blogsite.org":false,
"boldlygoingnowhere.org":false,
"broke-it.net":false,
"buyshouses.net":false,
"cechire.com":false,
"dnsalias.com":false,
"dnsalias.net":false,
"dnsalias.org":false,
"dnsdojo.com":false,
"dnsdojo.net":false,
"dnsdojo.org":false,
"does-it.net":false,
"doesntexist.com":false,
"doesntexist.org":false,
"dontexist.com":false,
"dontexist.net":false,
"dontexist.org":false,
"doomdns.com":false,
"doomdns.org":false,
"dvrdns.org":false,
"dyn-o-saur.com":false,
"dynalias.com":false,
"dynalias.net":false,
"dynalias.org":false,
"dynathome.net":false,
"dyndns.ws":false,
"endofinternet.net":false,
"endofinternet.org":false,
"endoftheinternet.org":false,
"est-a-la-maison.com":false,
"est-a-la-masion.com":false,
"est-le-patron.com":false,
"est-mon-blogueur.com":false,
"for-better.biz":false,
"for-more.biz":false,
"for-our.info":false,
"for-some.biz":false,
"for-the.biz":false,
"forgot.her.name":false,
"forgot.his.name":false,
"from-ak.com":false,
"from-al.com":false,
"from-ar.com":false,
"from-az.net":false,
"from-ca.com":false,
"from-co.net":false,
"from-ct.com":false,
"from-dc.com":false,
"from-de.com":false,
"from-fl.com":false,
"from-ga.com":false,
"from-hi.com":false,
"from-ia.com":false,
"from-id.com":false,
"from-il.com":false,
"from-in.com":false,
"from-ks.com":false,
"from-ky.com":false,
"from-la.net":false,
"from-ma.com":false,
"from-md.com":false,
"from-me.org":false,
"from-mi.com":false,
"from-mn.com":false,
"from-mo.com":false,
"from-ms.com":false,
"from-mt.com":false,
"from-nc.com":false,
"from-nd.com":false,
"from-ne.com":false,
"from-nh.com":false,
"from-nj.com":false,
"from-nm.com":false,
"from-nv.com":false,
"from-ny.net":false,
"from-oh.com":false,
"from-ok.com":false,
"from-or.com":false,
"from-pa.com":false,
"from-pr.com":false,
"from-ri.com":false,
"from-sc.com":false,
"from-sd.com":false,
"from-tn.com":false,
"from-tx.com":false,
"from-ut.com":false,
"from-va.com":false,
"from-vt.com":false,
"from-wa.com":false,
"from-wi.com":false,
"from-wv.com":false,
"from-wy.com":false,
"ftpaccess.cc":false,
"fuettertdasnetz.de":false,
"game-host.org":false,
"game-server.cc":false,
"getmyip.com":false,
"gets-it.net":false,
"go.dyndns.org":false,
"gotdns.com":false,
"gotdns.org":false,
"groks-the.info":false,
"groks-this.info":false,
"ham-radio-op.net":false,
"here-for-more.info":false,
"hobby-site.com":false,
"hobby-site.org":false,
"home.dyndns.org":false,
"homedns.org":false,
"homeftp.net":false,
"homeftp.org":false,
"homeip.net":false,
"homelinux.com":false,
"homelinux.net":false,
"homelinux.org":false,
"homeunix.com":false,
"homeunix.net":false,
"homeunix.org":false,
"iamallama.com":false,
"in-the-band.net":false,
"is-a-anarchist.com":false,
"is-a-blogger.com":false,
"is-a-bookkeeper.com":false,
"is-a-bruinsfan.org":false,
"is-a-bulls-fan.com":false,
"is-a-candidate.org":false,
"is-a-caterer.com":false,
"is-a-celticsfan.org":false,
"is-a-chef.com":false,
"is-a-chef.net":false,
"is-a-chef.org":false,
"is-a-conservative.com":false,
"is-a-cpa.com":false,
"is-a-cubicle-slave.com":false,
"is-a-democrat.com":false,
"is-a-designer.com":false,
"is-a-doctor.com":false,
"is-a-financialadvisor.com":false,
"is-a-geek.com":false,
"is-a-geek.net":false,
"is-a-geek.org":false,
"is-a-green.com":false,
"is-a-guru.com":false,
"is-a-hard-worker.com":false,
"is-a-hunter.com":false,
"is-a-knight.org":false,
"is-a-landscaper.com":false,
"is-a-lawyer.com":false,
"is-a-liberal.com":false,
"is-a-libertarian.com":false,
"is-a-linux-user.org":false,
"is-a-llama.com":false,
"is-a-musician.com":false,
"is-a-nascarfan.com":false,
"is-a-nurse.com":false,
"is-a-painter.com":false,
"is-a-patsfan.org":false,
"is-a-personaltrainer.com":false,
"is-a-photographer.com":false,
"is-a-player.com":false,
"is-a-republican.com":false,
"is-a-rockstar.com":false,
"is-a-socialist.com":false,
"is-a-soxfan.org":false,
"is-a-student.com":false,
"is-a-teacher.com":false,
"is-a-techie.com":false,
"is-a-therapist.com":false,
"is-an-accountant.com":false,
"is-an-actor.com":false,
"is-an-actress.com":false,
"is-an-anarchist.com":false,
"is-an-artist.com":false,
"is-an-engineer.com":false,
"is-an-entertainer.com":false,
"is-by.us":false,
"is-certified.com":false,
"is-found.org":false,
"is-gone.com":false,
"is-into-anime.com":false,
"is-into-cars.com":false,
"is-into-cartoons.com":false,
"is-into-games.com":false,
"is-leet.com":false,
"is-lost.org":false,
"is-not-certified.com":false,
"is-saved.org":false,
"is-slick.com":false,
"is-uberleet.com":false,
"is-very-bad.org":false,
"is-very-evil.org":false,
"is-very-good.org":false,
"is-very-nice.org":false,
"is-very-sweet.org":false,
"is-with-theband.com":false,
"isa-geek.com":false,
"isa-geek.net":false,
"isa-geek.org":false,
"isa-hockeynut.com":false,
"issmarterthanyou.com":false,
"isteingeek.de":false,
"istmein.de":false,
"kicks-ass.net":false,
"kicks-ass.org":false,
"knowsitall.info":false,
"land-4-sale.us":false,
"lebtimnetz.de":false,
"leitungsen.de":false,
"likes-pie.com":false,
"likescandy.com":false,
"merseine.nu":false,
"mine.nu":false,
"misconfused.org":false,
"mypets.ws":false,
"myphotos.cc":false,
"neat-url.com":false,
"office-on-the.net":false,
"on-the-web.tv":false,
"podzone.net":false,
"podzone.org":false,
"readmyblog.org":false,
"saves-the-whales.com":false,
"scrapper-site.net":false,
"scrapping.cc":false,
"selfip.biz":false,
"selfip.com":false,
"selfip.info":false,
"selfip.net":false,
"selfip.org":false,
"sells-for-less.com":false,
"sells-for-u.com":false,
"sells-it.net":false,
"sellsyourhome.org":false,
"servebbs.com":false,
"servebbs.net":false,
"servebbs.org":false,
"serveftp.net":false,
"serveftp.org":false,
"servegame.org":false,
"shacknet.nu":false,
"simple-url.com":false,
"space-to-rent.com":false,
"stuff-4-sale.org":false,
"stuff-4-sale.us":false,
"teaches-yoga.com":false,
"thruhere.net":false,
"traeumtgerade.de":false,
"webhop.biz":false,
"webhop.info":false,
"webhop.net":false,
"webhop.org":false,
"worse-than.tv":false,
"writesthisblog.com":false,
"ddnss.de":false,
"dyn.ddnss.de":false,
"dyndns.ddnss.de":false,
"dyndns1.de":false,
"dyn-ip24.de":false,
"home-webserver.de":false,
"dyn.home-webserver.de":false,
"myhome-server.de":false,
"ddnss.org":false,
"definima.net":false,
"definima.io":false,
"bci.dnstrace.pro":false,
"ddnsfree.com":false,
"ddnsgeek.com":false,
"giize.com":false,
"gleeze.com":false,
"kozow.com":false,
"loseyourip.com":false,
"ooguy.com":false,
"theworkpc.com":false,
"casacam.net":false,
"dynu.net":false,
"accesscam.org":false,
"camdvr.org":false,
"freeddns.org":false,
"mywire.org":false,
"webredirect.org":false,
"myddns.rocks":false,
"blogsite.xyz":false,
"dynv6.net":false,
"e4.cz":false,
"mytuleap.com":false,
"enonic.io":false,
"customer.enonic.io":false,
"eu.org":false,
"al.eu.org":false,
"asso.eu.org":false,
"at.eu.org":false,
"au.eu.org":false,
"be.eu.org":false,
"bg.eu.org":false,
"ca.eu.org":false,
"cd.eu.org":false,
"ch.eu.org":false,
"cn.eu.org":false,
"cy.eu.org":false,
"cz.eu.org":false,
"de.eu.org":false,
"dk.eu.org":false,
"edu.eu.org":false,
"ee.eu.org":false,
"es.eu.org":false,
"fi.eu.org":false,
"fr.eu.org":false,
"gr.eu.org":false,
"hr.eu.org":false,
"hu.eu.org":false,
"ie.eu.org":false,
"il.eu.org":false,
"in.eu.org":false,
"int.eu.org":false,
"is.eu.org":false,
"it.eu.org":false,
"jp.eu.org":false,
"kr.eu.org":false,
"lt.eu.org":false,
"lu.eu.org":false,
"lv.eu.org":false,
"mc.eu.org":false,
"me.eu.org":false,
"mk.eu.org":false,
"mt.eu.org":false,
"my.eu.org":false,
"net.eu.org":false,
"ng.eu.org":false,
"nl.eu.org":false,
"no.eu.org":false,
"nz.eu.org":false,
"paris.eu.org":false,
"pl.eu.org":false,
"pt.eu.org":false,
"q-a.eu.org":false,
"ro.eu.org":false,
"ru.eu.org":false,
"se.eu.org":false,
"si.eu.org":false,
"sk.eu.org":false,
"tr.eu.org":false,
"uk.eu.org":false,
"us.eu.org":false,
"eu-1.evennode.com":false,
"eu-2.evennode.com":false,
"eu-3.evennode.com":false,
"eu-4.evennode.com":false,
"us-1.evennode.com":false,
"us-2.evennode.com":false,
"us-3.evennode.com":false,
"us-4.evennode.com":false,
"twmail.cc":false,
"twmail.net":false,
"twmail.org":false,
"mymailer.com.tw":false,
"url.tw":false,
"apps.fbsbx.com":false,
"ru.net":false,
"adygeya.ru":false,
"bashkiria.ru":false,
"bir.ru":false,
"cbg.ru":false,
"com.ru":false,
"dagestan.ru":false,
"grozny.ru":false,
"kalmykia.ru":false,
"kustanai.ru":false,
"marine.ru":false,
"mordovia.ru":false,
"msk.ru":false,
"mytis.ru":false,
"nalchik.ru":false,
"nov.ru":false,
"pyatigorsk.ru":false,
"spb.ru":false,
"vladikavkaz.ru":false,
"vladimir.ru":false,
"abkhazia.su":false,
"adygeya.su":false,
"aktyubinsk.su":false,
"arkhangelsk.su":false,
"armenia.su":false,
"ashgabad.su":false,
"azerbaijan.su":false,
"balashov.su":false,
"bashkiria.su":false,
"bryansk.su":false,
"bukhara.su":false,
"chimkent.su":false,
"dagestan.su":false,
"east-kazakhstan.su":false,
"exnet.su":false,
"georgia.su":false,
"grozny.su":false,
"ivanovo.su":false,
"jambyl.su":false,
"kalmykia.su":false,
"kaluga.su":false,
"karacol.su":false,
"karaganda.su":false,
"karelia.su":false,
"khakassia.su":false,
"krasnodar.su":false,
"kurgan.su":false,
"kustanai.su":false,
"lenug.su":false,
"mangyshlak.su":false,
"mordovia.su":false,
"msk.su":false,
"murmansk.su":false,
"nalchik.su":false,
"navoi.su":false,
"north-kazakhstan.su":false,
"nov.su":false,
"obninsk.su":false,
"penza.su":false,
"pokrovsk.su":false,
"sochi.su":false,
"spb.su":false,
"tashkent.su":false,
"termez.su":false,
"togliatti.su":false,
"troitsk.su":false,
"tselinograd.su":false,
"tula.su":false,
"tuva.su":false,
"vladikavkaz.su":false,
"vladimir.su":false,
"vologda.su":false,
"channelsdvr.net":false,
"fastlylb.net":false,
"map.fastlylb.net":false,
"freetls.fastly.net":false,
"map.fastly.net":false,
"a.prod.fastly.net":false,
"global.prod.fastly.net":false,
"a.ssl.fastly.net":false,
"b.ssl.fastly.net":false,
"global.ssl.fastly.net":false,
"fastpanel.direct":false,
"fastvps-server.com":false,
"fhapp.xyz":false,
"fedorainfracloud.org":false,
"fedorapeople.org":false,
"cloud.fedoraproject.org":false,
"app.os.fedoraproject.org":false,
"app.os.stg.fedoraproject.org":false,
"filegear.me":false,
"firebaseapp.com":false,
"flynnhub.com":false,
"flynnhosting.net":false,
"freebox-os.com":false,
"freeboxos.com":false,
"fbx-os.fr":false,
"fbxos.fr":false,
"freebox-os.fr":false,
"freeboxos.fr":false,
"freedesktop.org":false,
"futurehosting.at":false,
"futuremailing.at":false,
"service.gov.uk":false,
"github.io":false,
"githubusercontent.com":false,
"gitlab.io":false,
"homeoffice.gov.uk":false,
"ro.im":false,
"shop.ro":false,
"goip.de":false,
"appspot.com":false,
"blogspot.ae":false,
"blogspot.al":false,
"blogspot.am":false,
"blogspot.ba":false,
"blogspot.be":false,
"blogspot.bg":false,
"blogspot.bj":false,
"blogspot.ca":false,
"blogspot.cf":false,
"blogspot.ch":false,
"blogspot.cl":false,
"blogspot.co.at":false,
"blogspot.co.id":false,
"blogspot.co.il":false,
"blogspot.co.ke":false,
"blogspot.co.nz":false,
"blogspot.co.uk":false,
"blogspot.co.za":false,
"blogspot.com":false,
"blogspot.com.ar":false,
"blogspot.com.au":false,
"blogspot.com.br":false,
"blogspot.com.by":false,
"blogspot.com.co":false,
"blogspot.com.cy":false,
"blogspot.com.ee":false,
"blogspot.com.eg":false,
"blogspot.com.es":false,
"blogspot.com.mt":false,
"blogspot.com.ng":false,
"blogspot.com.tr":false,
"blogspot.com.uy":false,
"blogspot.cv":false,
"blogspot.cz":false,
"blogspot.de":false,
"blogspot.dk":false,
"blogspot.fi":false,
"blogspot.fr":false,
"blogspot.gr":false,
"blogspot.hk":false,
"blogspot.hr":false,
"blogspot.hu":false,
"blogspot.ie":false,
"blogspot.in":false,
"blogspot.is":false,
"blogspot.it":false,
"blogspot.jp":false,
"blogspot.kr":false,
"blogspot.li":false,
"blogspot.lt":false,
"blogspot.lu":false,
"blogspot.md":false,
"blogspot.mk":false,
"blogspot.mr":false,
"blogspot.mx":false,
"blogspot.my":false,
"blogspot.nl":false,
"blogspot.no":false,
"blogspot.pe":false,
"blogspot.pt":false,
"blogspot.qa":false,
"blogspot.re":false,
"blogspot.ro":false,
"blogspot.rs":false,
"blogspot.ru":false,
"blogspot.se":false,
"blogspot.sg":false,
"blogspot.si":false,
"blogspot.sk":false,
"blogspot.sn":false,
"blogspot.td":false,
"blogspot.tw":false,
"blogspot.ug":false,
"blogspot.vn":false,
"cloudfunctions.net":false,
"cloud.goog":false,
"codespot.com":false,
"googleapis.com":false,
"googlecode.com":false,
"pagespeedmobilizer.com":false,
"publishproxy.com":false,
"withgoogle.com":false,
"withyoutube.com":false,
"hashbang.sh":false,
"hasura.app":false,
"hasura-app.io":false,
"hepforge.org":false,
"herokuapp.com":false,
"herokussl.com":false,
"myravendb.com":false,
"ravendb.community":false,
"ravendb.me":false,
"development.run":false,
"ravendb.run":false,
"moonscale.net":false,
"iki.fi":false,
"biz.at":false,
"info.at":false,
"info.cx":false,
"ac.leg.br":false,
"al.leg.br":false,
"am.leg.br":false,
"ap.leg.br":false,
"ba.leg.br":false,
"ce.leg.br":false,
"df.leg.br":false,
"es.leg.br":false,
"go.leg.br":false,
"ma.leg.br":false,
"mg.leg.br":false,
"ms.leg.br":false,
"mt.leg.br":false,
"pa.leg.br":false,
"pb.leg.br":false,
"pe.leg.br":false,
"pi.leg.br":false,
"pr.leg.br":false,
"rj.leg.br":false,
"rn.leg.br":false,
"ro.leg.br":false,
"rr.leg.br":false,
"rs.leg.br":false,
"sc.leg.br":false,
"se.leg.br":false,
"sp.leg.br":false,
"to.leg.br":false,
"pixolino.com":false,
"ipifony.net":false,
"mein-iserv.de":false,
"test-iserv.de":false,
"myjino.ru":false,
"js.org":false,
"keymachine.de":false,
"knightpoint.systems":false,
"co.krd":false,
"edu.krd":false,
"git-repos.de":false,
"lcube-server.de":false,
"svn-repos.de":false,
"app.lmpm.com":false,
"linkitools.space":false,
"linkyard.cloud":false,
"linkyard-cloud.ch":false,
"we.bs":false,
"uklugs.org":false,
"glug.org.uk":false,
"lug.org.uk":false,
"lugs.org.uk":false,
"barsy.bg":false,
"barsy.co.uk":false,
"barsyonline.co.uk":false,
"barsycenter.com":false,
"barsyonline.com":false,
"barsy.club":false,
"barsy.de":false,
"barsy.eu":false,
"barsy.in":false,
"barsy.info":false,
"barsy.io":false,
"barsy.me":false,
"barsy.menu":false,
"barsy.mobi":false,
"barsy.net":false,
"barsy.online":false,
"barsy.org":false,
"barsy.pro":false,
"barsy.pub":false,
"barsy.shop":false,
"barsy.site":false,
"barsy.support":false,
"barsy.uk":false,
"mayfirst.info":false,
"mayfirst.org":false,
"hb.cldmail.ru":false,
"miniserver.com":false,
"memset.net":false,
"cloud.metacentrum.cz":false,
"custom.metacentrum.cz":false,
"flt.cloud.muni.cz":false,
"usr.cloud.muni.cz":false,
"meteorapp.com":false,
"eu.meteorapp.com":false,
"co.pl":false,
"azurecontainer.io":false,
"azurewebsites.net":false,
"azure-mobile.net":false,
"cloudapp.net":false,
"mozilla-iot.org":false,
"bmoattachments.org":false,
"net.ru":false,
"org.ru":false,
"pp.ru":false,
"bitballoon.com":false,
"netlify.com":false,
"4u.com":false,
"ngrok.io":false,
"nh-serv.co.uk":false,
"nfshost.com":false,
"dnsking.ch":false,
"mypi.co":false,
"n4t.co":false,
"001www.com":false,
"ddnslive.com":false,
"myiphost.com":false,
"forumz.info":false,
"16-b.it":false,
"32-b.it":false,
"64-b.it":false,
"soundcast.me":false,
"tcp4.me":false,
"dnsup.net":false,
"hicam.net":false,
"now-dns.net":false,
"ownip.net":false,
"vpndns.net":false,
"dynserv.org":false,
"now-dns.org":false,
"x443.pw":false,
"now-dns.top":false,
"ntdll.top":false,
"freeddns.us":false,
"crafting.xyz":false,
"zapto.xyz":false,
"nsupdate.info":false,
"nerdpol.ovh":false,
"blogsyte.com":false,
"brasilia.me":false,
"cable-modem.org":false,
"ciscofreak.com":false,
"collegefan.org":false,
"couchpotatofries.org":false,
"damnserver.com":false,
"ddns.me":false,
"ditchyourip.com":false,
"dnsfor.me":false,
"dnsiskinky.com":false,
"dvrcam.info":false,
"dynns.com":false,
"eating-organic.net":false,
"fantasyleague.cc":false,
"geekgalaxy.com":false,
"golffan.us":false,
"health-carereform.com":false,
"homesecuritymac.com":false,
"homesecuritypc.com":false,
"hopto.me":false,
"ilovecollege.info":false,
"loginto.me":false,
"mlbfan.org":false,
"mmafan.biz":false,
"myactivedirectory.com":false,
"mydissent.net":false,
"myeffect.net":false,
"mymediapc.net":false,
"mypsx.net":false,
"mysecuritycamera.com":false,
"mysecuritycamera.net":false,
"mysecuritycamera.org":false,
"net-freaks.com":false,
"nflfan.org":false,
"nhlfan.net":false,
"no-ip.ca":false,
"no-ip.co.uk":false,
"no-ip.net":false,
"noip.us":false,
"onthewifi.com":false,
"pgafan.net":false,
"point2this.com":false,
"pointto.us":false,
"privatizehealthinsurance.net":false,
"quicksytes.com":false,
"read-books.org":false,
"securitytactics.com":false,
"serveexchange.com":false,
"servehumour.com":false,
"servep2p.com":false,
"servesarcasm.com":false,
"stufftoread.com":false,
"ufcfan.org":false,
"unusualperson.com":false,
"workisboring.com":false,
"3utilities.com":false,
"bounceme.net":false,
"ddns.net":false,
"ddnsking.com":false,
"gotdns.ch":false,
"hopto.org":false,
"myftp.biz":false,
"myftp.org":false,
"myvnc.com":false,
"no-ip.biz":false,
"no-ip.info":false,
"no-ip.org":false,
"noip.me":false,
"redirectme.net":false,
"servebeer.com":false,
"serveblog.net":false,
"servecounterstrike.com":false,
"serveftp.com":false,
"servegame.com":false,
"servehalflife.com":false,
"servehttp.com":false,
"serveirc.com":false,
"serveminecraft.net":false,
"servemp3.com":false,
"servepics.com":false,
"servequake.com":false,
"sytes.net":false,
"webhop.me":false,
"zapto.org":false,
"stage.nodeart.io":false,
"nodum.co":false,
"nodum.io":false,
"pcloud.host":false,
"nyc.mn":false,
"nom.ae":false,
"nom.af":false,
"nom.ai":false,
"nom.al":false,
"nym.by":false,
"nym.bz":false,
"nom.cl":false,
"nom.gd":false,
"nom.ge":false,
"nom.gl":false,
"nym.gr":false,
"nom.gt":false,
"nym.gy":false,
"nom.hn":false,
"nym.ie":false,
"nom.im":false,
"nom.ke":false,
"nym.kz":false,
"nym.la":false,
"nym.lc":false,
"nom.li":false,
"nym.li":false,
"nym.lt":false,
"nym.lu":false,
"nym.me":false,
"nom.mk":false,
"nym.mn":false,
"nym.mx":false,
"nom.nu":false,
"nym.nz":false,
"nym.pe":false,
"nym.pt":false,
"nom.pw":false,
"nom.qa":false,
"nym.ro":false,
"nom.rs":false,
"nom.si":false,
"nym.sk":false,
"nom.st":false,
"nym.su":false,
"nym.sx":false,
"nom.tj":false,
"nym.tw":false,
"nom.ug":false,
"nom.uy":false,
"nom.vc":false,
"nom.vg":false,
"cya.gg":false,
"cloudycluster.net":false,
"nid.io":false,
"opencraft.hosting":false,
"operaunite.com":false,
"outsystemscloud.com":false,
"ownprovider.com":false,
"own.pm":false,
"ox.rs":false,
"oy.lc":false,
"pgfog.com":false,
"pagefrontapp.com":false,
"art.pl":false,
"gliwice.pl":false,
"krakow.pl":false,
"poznan.pl":false,
"wroc.pl":false,
"zakopane.pl":false,
"pantheonsite.io":false,
"gotpantheon.com":false,
"mypep.link":false,
"on-web.fr":false,
"xen.prgmr.com":false,
"priv.at":false,
"protonet.io":false,
"chirurgiens-dentistes-en-france.fr":false,
"byen.site":false,
"ras.ru":false,
"qa2.com":false,
"dev-myqnapcloud.com":false,
"alpha-myqnapcloud.com":false,
"myqnapcloud.com":false,
"vapor.cloud":false,
"vaporcloud.io":false,
"rackmaze.com":false,
"rackmaze.net":false,
"rhcloud.com":false,
"resindevice.io":false,
"devices.resinstaging.io":false,
"hzc.io":false,
"wellbeingzone.eu":false,
"ptplus.fit":false,
"wellbeingzone.co.uk":false,
"sandcats.io":false,
"logoip.de":false,
"logoip.com":false,
"schokokeks.net":false,
"scrysec.com":false,
"firewall-gateway.com":false,
"firewall-gateway.de":false,
"my-gateway.de":false,
"my-router.de":false,
"spdns.de":false,
"spdns.eu":false,
"firewall-gateway.net":false,
"my-firewall.org":false,
"myfirewall.org":false,
"spdns.org":false,
"biz.ua":false,
"co.ua":false,
"pp.ua":false,
"shiftedit.io":false,
"myshopblocks.com":false,
"1kapp.com":false,
"appchizi.com":false,
"applinzi.com":false,
"sinaapp.com":false,
"vipsinaapp.com":false,
"bounty-full.com":false,
"alpha.bounty-full.com":false,
"beta.bounty-full.com":false,
"static.land":false,
"dev.static.land":false,
"sites.static.land":false,
"apps.lair.io":false,
"spacekit.io":false,
"customer.speedpartner.de":false,
"storj.farm":false,
"utwente.io":false,
"temp-dns.com":false,
"diskstation.me":false,
"dscloud.biz":false,
"dscloud.me":false,
"dscloud.mobi":false,
"dsmynas.com":false,
"dsmynas.net":false,
"dsmynas.org":false,
"familyds.com":false,
"familyds.net":false,
"familyds.org":false,
"i234.me":false,
"myds.me":false,
"synology.me":false,
"vpnplus.to":false,
"taifun-dns.de":false,
"gda.pl":false,
"gdansk.pl":false,
"gdynia.pl":false,
"med.pl":false,
"sopot.pl":false,
"gwiddle.co.uk":false,
"cust.dev.thingdust.io":false,
"cust.disrec.thingdust.io":false,
"cust.prod.thingdust.io":false,
"cust.testing.thingdust.io":false,
"bloxcms.com":false,
"townnews-staging.com":false,
"12hp.at":false,
"2ix.at":false,
"4lima.at":false,
"lima-city.at":false,
"12hp.ch":false,
"2ix.ch":false,
"4lima.ch":false,
"lima-city.ch":false,
"trafficplex.cloud":false,
"de.cool":false,
"12hp.de":false,
"2ix.de":false,
"4lima.de":false,
"lima-city.de":false,
"1337.pictures":false,
"clan.rip":false,
"lima-city.rocks":false,
"webspace.rocks":false,
"lima.zone":false,
"tuxfamily.org":false,
"dd-dns.de":false,
"diskstation.eu":false,
"diskstation.org":false,
"dray-dns.de":false,
"draydns.de":false,
"dyn-vpn.de":false,
"dynvpn.de":false,
"mein-vigor.de":false,
"my-vigor.de":false,
"my-wan.de":false,
"syno-ds.de":false,
"synology-diskstation.de":false,
"synology-ds.de":false,
"uber.space":false,
"hk.com":false,
"hk.org":false,
"ltd.hk":false,
"inc.hk":false,
"virtualuser.de":false,
"virtual-user.de":false,
"lib.de.us":false,
"2038.io":false,
"router.management":false,
"v-info.info":false,
"wedeploy.io":false,
"wedeploy.me":false,
"wedeploy.sh":false,
"remotewd.com":false,
"wmflabs.org":false,
"half.host":false,
"xnbay.com":false,
"u2.xnbay.com":false,
"u2-local.xnbay.com":false,
"cistron.nl":false,
"demon.nl":false,
"xs4all.space":false,
"official.academy":false,
"yolasite.com":false,
"ybo.faith":false,
"yombo.me":false,
"homelink.one":false,
"ybo.party":false,
"ybo.review":false,
"ybo.science":false,
"ybo.trade":false,
"nohost.me":false,
"noho.st":false,
"za.net":false,
"za.org":false,
"now.sh":false,
"zone.id":false,
"bd":true,
"nom.br":true,
"ck":true,
"er":true,
"fj":true,
"fk":true,
"jm":true,
"kawasaki.jp":true,
"kitakyushu.jp":true,
"kobe.jp":true,
"nagoya.jp":true,
"sapporo.jp":true,
"sendai.jp":true,
"yokohama.jp":true,
"kh":true,
"mm":true,
"np":true,
"pg":true,
"sch.uk":true,
"ye":true,
"compute.estate":true,
"alces.network":true,
"compute.amazonaws.com":true,
"compute-1.amazonaws.com":true,
"compute.amazonaws.com.cn":true,
"elb.amazonaws.com":true,
"elb.amazonaws.com.cn":true,
"awdev.ca":true,
"advisor.ws":true,
"otap.co":true,
"cryptonomic.net":true,
"futurecms.at":true,
"ex.futurecms.at":true,
"in.futurecms.at":true,
"ex.ortsinfo.at":true,
"kunden.ortsinfo.at":true,
"statics.cloud":true,
"0emm.com":true,
"hosting.myjino.ru":true,
"landing.myjino.ru":true,
"spectrum.myjino.ru":true,
"vps.myjino.ru":true,
"triton.zone":true,
"cns.joyent.com":true,
"magentosite.cloud":true,
"platform.sh":true,
"platformsh.site":true,
"quipelements.com":true,
"s5y.io":true,
"sensiosite.cloud":true,
"stolos.io":true,
"transurl.be":true,
"transurl.eu":true,
"transurl.nl":true,
"uberspace.de":true};

(function(){
	
	"use strict";
	
	function normalize_domain(text) {
		text = text.trim();
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

(function(){
	
	"use strict";
	
	
	PPG.showpwd = function(site) {
		var site = PPG.normalize_domain(site)
		
		var siteInfo = PPG.KeyStore.getSite(site);
		var origSiteInfo;
		var newsite = false;
		
		if (siteInfo.time) {
			PPG.KeyStore.setSite(site,siteInfo.key, siteInfo.index);
		} else {
			newsite = true;
		}
		origSiteInfo = PPG.KeyStore.getSite(site);
		
		function checkDNS(domain) {
			try {
				return fetch("https://cloudflare-dns.com/dns-query?name="+encodeURIComponent(domain),
						{"headers":{"accept":"application/dns-json"}})
						.then(function(x) {return x.json();})
						.then(function(x) {return x.Status == 0})
						.catch(function(){
							return false;
						});
			} catch (e) {
				return Promise.resolve(false);
			}
		}
		
		function update(v) {
			var secret = PPG.KeyStore.get(siteInfo.key);
			var krnd = PPG.prepareKey(secret, site, siteInfo.index);
			v.setItemValue("chngkey", siteInfo.key);
			v.setItemValue("pwd",PPG.generatePassword(krnd));						
			v.setItemValue("order", siteInfo.index+1);
			v.enableItem("prev", siteInfo.index > 0);
			var restore = siteInfo.key != origSiteInfo.key || siteInfo.index != origSiteInfo.index;
			v.enableItem("remember", restore || newsite);
			v.showItem("restore", restore);
		}
		
				
		return new Promise(function(ok) {
			var v = this.layout.load("showpwd").v;

			checkDNS(site).then(function(x) {
				if (!x) v.mark("err_notfound");
			})
			
			var klist = PPG.KeyStore.list();
			v.showItem("dkey",klist.length>1);
			v.setItemValue("chngkey", klist);
			update(v);
			
			v.setItemValue("site",site);
			v.setDefaultAction(ok,"back");
			v.setItemEvent("next","click",function(){
				siteInfo.index++;
				update(v);
			});
			v.setItemEvent("prev","click",function(){
				siteInfo.index--;
				update(v);
			});
			v.setItemEvent("restore","click",function(){
				siteInfo = PPG.KeyStore.getSite(site);
				update(v);
			});
			v.setItemEvent("remember","click",function(){
				PPG.KeyStore.setSite(site,siteInfo.key,siteInfo.index);
				origSiteInfo = PPG.KeyStore.getSite(site);
				newsite = false;
				update(v);
			});
			v.setItemEvent("chngkey","change",function(e){
				siteInfo.key = e.target.value;
				siteInfo.index = 0;
				update(v);
			});
		}.bind(this));			
			
	};
	
	
	
})();


(function(){

	"use strict";
	
	PPG.main_page = function() {
		
		var v = this.layout.load("mainscreen").v;

		v.setDefaultAction(function() {
					var d = v.readData();
					if (d.site.length == 0) {
						v.mark("errshort");						
					} else {
						location.hash = "#site="+encodeURIComponent(d.site);
					}
				}.bind(this),"showpwd");
/*		v.setItemEvent("keyman_icon","click",function() {
					location.hash = "#keys";
			});*/
		v.setItemEvent("keyman_icon","click",function() {
			PPG.settings().then(PPG.main_page.bind(PPG));
		});
		v.setItemEvent("scanqr","click",function() {
			var qrr = new PPG.QRReader(function(site) {
				location.hash="#site="+encodeURIComponent(site);
			});
			qrr.show().then(PPG.main_page.bind(PPG));				
		});
		var ss =PPG.KeyStore.listSites().sort(function(a,b){
			var ta = PPG.KeyStore.getSite(a);
			var tb = PPG.KeyStore.getSite(b);
			return tb.time - ta.time;
		}).slice(0,20).map(function(x){
			return {
				"":{
					"value":x,
					"!click":function() {
						location.hash = "#site="+encodeURIComponent(x);
					}
				}
			};
		});
		
		v.setItemValue("recent",ss);
		v.showItem("empty",ss.length == 0);
		
		
	};
	
	
})();

(function(){
	
	"use strict";
	
	
	PPG.settings= function() {
		return new Promise(function(ok) {
			var v = this.layout.load("settings").v;
			
			v.setDefaultAction(ok,"back");
			
			v.setItemEvent("keys","click",function(){
				location.hash = "#keys";
			});
			v.setItemEvent("lang","click",function(){
				delete localStorage["lang"];
				location.href="index.html"
			});
			v.setItemEvent("reset","click",function(){
				PPG.wipe().then(ok);
			});
		}.bind(this));
	};

	PPG.wipe= function() {
		return new Promise(function(ok) {
			var v = this.layout.load("wipe").v;
			
			v.setCancelAction(ok,"back");

			v.setItemEvent("ok","click",function(){
				var k = Object.keys(localStorage);
				k.forEach(function(x){
					delete localStorage[x];
				});
				location.href="index.html";
			})
		}.bind(this));
	};

})();
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.QrCode=e()}(this,function(){"use strict";function t(t,e,n){this.ordinal_Renamed_Field=t,this.bits=e,this.name=n}function e(e){this.errorCorrectionLevel=t.forBits(e>>3&3),this.dataMask=7&e}function n(t,e){if(e||(e=t),t<1||e<1)throw"Both dimensions must be greater than 0";this.width=t,this.height=e;var n=t>>5;0!=(31&t)&&n++,this.rowSize=n,this.bits=new Array(n*e);for(var i=0;i<this.bits.length;i++)this.bits[i]=0}function i(t,e){this.count=t,this.dataCodewords=e}function r(t,e,n){this.ecCodewordsPerBlock=t,this.ecBlocks=n?[e,n]:[e]}function o(t,e,n,i,r,o){this.versionNumber=t,this.alignmentPatternCenters=e,this.ecBlocks=[n,i,r,o];for(var s=0,a=n.ecCodewordsPerBlock,h=n.getECBlocks(),w=0;w<h.length;w++){var f=h[w];s+=f.count*(f.dataCodewords+a)}this.totalCodewords=s}function s(t,e,n){this.x=t,this.y=e,this.count=1,this.estimatedModuleSize=n}function a(t,e,n,i,r,o,s){this.image=t,this.possibleCenters=[],this.startX=e,this.startY=n,this.width=i,this.height=r,this.moduleSize=o,this.crossCheckStateCount=[0,0,0],this.resultPointCallback=s}function h(t){function e(t,e){var n=t.X-e.X,i=t.Y-e.Y;return Math.sqrt(n*n+i*i)}var n,i,r,o=e(t[0],t[1]),s=e(t[1],t[2]),a=e(t[0],t[2]);if(s>=o&&s>=a?(i=t[0],n=t[1],r=t[2]):a>=s&&a>=o?(i=t[1],n=t[0],r=t[2]):(i=t[2],n=t[0],r=t[1]),function(t,e,n){var i=e.x,r=e.y;return(n.x-i)*(t.y-r)-(n.y-r)*(t.x-i)}(n,i,r)<0){var h=n;n=r,r=h}t[0]=n,t[1]=i,t[2]=r}function w(t,e,n){this.x=t,this.y=e,this.count=1,this.estimatedModuleSize=n}function f(t){this.bottomLeft=t[0],this.topLeft=t[1],this.topRight=t[2]}function u(){this.image=null,this.possibleCenters=[],this.hasSkipped=!1,this.crossCheckStateCount=[0,0,0,0,0],this.resultPointCallback=null}function l(t,e,n,i,r,o,s,a,h){this.a11=t,this.a12=i,this.a13=s,this.a21=e,this.a22=r,this.a23=a,this.a31=n,this.a32=o,this.a33=h}function d(t,e){this.bits=t,this.points=e}function c(t){this.image=t,this.resultPointCallback=null}function p(t,e){if(null==e||0==e.length)throw"System.ArgumentException";this.field=t;var n=e.length;if(n>1&&0==e[0]){for(var i=1;i<n&&0==e[i];)i++;if(i==n)this.coefficients=t.Zero.coefficients;else{this.coefficients=new Array(n-i);for(var r=0;r<this.coefficients.length;r++)this.coefficients[r]=0;for(var o=0;o<this.coefficients.length;o++)this.coefficients[o]=e[i+o]}}else this.coefficients=e}function g(t){this.expTable=new Array(256),this.logTable=new Array(256);for(var e=1,n=0;n<256;n++)this.expTable[n]=e,(e<<=1)>=256&&(e^=t);for(n=0;n<255;n++)this.logTable[this.expTable[n]]=n;var i=new Array(1);i[0]=0,this.zero=new p(this,new Array(i));var r=new Array(1);r[0]=1,this.one=new p(this,new Array(r))}function v(t){this.field=t}function m(t){var e=t.Dimension;if(e<21||1!=(3&e))throw"Error BitMatrixParser";this.bitMatrix=t,this.parsedVersion=null,this.parsedFormatInfo=null}function b(t,e){this.numDataCodewords=t,this.codewords=e}function y(t,e,n){this.blockPointer=0,this.bitPointer=7,this.dataLength=0,this.blocks=t,this.numErrorCorrectionCode=n,e<=9?this.dataLengthMode=0:e>=10&&e<=26?this.dataLengthMode=1:e>=27&&e<=40&&(this.dataLengthMode=2)}function C(){this.imagedata=null,this.width=0,this.height=0,this.qrCodeSymbol=null,this.debug=!1,this.callback=null}function M(t,e){return t>=0?t>>e:(t>>e)+(2<<~e)}t.prototype.ordinal=function(){return this.ordinal_Renamed_Field},t.forBits=function(t){if(t<0||t>=k.length)throw"ArgumentException";return k[t]};var k=[new t(1,0,"M"),new t(0,1,"L"),new t(3,2,"H"),new t(2,3,"Q")],P=[[21522,0],[20773,1],[24188,2],[23371,3],[17913,4],[16590,5],[20375,6],[19104,7],[30660,8],[29427,9],[32170,10],[30877,11],[26159,12],[25368,13],[27713,14],[26998,15],[5769,16],[5054,17],[7399,18],[6608,19],[1890,20],[597,21],[3340,22],[2107,23],[13663,24],[12392,25],[16177,26],[14854,27],[9396,28],[8579,29],[11994,30],[11245,31]],N=[0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4];e.prototype.GetHashCode=function(){return this.errorCorrectionLevel.ordinal()<<3|this.dataMask},e.prototype.Equals=function(t){var e=t;return this.errorCorrectionLevel==e.errorCorrectionLevel&&this.dataMask==e.dataMask},e.numBitsDiffering=function(t,e){return t^=e,N[15&t]+N[15&M(t,4)]+N[15&M(t,8)]+N[15&M(t,12)]+N[15&M(t,16)]+N[15&M(t,20)]+N[15&M(t,24)]+N[15&M(t,28)]},e.decodeFormatInformation=function(t){var n=e.doDecodeFormatInformation(t);return null!=n?n:e.doDecodeFormatInformation(21522^t)},e.doDecodeFormatInformation=function(t){for(var n=4294967295,i=0,r=0;r<P.length;r++){var o=P[r],s=o[0];if(s==t)return new e(o[1]);var a=this.numBitsDiffering(t,s);a<n&&(i=o[1],n=a)}return n<=3?new e(i):null},Object.defineProperty(n.prototype,"Dimension",{get:function(){if(this.width!=this.height)throw"Can't call getDimension() on a non-square matrix";return this.width}}),n.prototype.get_Renamed=function(t,e){var n=e*this.rowSize+(t>>5);return 0!=(1&M(this.bits[n],31&t))},n.prototype.set_Renamed=function(t,e){var n=e*this.rowSize+(t>>5);this.bits[n]|=1<<(31&t)},n.prototype.flip=function(t,e){var n=e*this.rowSize+(t>>5);this.bits[n]^=1<<(31&t)},n.prototype.clear=function(){for(var t=this.bits.length,e=0;e<t;e++)this.bits[e]=0},n.prototype.setRegion=function(t,e,n,i){if(e<0||t<0)throw"Left and top must be nonnegative";if(i<1||n<1)throw"Height and width must be at least 1";var r=t+n,o=e+i;if(o>this.height||r>this.width)throw"The region must fit inside the matrix";for(var s=e;s<o;s++)for(var a=s*this.rowSize,h=t;h<r;h++)this.bits[a+(h>>5)]|=1<<(31&h)},Object.defineProperty(r.prototype,"TotalECCodewords",{get:function(){return this.ecCodewordsPerBlock*this.NumBlocks}}),Object.defineProperty(r.prototype,"NumBlocks",{get:function(){for(var t=0,e=0;e<this.ecBlocks.length;e++)t+=this.ecBlocks[e].length;return t}}),r.prototype.getECBlocks=function(){return this.ecBlocks},Object.defineProperty(o.prototype,"DimensionForVersion",{get:function(){return 17+4*this.versionNumber}}),o.prototype.buildFunctionPattern=function(){var t=this.DimensionForVersion,e=new n(t);e.setRegion(0,0,9,9),e.setRegion(t-8,0,8,9),e.setRegion(0,t-8,9,8);for(var i=this.alignmentPatternCenters.length,r=0;r<i;r++)for(var o=this.alignmentPatternCenters[r]-2,s=0;s<i;s++)0==r&&(0==s||s==i-1)||r==i-1&&0==s||e.setRegion(this.alignmentPatternCenters[s]-2,o,5,5);return e.setRegion(6,9,1,t-17),e.setRegion(9,6,t-17,1),this.versionNumber>6&&(e.setRegion(t-11,0,3,6),e.setRegion(0,t-11,6,3)),e},o.prototype.getECBlocksForLevel=function(t){return this.ecBlocks[t.ordinal()]},o.VERSION_DECODE_INFO=[31892,34236,39577,42195,48118,51042,55367,58893,63784,68472,70749,76311,79154,84390,87683,92361,96236,102084,102881,110507,110734,117786,119615,126325,127568,133589,136944,141498,145311,150283,152622,158308,161089,167017],o.VERSIONS=[new o(1,[],new r(7,new i(1,19)),new r(10,new i(1,16)),new r(13,new i(1,13)),new r(17,new i(1,9))),new o(2,[6,18],new r(10,new i(1,34)),new r(16,new i(1,28)),new r(22,new i(1,22)),new r(28,new i(1,16))),new o(3,[6,22],new r(15,new i(1,55)),new r(26,new i(1,44)),new r(18,new i(2,17)),new r(22,new i(2,13))),new o(4,[6,26],new r(20,new i(1,80)),new r(18,new i(2,32)),new r(26,new i(2,24)),new r(16,new i(4,9))),new o(5,[6,30],new r(26,new i(1,108)),new r(24,new i(2,43)),new r(18,new i(2,15),new i(2,16)),new r(22,new i(2,11),new i(2,12))),new o(6,[6,34],new r(18,new i(2,68)),new r(16,new i(4,27)),new r(24,new i(4,19)),new r(28,new i(4,15))),new o(7,[6,22,38],new r(20,new i(2,78)),new r(18,new i(4,31)),new r(18,new i(2,14),new i(4,15)),new r(26,new i(4,13),new i(1,14))),new o(8,[6,24,42],new r(24,new i(2,97)),new r(22,new i(2,38),new i(2,39)),new r(22,new i(4,18),new i(2,19)),new r(26,new i(4,14),new i(2,15))),new o(9,[6,26,46],new r(30,new i(2,116)),new r(22,new i(3,36),new i(2,37)),new r(20,new i(4,16),new i(4,17)),new r(24,new i(4,12),new i(4,13))),new o(10,[6,28,50],new r(18,new i(2,68),new i(2,69)),new r(26,new i(4,43),new i(1,44)),new r(24,new i(6,19),new i(2,20)),new r(28,new i(6,15),new i(2,16))),new o(11,[6,30,54],new r(20,new i(4,81)),new r(30,new i(1,50),new i(4,51)),new r(28,new i(4,22),new i(4,23)),new r(24,new i(3,12),new i(8,13))),new o(12,[6,32,58],new r(24,new i(2,92),new i(2,93)),new r(22,new i(6,36),new i(2,37)),new r(26,new i(4,20),new i(6,21)),new r(28,new i(7,14),new i(4,15))),new o(13,[6,34,62],new r(26,new i(4,107)),new r(22,new i(8,37),new i(1,38)),new r(24,new i(8,20),new i(4,21)),new r(22,new i(12,11),new i(4,12))),new o(14,[6,26,46,66],new r(30,new i(3,115),new i(1,116)),new r(24,new i(4,40),new i(5,41)),new r(20,new i(11,16),new i(5,17)),new r(24,new i(11,12),new i(5,13))),new o(15,[6,26,48,70],new r(22,new i(5,87),new i(1,88)),new r(24,new i(5,41),new i(5,42)),new r(30,new i(5,24),new i(7,25)),new r(24,new i(11,12),new i(7,13))),new o(16,[6,26,50,74],new r(24,new i(5,98),new i(1,99)),new r(28,new i(7,45),new i(3,46)),new r(24,new i(15,19),new i(2,20)),new r(30,new i(3,15),new i(13,16))),new o(17,[6,30,54,78],new r(28,new i(1,107),new i(5,108)),new r(28,new i(10,46),new i(1,47)),new r(28,new i(1,22),new i(15,23)),new r(28,new i(2,14),new i(17,15))),new o(18,[6,30,56,82],new r(30,new i(5,120),new i(1,121)),new r(26,new i(9,43),new i(4,44)),new r(28,new i(17,22),new i(1,23)),new r(28,new i(2,14),new i(19,15))),new o(19,[6,30,58,86],new r(28,new i(3,113),new i(4,114)),new r(26,new i(3,44),new i(11,45)),new r(26,new i(17,21),new i(4,22)),new r(26,new i(9,13),new i(16,14))),new o(20,[6,34,62,90],new r(28,new i(3,107),new i(5,108)),new r(26,new i(3,41),new i(13,42)),new r(30,new i(15,24),new i(5,25)),new r(28,new i(15,15),new i(10,16))),new o(21,[6,28,50,72,94],new r(28,new i(4,116),new i(4,117)),new r(26,new i(17,42)),new r(28,new i(17,22),new i(6,23)),new r(30,new i(19,16),new i(6,17))),new o(22,[6,26,50,74,98],new r(28,new i(2,111),new i(7,112)),new r(28,new i(17,46)),new r(30,new i(7,24),new i(16,25)),new r(24,new i(34,13))),new o(23,[6,30,54,74,102],new r(30,new i(4,121),new i(5,122)),new r(28,new i(4,47),new i(14,48)),new r(30,new i(11,24),new i(14,25)),new r(30,new i(16,15),new i(14,16))),new o(24,[6,28,54,80,106],new r(30,new i(6,117),new i(4,118)),new r(28,new i(6,45),new i(14,46)),new r(30,new i(11,24),new i(16,25)),new r(30,new i(30,16),new i(2,17))),new o(25,[6,32,58,84,110],new r(26,new i(8,106),new i(4,107)),new r(28,new i(8,47),new i(13,48)),new r(30,new i(7,24),new i(22,25)),new r(30,new i(22,15),new i(13,16))),new o(26,[6,30,58,86,114],new r(28,new i(10,114),new i(2,115)),new r(28,new i(19,46),new i(4,47)),new r(28,new i(28,22),new i(6,23)),new r(30,new i(33,16),new i(4,17))),new o(27,[6,34,62,90,118],new r(30,new i(8,122),new i(4,123)),new r(28,new i(22,45),new i(3,46)),new r(30,new i(8,23),new i(26,24)),new r(30,new i(12,15),new i(28,16))),new o(28,[6,26,50,74,98,122],new r(30,new i(3,117),new i(10,118)),new r(28,new i(3,45),new i(23,46)),new r(30,new i(4,24),new i(31,25)),new r(30,new i(11,15),new i(31,16))),new o(29,[6,30,54,78,102,126],new r(30,new i(7,116),new i(7,117)),new r(28,new i(21,45),new i(7,46)),new r(30,new i(1,23),new i(37,24)),new r(30,new i(19,15),new i(26,16))),new o(30,[6,26,52,78,104,130],new r(30,new i(5,115),new i(10,116)),new r(28,new i(19,47),new i(10,48)),new r(30,new i(15,24),new i(25,25)),new r(30,new i(23,15),new i(25,16))),new o(31,[6,30,56,82,108,134],new r(30,new i(13,115),new i(3,116)),new r(28,new i(2,46),new i(29,47)),new r(30,new i(42,24),new i(1,25)),new r(30,new i(23,15),new i(28,16))),new o(32,[6,34,60,86,112,138],new r(30,new i(17,115)),new r(28,new i(10,46),new i(23,47)),new r(30,new i(10,24),new i(35,25)),new r(30,new i(19,15),new i(35,16))),new o(33,[6,30,58,86,114,142],new r(30,new i(17,115),new i(1,116)),new r(28,new i(14,46),new i(21,47)),new r(30,new i(29,24),new i(19,25)),new r(30,new i(11,15),new i(46,16))),new o(34,[6,34,62,90,118,146],new r(30,new i(13,115),new i(6,116)),new r(28,new i(14,46),new i(23,47)),new r(30,new i(44,24),new i(7,25)),new r(30,new i(59,16),new i(1,17))),new o(35,[6,30,54,78,102,126,150],new r(30,new i(12,121),new i(7,122)),new r(28,new i(12,47),new i(26,48)),new r(30,new i(39,24),new i(14,25)),new r(30,new i(22,15),new i(41,16))),new o(36,[6,24,50,76,102,128,154],new r(30,new i(6,121),new i(14,122)),new r(28,new i(6,47),new i(34,48)),new r(30,new i(46,24),new i(10,25)),new r(30,new i(2,15),new i(64,16))),new o(37,[6,28,54,80,106,132,158],new r(30,new i(17,122),new i(4,123)),new r(28,new i(29,46),new i(14,47)),new r(30,new i(49,24),new i(10,25)),new r(30,new i(24,15),new i(46,16))),new o(38,[6,32,58,84,110,136,162],new r(30,new i(4,122),new i(18,123)),new r(28,new i(13,46),new i(32,47)),new r(30,new i(48,24),new i(14,25)),new r(30,new i(42,15),new i(32,16))),new o(39,[6,26,54,82,110,138,166],new r(30,new i(20,117),new i(4,118)),new r(28,new i(40,47),new i(7,48)),new r(30,new i(43,24),new i(22,25)),new r(30,new i(10,15),new i(67,16))),new o(40,[6,30,58,86,114,142,170],new r(30,new i(19,118),new i(6,119)),new r(28,new i(18,47),new i(31,48)),new r(30,new i(34,24),new i(34,25)),new r(30,new i(20,15),new i(61,16)))],o.getVersionForNumber=function(t){if(t<1||t>40)throw"ArgumentException";return o.VERSIONS[t-1]},o.getProvisionalVersionForDimension=function(t){if(t%4!=1)throw"Error getProvisionalVersionForDimension";try{return o.getVersionForNumber(t-17>>2)}catch(t){throw"Error getVersionForNumber"}},o.decodeVersionInformation=function(t){for(var n=4294967295,i=0,r=0;r<o.VERSION_DECODE_INFO.length;r++){var s=o.VERSION_DECODE_INFO[r];if(s==t)return this.getVersionForNumber(r+7);var a=e.numBitsDiffering(t,s);a<n&&(i=r+7,n=a)}return n<=3?this.getVersionForNumber(i):null},Object.defineProperty(s.prototype,"X",{get:function(){return Math.floor(this.x)}}),Object.defineProperty(s.prototype,"Y",{get:function(){return Math.floor(this.y)}}),s.prototype.incrementCount=function(){this.count++},s.prototype.aboutEquals=function(t,e,n){if(Math.abs(e-this.y)<=t&&Math.abs(n-this.x)<=t){var i=Math.abs(t-this.estimatedModuleSize);return i<=1||i/this.estimatedModuleSize<=1}return!1},a.prototype.centerFromEnd=function(t,e){return e-t[2]-t[1]/2},a.prototype.foundPatternCross=function(t){for(var e=this.moduleSize,n=e/2,i=0;i<3;i++)if(Math.abs(e-t[i])>=n)return!1;return!0},a.prototype.crossCheckVertical=function(t,e,n,i){var r=this.image,o=r.height,s=this.crossCheckStateCount;s[0]=0,s[1]=0,s[2]=0;for(var a=t;a>=0&&r.data[e+a*r.width]&&s[1]<=n;)s[1]++,a--;if(a<0||s[1]>n)return NaN;for(;a>=0&&!r.data[e+a*r.width]&&s[0]<=n;)s[0]++,a--;if(s[0]>n)return NaN;for(a=t+1;a<o&&r.data[e+a*r.width]&&s[1]<=n;)s[1]++,a++;if(a==o||s[1]>n)return NaN;for(;a<o&&!r.data[e+a*r.width]&&s[2]<=n;)s[2]++,a++;if(s[2]>n)return NaN;var h=s[0]+s[1]+s[2];return 5*Math.abs(h-i)>=2*i?NaN:this.foundPatternCross(s)?this.centerFromEnd(s,a):NaN},a.prototype.handlePossibleCenter=function(t,e,n){var i=t[0]+t[1]+t[2],r=this.centerFromEnd(t,n),o=this.crossCheckVertical(e,Math.floor(r),2*t[1],i);if(!isNaN(o)){for(var a=(t[0]+t[1]+t[2])/3,h=this.possibleCenters.length,w=0;w<h;w++)if(this.possibleCenters[w].aboutEquals(a,o,r))return new s(r,o,a);var f=new s(r,o,a);this.possibleCenters.push(f),null!=this.resultPointCallback&&this.resultPointCallback.foundPossibleResultPoint(f)}return null},a.prototype.find=function(){for(var t=this.image,e=this.startX,n=this.height,i=e+this.width,r=this.startY+(n>>1),o=[0,0,0],s=0;s<n;s++){var a=r+(0==(1&s)?s+1>>1:-(s+1>>1));o[0]=0,o[1]=0,o[2]=0;for(var h=e;h<i&&!t.data[h+t.width*a];)h++;for(var w=0;h<i;){if(t.data[h+a*t.width])if(1==w)o[w]++;else if(2==w){if(this.foundPatternCross(o)&&null!=(f=this.handlePossibleCenter(o,a,h)))return f;o[0]=o[2],o[1]=1,o[2]=0,w=1}else o[++w]++;else 1==w&&w++,o[w]++;h++}if(this.foundPatternCross(o)){var f=this.handlePossibleCenter(o,a,i);if(null!=f)return f}}if(0!=this.possibleCenters.length)return this.possibleCenters[0];throw"Couldn't find enough alignment patterns"};var S={};S.checkAndNudgePoints=function(t,e){for(var n=t.width,i=t.height,r=!0,o=0;o<e.length&&r;o+=2){var s=Math.floor(e[o]),a=Math.floor(e[o+1]);if(s<-1||s>n||a<-1||a>i)throw"Error.checkAndNudgePoints ";r=!1,-1==s?(e[o]=0,r=!0):s==n&&(e[o]=n-1,r=!0),-1==a?(e[o+1]=0,r=!0):a==i&&(e[o+1]=i-1,r=!0)}r=!0;for(o=e.length-2;o>=0&&r;o-=2){var s=Math.floor(e[o]),a=Math.floor(e[o+1]);if(s<-1||s>n||a<-1||a>i)throw"Error.checkAndNudgePoints ";r=!1,-1==s?(e[o]=0,r=!0):s==n&&(e[o]=n-1,r=!0),-1==a?(e[o+1]=0,r=!0):a==i&&(e[o+1]=i-1,r=!0)}},S.sampleGrid3=function(t,e,i){for(var r=new n(e),o=new Array(e<<1),s=0;s<e;s++){for(var a=o.length,h=s+.5,w=0;w<a;w+=2)o[w]=.5+(w>>1),o[w+1]=h;i.transformPoints1(o),S.checkAndNudgePoints(t,o);try{for(w=0;w<a;w+=2)t.data[Math.floor(o[w])+t.width*Math.floor(o[w+1])]&&r.set_Renamed(w>>1,s)}catch(t){throw"Error.checkAndNudgePoints"}}return r};Object.defineProperty(w.prototype,"X",{get:function(){return this.x}}),Object.defineProperty(w.prototype,"Y",{get:function(){return this.y}}),w.prototype.incrementCount=function(){this.count++},w.prototype.aboutEquals=function(t,e,n){if(Math.abs(e-this.y)<=t&&Math.abs(n-this.x)<=t){var i=Math.abs(t-this.estimatedModuleSize);return i<=1||i/this.estimatedModuleSize<=1}return!1},Object.defineProperty(u.prototype,"CrossCheckStateCount",{get:function(){return this.crossCheckStateCount[0]=0,this.crossCheckStateCount[1]=0,this.crossCheckStateCount[2]=0,this.crossCheckStateCount[3]=0,this.crossCheckStateCount[4]=0,this.crossCheckStateCount}}),u.prototype.foundPatternCross=function(t){for(var e=0,n=0;n<5;n++){var i=t[n];if(0==i)return!1;e+=i}if(e<7)return!1;var r=Math.floor((e<<8)/7),o=Math.floor(r/2);return Math.abs(r-(t[0]<<8))<o&&Math.abs(r-(t[1]<<8))<o&&Math.abs(3*r-(t[2]<<8))<3*o&&Math.abs(r-(t[3]<<8))<o&&Math.abs(r-(t[4]<<8))<o},u.prototype.centerFromEnd=function(t,e){return e-t[4]-t[3]-t[2]/2},u.prototype.crossCheckVertical=function(t,e,n,i){for(var r=this.image,o=r.height,s=this.CrossCheckStateCount,a=t;a>=0&&r.data[e+a*r.width];)s[2]++,a--;if(a<0)return NaN;for(;a>=0&&!r.data[e+a*r.width]&&s[1]<=n;)s[1]++,a--;if(a<0||s[1]>n)return NaN;for(;a>=0&&r.data[e+a*r.width]&&s[0]<=n;)s[0]++,a--;if(s[0]>n)return NaN;for(a=t+1;a<o&&r.data[e+a*r.width];)s[2]++,a++;if(a==o)return NaN;for(;a<o&&!r.data[e+a*r.width]&&s[3]<n;)s[3]++,a++;if(a==o||s[3]>=n)return NaN;for(;a<o&&r.data[e+a*r.width]&&s[4]<n;)s[4]++,a++;if(s[4]>=n)return NaN;var h=s[0]+s[1]+s[2]+s[3]+s[4];return 5*Math.abs(h-i)>=2*i?NaN:this.foundPatternCross(s)?this.centerFromEnd(s,a):NaN},u.prototype.crossCheckHorizontal=function(t,e,n,i){for(var r=this.image,o=r.width,s=this.CrossCheckStateCount,a=t;a>=0&&r.data[a+e*r.width];)s[2]++,a--;if(a<0)return NaN;for(;a>=0&&!r.data[a+e*r.width]&&s[1]<=n;)s[1]++,a--;if(a<0||s[1]>n)return NaN;for(;a>=0&&r.data[a+e*r.width]&&s[0]<=n;)s[0]++,a--;if(s[0]>n)return NaN;for(a=t+1;a<o&&r.data[a+e*r.width];)s[2]++,a++;if(a==o)return NaN;for(;a<o&&!r.data[a+e*r.width]&&s[3]<n;)s[3]++,a++;if(a==o||s[3]>=n)return NaN;for(;a<o&&r.data[a+e*r.width]&&s[4]<n;)s[4]++,a++;if(s[4]>=n)return NaN;var h=s[0]+s[1]+s[2]+s[3]+s[4];return 5*Math.abs(h-i)>=i?NaN:this.foundPatternCross(s)?this.centerFromEnd(s,a):NaN},u.prototype.handlePossibleCenter=function(t,e,n){var i=t[0]+t[1]+t[2]+t[3]+t[4],r=this.centerFromEnd(t,n),o=this.crossCheckVertical(e,Math.floor(r),t[2],i);if(!isNaN(o)&&(r=this.crossCheckHorizontal(Math.floor(r),Math.floor(o),t[2],i),!isNaN(r))){for(var s=i/7,a=!1,h=this.possibleCenters.length,f=0;f<h;f++){var u=this.possibleCenters[f];if(u.aboutEquals(s,o,r)){u.incrementCount(),a=!0;break}}if(!a){var l=new w(r,o,s);this.possibleCenters.push(l),null!=this.resultPointCallback&&this.resultPointCallback.foundPossibleResultPoint(l)}return!0}return!1},u.prototype.selectBestPatterns=function(){var t=this.possibleCenters.length;if(t<3)throw"Couldn't find enough finder patterns:"+t+" patterns found";if(t>3){for(var e=0,n=0,i=0;i<t;i++){var r=this.possibleCenters[i].estimatedModuleSize;e+=r,n+=r*r}var o=e/t;this.possibleCenters.sort(function(t,e){var n=Math.abs(e.estimatedModuleSize-o),i=Math.abs(t.estimatedModuleSize-o);return n<i?-1:n==i?0:1});for(var s=Math.sqrt(n/t-o*o),a=Math.max(.2*o,s),i=this.possibleCenters-1;i>=0;i--){var h=this.possibleCenters[i];Math.abs(h.estimatedModuleSize-o)>a&&this.possibleCenters.splice(i,1)}}return this.possibleCenters.length>3&&this.possibleCenters.sort(function(t,e){return t.count>e.count?-1:t.count<e.count?1:0}),[this.possibleCenters[0],this.possibleCenters[1],this.possibleCenters[2]]},u.prototype.findRowSkip=function(){var t=this.possibleCenters.length;if(t<=1)return 0;for(var e=null,n=0;n<t;n++){var i=this.possibleCenters[n];if(i.count>=2){if(null!=e)return this.hasSkipped=!0,Math.floor((Math.abs(e.X-i.X)-Math.abs(e.Y-i.Y))/2);e=i}}return 0},u.prototype.haveMultiplyConfirmedCenters=function(){for(var t=0,e=0,n=this.possibleCenters.length,i=0;i<n;i++){var r=this.possibleCenters[i];r.count>=2&&(t++,e+=r.estimatedModuleSize)}if(t<3)return!1;for(var o=e/n,s=0,i=0;i<n;i++)r=this.possibleCenters[i],s+=Math.abs(r.estimatedModuleSize-o);return s<=.05*e},u.prototype.findFinderPattern=function(t){this.image=t;var e=t.height,n=t.width,i=Math.floor(3*e/228);i<3&&(i=3);for(var r=!1,o=new Array(5),s=i-1;s<e&&!r;s+=i){o[0]=0,o[1]=0,o[2]=0,o[3]=0,o[4]=0;for(var a=0,w=0;w<n;w++)if(t.data[w+s*t.width])1==(1&a)&&a++,o[a]++;else if(0==(1&a))if(4==a)if(this.foundPatternCross(o)){if(l=this.handlePossibleCenter(o,s,w))if(i=2,this.hasSkipped)r=this.haveMultiplyConfirmedCenters();else{var u=this.findRowSkip();u>o[2]&&(s+=u-o[2]-i,w=n-1)}else{do{w++}while(w<n&&!t.data[w+s*t.width]);w--}a=0,o[0]=0,o[1]=0,o[2]=0,o[3]=0,o[4]=0}else o[0]=o[2],o[1]=o[3],o[2]=o[4],o[3]=1,o[4]=0,a=3;else o[++a]++;else o[a]++;if(this.foundPatternCross(o)){var l=this.handlePossibleCenter(o,s,n);l&&(i=o[0],this.hasSkipped&&(r=this.haveMultiplyConfirmedCenters()))}}var d=this.selectBestPatterns();return h(d),new f(d)},l.prototype.transformPoints1=function(t){for(var e=t.length,n=this.a11,i=this.a12,r=this.a13,o=this.a21,s=this.a22,a=this.a23,h=this.a31,w=this.a32,f=this.a33,u=0;u<e;u+=2){var l=t[u],d=t[u+1],c=r*l+a*d+f;t[u]=(n*l+o*d+h)/c,t[u+1]=(i*l+s*d+w)/c}},l.prototype.transformPoints2=function(t,e){for(var n=t.length,i=0;i<n;i++){var r=t[i],o=e[i],s=this.a13*r+this.a23*o+this.a33;t[i]=(this.a11*r+this.a21*o+this.a31)/s,e[i]=(this.a12*r+this.a22*o+this.a32)/s}},l.prototype.buildAdjoint=function(){return new l(this.a22*this.a33-this.a23*this.a32,this.a23*this.a31-this.a21*this.a33,this.a21*this.a32-this.a22*this.a31,this.a13*this.a32-this.a12*this.a33,this.a11*this.a33-this.a13*this.a31,this.a12*this.a31-this.a11*this.a32,this.a12*this.a23-this.a13*this.a22,this.a13*this.a21-this.a11*this.a23,this.a11*this.a22-this.a12*this.a21)},l.prototype.times=function(t){return new l(this.a11*t.a11+this.a21*t.a12+this.a31*t.a13,this.a11*t.a21+this.a21*t.a22+this.a31*t.a23,this.a11*t.a31+this.a21*t.a32+this.a31*t.a33,this.a12*t.a11+this.a22*t.a12+this.a32*t.a13,this.a12*t.a21+this.a22*t.a22+this.a32*t.a23,this.a12*t.a31+this.a22*t.a32+this.a32*t.a33,this.a13*t.a11+this.a23*t.a12+this.a33*t.a13,this.a13*t.a21+this.a23*t.a22+this.a33*t.a23,this.a13*t.a31+this.a23*t.a32+this.a33*t.a33)},l.quadrilateralToQuadrilateral=function(t,e,n,i,r,o,s,a,h,w,f,u,l,d,c,p){var g=this.quadrilateralToSquare(t,e,n,i,r,o,s,a);return this.squareToQuadrilateral(h,w,f,u,l,d,c,p).times(g)},l.squareToQuadrilateral=function(t,e,n,i,r,o,s,a){var h=a-o,w=e-i+o-a;if(0==h&&0==w)return new l(n-t,r-n,t,i-e,o-i,e,0,0,1);var f=n-r,u=s-r,d=t-n+r-s,c=i-o,p=f*h-u*c,g=(d*h-u*w)/p,v=(f*w-d*c)/p;return new l(n-t+g*n,s-t+v*s,t,i-e+g*i,a-e+v*a,e,g,v,1)},l.quadrilateralToSquare=function(t,e,n,i,r,o,s,a){return this.squareToQuadrilateral(t,e,n,i,r,o,s,a).buildAdjoint()},c.prototype.sizeOfBlackWhiteBlackRun=function(t,e,n,i){var r=Math.abs(i-e)>Math.abs(n-t);if(r){var o=t;t=e,e=o,o=n,n=i,i=o}for(var s=Math.abs(n-t),a=Math.abs(i-e),h=-s>>1,w=e<i?1:-1,f=t<n?1:-1,u=0,l=t,d=e;l!=n;l+=f){var c=r?d:l,p=r?l:d;if(1==u?this.image.data[c+p*this.image.width]&&u++:this.image.data[c+p*this.image.width]||u++,3==u){var g=l-t,v=d-e;return Math.sqrt(g*g+v*v)}if((h+=a)>0){if(d==i)break;d+=w,h-=s}}var m=n-t,b=i-e;return Math.sqrt(m*m+b*b)},c.prototype.sizeOfBlackWhiteBlackRunBothWays=function(t,e,n,i){var r=this.sizeOfBlackWhiteBlackRun(t,e,n,i),o=1,s=t-(n-t);s<0?(o=t/(t-s),s=0):s>=this.image.width&&(o=(this.image.width-1-t)/(s-t),s=this.image.width-1);var a=Math.floor(e-(i-e)*o);return o=1,a<0?(o=e/(e-a),a=0):a>=this.image.height&&(o=(this.image.height-1-e)/(a-e),a=this.image.height-1),s=Math.floor(t+(s-t)*o),(r+=this.sizeOfBlackWhiteBlackRun(t,e,s,a))-1},c.prototype.calculateModuleSizeOneWay=function(t,e){var n=this.sizeOfBlackWhiteBlackRunBothWays(Math.floor(t.X),Math.floor(t.Y),Math.floor(e.X),Math.floor(e.Y)),i=this.sizeOfBlackWhiteBlackRunBothWays(Math.floor(e.X),Math.floor(e.Y),Math.floor(t.X),Math.floor(t.Y));return isNaN(n)?i/7:isNaN(i)?n/7:(n+i)/14},c.prototype.calculateModuleSize=function(t,e,n){return(this.calculateModuleSizeOneWay(t,e)+this.calculateModuleSizeOneWay(t,n))/2},c.prototype.distance=function(t,e){var n=t.X-e.X,i=t.Y-e.Y;return Math.sqrt(n*n+i*i)},c.prototype.computeDimension=function(t,e,n,i){var r=7+(Math.round(this.distance(t,e)/i)+Math.round(this.distance(t,n)/i)>>1);switch(3&r){case 0:r++;break;case 2:r--;break;case 3:throw"Error"}return r},c.prototype.findAlignmentInRegion=function(t,e,n,i){var r=Math.floor(i*t),o=Math.max(0,e-r),s=Math.min(this.image.width-1,e+r);if(s-o<3*t)throw"Error";var h=Math.max(0,n-r),w=Math.min(this.image.height-1,n+r);return new a(this.image,o,h,s-o,w-h,t,this.resultPointCallback).find()},c.prototype.createTransform=function(t,e,n,i,r){var o,s,a,h,w=r-3.5;return null!=i?(o=i.X,s=i.Y,a=h=w-3):(o=e.X-t.X+n.X,s=e.Y-t.Y+n.Y,a=h=w),l.quadrilateralToQuadrilateral(3.5,3.5,w,3.5,a,h,3.5,w,t.X,t.Y,e.X,e.Y,o,s,n.X,n.Y)},c.prototype.sampleGrid=function(t,e,n){return S.sampleGrid3(t,n,e)},c.prototype.processFinderPatternInfo=function(t){var e=t.topLeft,n=t.topRight,i=t.bottomLeft,r=this.calculateModuleSize(e,n,i);if(r<1)throw"Error";var s=this.computeDimension(e,n,i,r),a=o.getProvisionalVersionForDimension(s),h=a.DimensionForVersion-7,w=null;if(a.alignmentPatternCenters.length>0)for(var f=n.X-e.X+i.X,u=n.Y-e.Y+i.Y,l=1-3/h,c=Math.floor(e.X+l*(f-e.X)),p=Math.floor(e.Y+l*(u-e.Y)),g=4;g<=16;g<<=1){w=this.findAlignmentInRegion(r,c,p,g);break}var v,m=this.createTransform(e,n,i,w,s),b=this.sampleGrid(this.image,m,s);return v=null==w?[i,e,n]:[i,e,n,w],new d(b,v)},c.prototype.detect=function(){var t=(new u).findFinderPattern(this.image);return this.processFinderPatternInfo(t)},Object.defineProperty(p.prototype,"Zero",{get:function(){return 0==this.coefficients[0]}}),Object.defineProperty(p.prototype,"Degree",{get:function(){return this.coefficients.length-1}}),p.prototype.getCoefficient=function(t){return this.coefficients[this.coefficients.length-1-t]},p.prototype.evaluateAt=function(t){if(0==t)return this.getCoefficient(0);var e=this.coefficients.length;if(1==t){for(var n=0,i=0;i<e;i++)n=this.field.addOrSubtract(n,this.coefficients[i]);return n}for(var r=this.coefficients[0],i=1;i<e;i++)r=this.field.addOrSubtract(this.field.multiply(t,r),this.coefficients[i]);return r},p.prototype.addOrSubtract=function(t){if(this.field!=t.field)throw"GF256Polys do not have same GF256 field";if(this.Zero)return t;if(t.Zero)return this;var e=this.coefficients,n=t.coefficients;if(e.length>n.length){var i=e;e=n,n=i}for(var r=new Array(n.length),o=n.length-e.length,s=0;s<o;s++)r[s]=n[s];for(var a=o;a<n.length;a++)r[a]=this.field.addOrSubtract(e[a-o],n[a]);return new p(this.field,r)},p.prototype.multiply1=function(t){if(this.field!=t.field)throw"GF256Polys do not have same GF256 field";if(this.Zero||t.Zero)return this.field.Zero;for(var e=this.coefficients,n=e.length,i=t.coefficients,r=i.length,o=new Array(n+r-1),s=0;s<n;s++)for(var a=e[s],h=0;h<r;h++)o[s+h]=this.field.addOrSubtract(o[s+h],this.field.multiply(a,i[h]));return new p(this.field,o)},p.prototype.multiply2=function(t){if(0==t)return this.field.Zero;if(1==t)return this;for(var e=this.coefficients.length,n=new Array(e),i=0;i<e;i++)n[i]=this.field.multiply(this.coefficients[i],t);return new p(this.field,n)},p.prototype.multiplyByMonomial=function(t,e){if(t<0)throw"System.ArgumentException";if(0==e)return this.field.Zero;for(var n=this.coefficients.length,i=new Array(n+t),r=0;r<i.length;r++)i[r]=0;for(r=0;r<n;r++)i[r]=this.field.multiply(this.coefficients[r],e);return new p(this.field,i)},p.prototype.divide=function(t){if(this.field!=t.field)throw"GF256Polys do not have same GF256 field";if(t.Zero)throw"Divide by 0";for(var e=this.field.Zero,n=this,i=t.getCoefficient(t.Degree),r=this.field.inverse(i);n.Degree>=t.Degree&&!n.Zero;){var o=n.Degree-t.Degree,s=this.field.multiply(n.getCoefficient(n.Degree),r),a=t.multiplyByMonomial(o,s),h=this.field.buildMonomial(o,s);e=e.addOrSubtract(h),n=n.addOrSubtract(a)}return[e,n]},Object.defineProperty(g.prototype,"Zero",{get:function(){return this.zero}}),Object.defineProperty(g.prototype,"One",{get:function(){return this.one}}),g.prototype.buildMonomial=function(t,e){if(t<0)throw"System.ArgumentException";if(0==e)return this.zero;for(var n=new Array(t+1),i=0;i<n.length;i++)n[i]=0;return n[0]=e,new p(this,n)},g.prototype.exp=function(t){return this.expTable[t]},g.prototype.log=function(t){if(0==t)throw"System.ArgumentException";return this.logTable[t]},g.prototype.inverse=function(t){if(0==t)throw"System.ArithmeticException";return this.expTable[255-this.logTable[t]]},g.prototype.addOrSubtract=function(t,e){return t^e},g.prototype.multiply=function(t,e){return 0==t||0==e?0:1==t?e:1==e?t:this.expTable[(this.logTable[t]+this.logTable[e])%255]},g.QR_CODE_FIELD=new g(285),g.DATA_MATRIX_FIELD=new g(301),v.prototype.decode=function(t,e){for(var n=new p(this.field,t),i=new Array(e),r=0;r<i.length;r++)i[r]=0;for(var o=!0,r=0;r<e;r++){var s=n.evaluateAt(this.field.exp(r));i[i.length-1-r]=s,0!=s&&(o=!1)}if(!o)for(var a=new p(this.field,i),h=this.runEuclideanAlgorithm(this.field.buildMonomial(e,1),a,e),w=h[0],f=h[1],u=this.findErrorLocations(w),l=this.findErrorMagnitudes(f,u,!1),r=0;r<u.length;r++){var d=t.length-1-this.field.log(u[r]);if(d<0)throw"ReedSolomonException Bad error location";t[d]=g.prototype.addOrSubtract(t[d],l[r])}},v.prototype.runEuclideanAlgorithm=function(t,e,n){if(t.Degree<e.Degree){var i=t;t=e,e=i}for(var r=t,o=e,s=this.field.One,a=this.field.Zero,h=this.field.Zero,w=this.field.One;o.Degree>=Math.floor(n/2);){var f=r,u=s,l=h;if(r=o,s=a,h=w,r.Zero)throw"r_{i-1} was zero";o=f;for(var d=this.field.Zero,c=r.getCoefficient(r.Degree),p=this.field.inverse(c);o.Degree>=r.Degree&&!o.Zero;){var g=o.Degree-r.Degree,v=this.field.multiply(o.getCoefficient(o.Degree),p);d=d.addOrSubtract(this.field.buildMonomial(g,v)),o=o.addOrSubtract(r.multiplyByMonomial(g,v))}a=d.multiply1(s).addOrSubtract(u),w=d.multiply1(h).addOrSubtract(l)}var m=w.getCoefficient(0);if(0==m)throw"ReedSolomonException sigmaTilde(0) was zero";var b=this.field.inverse(m);return[w.multiply2(b),o.multiply2(b)]},v.prototype.findErrorLocations=function(t){var e=t.Degree;if(1==e)return new Array(t.getCoefficient(1));for(var n=new Array(e),i=0,r=1;r<256&&i<e;r++)0==t.evaluateAt(r)&&(n[i]=this.field.inverse(r),i++);if(i!=e)throw"Error locator degree does not match number of roots";return n},v.prototype.findErrorMagnitudes=function(t,e,n){for(var i=e.length,r=new Array(i),o=0;o<i;o++){for(var s=this.field.inverse(e[o]),a=1,h=0;h<i;h++)o!=h&&(a=this.field.multiply(a,g.prototype.addOrSubtract(1,this.field.multiply(e[h],s))));r[o]=this.field.multiply(t.evaluateAt(s),this.field.inverse(a)),n&&(r[o]=this.field.multiply(r[o],s))}return r};var B={};B.forReference=function(t){if(t<0||t>7)throw"System.ArgumentException";return B.DATA_MASKS[t]},B.DATA_MASKS=[new function(){this.unmaskBitMatrix=function(t,e){for(var n=0;n<e;n++)for(var i=0;i<e;i++)this.isMasked(n,i)&&t.flip(i,n)},this.isMasked=function(t,e){return 0==(t+e&1)}},new function(){this.unmaskBitMatrix=function(t,e){for(var n=0;n<e;n++)for(var i=0;i<e;i++)this.isMasked(n,i)&&t.flip(i,n)},this.isMasked=function(t,e){return 0==(1&t)}},new function(){this.unmaskBitMatrix=function(t,e){for(var n=0;n<e;n++)for(var i=0;i<e;i++)this.isMasked(n,i)&&t.flip(i,n)},this.isMasked=function(t,e){return e%3==0}},new function(){this.unmaskBitMatrix=function(t,e){for(var n=0;n<e;n++)for(var i=0;i<e;i++)this.isMasked(n,i)&&t.flip(i,n)},this.isMasked=function(t,e){return(t+e)%3==0}},new function(){this.unmaskBitMatrix=function(t,e){for(var n=0;n<e;n++)for(var i=0;i<e;i++)this.isMasked(n,i)&&t.flip(i,n)},this.isMasked=function(t,e){return 0==(M(t,1)+e/3&1)}},new function(){this.unmaskBitMatrix=function(t,e){for(var n=0;n<e;n++)for(var i=0;i<e;i++)this.isMasked(n,i)&&t.flip(i,n)},this.isMasked=function(t,e){var n=t*e;return(1&n)+n%3==0}},new function(){this.unmaskBitMatrix=function(t,e){for(var n=0;n<e;n++)for(var i=0;i<e;i++)this.isMasked(n,i)&&t.flip(i,n)},this.isMasked=function(t,e){var n=t*e;return 0==((1&n)+n%3&1)}},new function(){this.unmaskBitMatrix=function(t,e){for(var n=0;n<e;n++)for(var i=0;i<e;i++)this.isMasked(n,i)&&t.flip(i,n)},this.isMasked=function(t,e){return 0==((t+e&1)+t*e%3&1)}}],m.prototype.copyBit=function(t,e,n){return this.bitMatrix.get_Renamed(t,e)?n<<1|1:n<<1},m.prototype.readFormatInformation=function(){if(null!=this.parsedFormatInfo)return this.parsedFormatInfo;for(var t=0,n=0;n<6;n++)t=this.copyBit(n,8,t);t=this.copyBit(7,8,t),t=this.copyBit(8,8,t),t=this.copyBit(8,7,t);for(o=5;o>=0;o--)t=this.copyBit(8,o,t);if(this.parsedFormatInfo=e.decodeFormatInformation(t),null!=this.parsedFormatInfo)return this.parsedFormatInfo;var i=this.bitMatrix.Dimension;t=0;for(var r=i-8,n=i-1;n>=r;n--)t=this.copyBit(n,8,t);for(var o=i-7;o<i;o++)t=this.copyBit(8,o,t);if(this.parsedFormatInfo=e.decodeFormatInformation(t),null!=this.parsedFormatInfo)return this.parsedFormatInfo;throw"Error readFormatInformation"},m.prototype.readVersion=function(){if(null!=this.parsedVersion)return this.parsedVersion;var t=this.bitMatrix.Dimension,e=t-17>>2;if(e<=6)return o.getVersionForNumber(e);for(var n=0,i=t-11,r=5;r>=0;r--)for(s=t-9;s>=i;s--)n=this.copyBit(s,r,n);if(this.parsedVersion=o.decodeVersionInformation(n),null!=this.parsedVersion&&this.parsedVersion.DimensionForVersion==t)return this.parsedVersion;n=0;for(var s=5;s>=0;s--)for(r=t-9;r>=i;r--)n=this.copyBit(s,r,n);if(this.parsedVersion=o.decodeVersionInformation(n),null!=this.parsedVersion&&this.parsedVersion.DimensionForVersion==t)return this.parsedVersion;throw"Error readVersion"},m.prototype.readCodewords=function(){var t=this.readFormatInformation(),e=this.readVersion(),n=B.forReference(t.dataMask),i=this.bitMatrix.Dimension;n.unmaskBitMatrix(this.bitMatrix,i);for(var r=e.buildFunctionPattern(),o=!0,s=new Array(e.totalCodewords),a=0,h=0,w=0,f=i-1;f>0;f-=2){6==f&&f--;for(var u=0;u<i;u++)for(var l=o?i-1-u:u,d=0;d<2;d++)r.get_Renamed(f-d,l)||(w++,h<<=1,this.bitMatrix.get_Renamed(f-d,l)&&(h|=1),8==w&&(s[a++]=h,w=0,h=0));o^=!0}if(a!=e.totalCodewords)throw"Error readCodewords";return s},b.getDataBlocks=function(t,e,n){if(t.length!=e.totalCodewords)throw"ArgumentException";for(var i=e.getECBlocksForLevel(n),r=0,o=i.getECBlocks(),s=0;s<o.length;s++)r+=o[s].count;for(var a=new Array(r),h=0,w=0;w<o.length;w++)for(var f=o[w],s=0;s<f.count;s++){var u=f.dataCodewords,l=i.ecCodewordsPerBlock+u;a[h++]=new b(u,new Array(l))}for(var d=a[0].codewords.length,c=a.length-1;c>=0&&a[c].codewords.length!=d;)c--;c++;for(var p=d-i.ecCodewordsPerBlock,g=0,s=0;s<p;s++)for(w=0;w<h;w++)a[w].codewords[s]=t[g++];for(w=c;w<h;w++)a[w].codewords[p]=t[g++];for(var v=a[0].codewords.length,s=p;s<v;s++)for(w=0;w<h;w++){var m=w<c?s:s+1;a[w].codewords[m]=t[g++]}return a},y.prototype.getNextBits=function(t){var e=0;if(t<this.bitPointer+1){for(var n=0,i=0;i<t;i++)n+=1<<i;return n<<=this.bitPointer-t+1,e=(this.blocks[this.blockPointer]&n)>>this.bitPointer-t+1,this.bitPointer-=t,e}if(t<this.bitPointer+1+8){for(var r=0,i=0;i<this.bitPointer+1;i++)r+=1<<i;return e=(this.blocks[this.blockPointer]&r)<<t-(this.bitPointer+1),this.blockPointer++,e+=this.blocks[this.blockPointer]>>8-(t-(this.bitPointer+1)),this.bitPointer=this.bitPointer-t%8,this.bitPointer<0&&(this.bitPointer=8+this.bitPointer),e}if(t<this.bitPointer+1+16){for(var r=0,o=0,i=0;i<this.bitPointer+1;i++)r+=1<<i;var s=(this.blocks[this.blockPointer]&r)<<t-(this.bitPointer+1);this.blockPointer++;var a=this.blocks[this.blockPointer]<<t-(this.bitPointer+1+8);this.blockPointer++;for(i=0;i<t-(this.bitPointer+1+8);i++)o+=1<<i;return o<<=8-(t-(this.bitPointer+1+8)),e=s+a+((this.blocks[this.blockPointer]&o)>>8-(t-(this.bitPointer+1+8))),this.bitPointer=this.bitPointer-(t-8)%8,this.bitPointer<0&&(this.bitPointer=8+this.bitPointer),e}return 0},y.prototype.NextMode=function(){return this.blockPointer>this.blocks.length-this.numErrorCorrectionCode-2?0:this.getNextBits(4)},y.prototype.getDataLength=function(t){for(var e=0;;){if(t>>e==1)break;e++}return this.getNextBits(E.sizeOfDataLengthInfo[this.dataLengthMode][e])},y.prototype.getRomanAndFigureString=function(t){var e=t,n=0,i="",r=["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"," ","$","%","*","+","-",".","/",":"];do{if(e>1){var o=(n=this.getNextBits(11))%45;i+=r[Math.floor(n/45)],i+=r[o],e-=2}else 1==e&&(i+=r[n=this.getNextBits(6)],e-=1)}while(e>0);return i},y.prototype.getFigureString=function(t){var e=t,n=0,i="";do{e>=3?((n=this.getNextBits(10))<100&&(i+="0"),n<10&&(i+="0"),e-=3):2==e?((n=this.getNextBits(7))<10&&(i+="0"),e-=2):1==e&&(n=this.getNextBits(4),e-=1),i+=n}while(e>0);return i},y.prototype.get8bitByteArray=function(t){var e=t,n=0,i=[];do{n=this.getNextBits(8),i.push(n),e--}while(e>0);return i},y.prototype.getKanjiString=function(t){var e=t,n=0,i="";do{var r=((n=this.getNextBits(13))/192<<8)+n%192,o=0;o=r+33088<=40956?r+33088:r+49472,i+=String.fromCharCode(o),e--}while(e>0);return i},Object.defineProperty(y.prototype,"DataByte",{get:function(){for(var t=[];;){var e=this.NextMode();if(0==e){if(t.length>0)break;throw"Empty data block"}if(1!=e&&2!=e&&4!=e&&8!=e&&7!=e)throw"Invalid mode: "+e+" in (block:"+this.blockPointer+" bit:"+this.bitPointer+")";var n=this.getDataLength(e);if(n<1)throw"Invalid data length: "+n;switch(e){case 1:for(var i=this.getFigureString(n),r=new Array(i.length),o=0;o<i.length;o++)r[o]=i.charCodeAt(o);t.push(r);break;case 2:for(var i=this.getRomanAndFigureString(n),r=new Array(i.length),o=0;o<i.length;o++)r[o]=i.charCodeAt(o);t.push(r);break;case 4:var s=this.get8bitByteArray(n);t.push(s);break;case 8:i=this.getKanjiString(n);t.push(i)}}return t}});var A={};A.rsDecoder=new v(g.QR_CODE_FIELD),A.correctErrors=function(t,e){for(var n=t.length,i=new Array(n),r=0;r<n;r++)i[r]=255&t[r];var o=t.length-e;try{A.rsDecoder.decode(i,o)}catch(t){throw t}for(r=0;r<e;r++)t[r]=i[r]},A.decode=function(t){for(var e=new m(t),n=e.readVersion(),i=e.readFormatInformation().errorCorrectionLevel,r=e.readCodewords(),o=b.getDataBlocks(r,n,i),s=0,a=0;a<o.length;a++)s+=o[a].numDataCodewords;for(var h=new Array(s),w=0,f=0;f<o.length;f++){var u=o[f],l=u.codewords,d=u.numDataCodewords;A.correctErrors(l,d);for(a=0;a<d;a++)h[w++]=l[a]}return new y(h,n.versionNumber,i.bits)};var E={};return E.sizeOfDataLengthInfo=[[10,9,8,8],[12,11,16,10],[14,13,16,12]],C.prototype.decode=function(t,e){var n=function(){try{this.error=void 0,this.result=this.process(this.imagedata)}catch(t){this.error=t,this.result=void 0}return null!=this.callback&&this.callback(this.error,this.result),this.result}.bind(this);if(void 0!=t&&void 0!=t.width)this.width=t.width,this.height=t.height,this.imagedata={data:e||t.data},this.imagedata.width=t.width,this.imagedata.height=t.height,n();else{if("undefined"==typeof Image)throw new Error("This source format is not supported in your environment, you need to pass an image buffer with width and height (see https://github.com/edi9999/jsqrcode/blob/master/test/qrcode.js)");var i=new Image;i.crossOrigin="Anonymous",i.onload=function(){var t=document.createElement("canvas"),e=t.getContext("2d"),r=document.getElementById("out-canvas");if(null!=r){var o=r.getContext("2d");o.clearRect(0,0,320,240),o.drawImage(i,0,0,320,240)}t.width=i.width,t.height=i.height,e.drawImage(i,0,0),this.width=i.width,this.height=i.height;try{this.imagedata=e.getImageData(0,0,i.width,i.height)}catch(t){if(this.result="Cross domain image reading not supported in your browser! Save it to your computer then drag and drop the file!",null!=this.callback)return this.callback(null,this.result)}n()}.bind(this),i.src=t}},C.prototype.decode_utf8=function(t){return decodeURIComponent(escape(t))},C.prototype.process=function(t){for(var e=(new Date).getTime(),n=new c(this.grayScaleToBitmap(this.grayscale(t))).detect(),i=A.decode(n.bits).DataByte,r="",o=0;o<i.length;o++)for(var s=0;s<i[o].length;s++)r+=String.fromCharCode(i[o][s]);var a=(new Date).getTime()-e;return this.debug&&console.log("QR Code processing time (ms): "+a),{result:this.decode_utf8(r),points:n.points}},C.prototype.getPixel=function(t,e,n){if(t.width<e)throw"point error";if(t.height<n)throw"point error";var i=4*e+n*t.width*4;return(33*t.data[i]+34*t.data[i+1]+33*t.data[i+2])/100},C.prototype.binarize=function(t){for(var e=new Array(this.width*this.height),n=0;n<this.height;n++)for(var i=0;i<this.width;i++){var r=this.getPixel(i,n);e[i+n*this.width]=r<=t}return e},C.prototype.getMiddleBrightnessPerArea=function(t){for(var e=Math.floor(t.width/4),n=Math.floor(t.height/4),i=new Array(4),r=0;r<4;r++){i[r]=new Array(4);for(var o=0;o<4;o++)i[r][o]=[0,0]}for(u=0;u<4;u++)for(l=0;l<4;l++){i[l][u][0]=255;for(var s=0;s<n;s++)for(var a=0;a<e;a++){var h=t.data[e*l+a+(n*u+s)*t.width];h<i[l][u][0]&&(i[l][u][0]=h),h>i[l][u][1]&&(i[l][u][1]=h)}}for(var w=new Array(4),f=0;f<4;f++)w[f]=new Array(4);for(var u=0;u<4;u++)for(var l=0;l<4;l++)w[l][u]=Math.floor((i[l][u][0]+i[l][u][1])/2);return w},C.prototype.grayScaleToBitmap=function(t){for(var e=this.getMiddleBrightnessPerArea(t),n=e.length,i=Math.floor(t.width/n),r=Math.floor(t.height/n),o=0;o<n;o++)for(var s=0;s<n;s++)for(var a=0;a<r;a++)for(var h=0;h<i;h++)t.data[i*s+h+(r*o+a)*t.width]=t.data[i*s+h+(r*o+a)*t.width]<e[s][o];return t},C.prototype.grayscale=function(t){for(var e=new Array(t.width*t.height),n=0;n<t.height;n++)for(var i=0;i<t.width;i++){var r=this.getPixel(t,i,n);e[i+n*t.width]=r}return{height:t.height,width:t.width,data:e}},C});




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


(function(){
	"use strict";
	
	PPG.main = function() {
		Promise.all([
			TemplateJS.once(document,"styles_loaded"),
			TemplateJS.delay(1000)]
		).then(this.start.bind(this));
	};

	
	PPG.hash_router = function() {
		var h = location.hash;
		h = h.substr(1);
		if (h.length == 0) {
			PPG.main_page();
		} else if (h.startsWith("site=")) {
			var site = decodeURIComponent(h.substr(5));
			PPG.showpwd(site).then(function(){
				window.history.back();
			});
		} else if (h == "keys") {
			PPG.key_list().then(function(){
				window.history.back();
			});
		} else if (h == "qr") {
			var qrr = new PPG.QRReader(function(site) {
				location.href
			});
			qrr.show().then(function(){
				window.history.back();
			});
		}
	};
	
	PPG.start = function() {
		
		window.addEventListener("hashchange", PPG.hash_router.bind(PPG));
		
		document.getElementById("intro").hidden=true;	
		if (PPG.KeyStore.list().length == 0) {
			PPG.welcome_page()
			.then(PPG.add_new_key_dlg.bind(PPG))
			.then(function(kk){
				PPG.KeyStore.set(kk.key, kk.name);
				PPG.KeyStore.setPrimary(kk.name);
				PPG.main_page();
			}).catch(function(e) {
				console.error(e);
				PPG.start();
			}.bind(PPG));
		} else {
			if (location.hash.length) PPG.hash_router();
			else PPG.main_page();
		};
	}
	
	
})();

