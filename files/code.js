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
			if (x == 13 && this.defaultAction) {
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
					w.appendChild(opt);
				}
			} else {
				for (var itm in val) {
					var opt = document.createElement("option");
					opt.appendChild(document.createTextNode(val[itm].toString()));
					opt.setAttribute("value",itm);
					w.appendChild(opt);				
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
	};

(function(){
	"use strict";
	
	PPG.layout = {
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
					next(idx+1)
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

	PPG.generatePassword = generate_password;
	
})();


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


(function(){

	"use strict;"

	
	
	PPG.main_page = function() {
		
		var v = this.layout.load("mainscreen").v;

		v.setData({
			"keyman_icon":{
				"!click":function() {
					PPG.key_list().then(PPG.main_page.bind(this));
				}.bind(this)
			},
			"showpwd":{
				"!click":function() {
					var d = v.readData();
					if (d.site.length == 0) {
						v.mark("errshort");						
					}
				}.bind(this)
			}
		});
				
	};
	
	
})();


(function(){
	"use strict";
	
	PPG.main = function() {
		Promise.all([
			TemplateJS.once(document,"styles_loaded"),
			TemplateJS.delay(1000)]
		).then(this.start.bind(this));
	}

	
	PPG.start = function() {
		document.getElementById("intro").hidden=true;	
		if (PPG.KeyStore.list().length == 0) {
			PPG.welcome_page()
			.then(PPG.add_new_key_dlg.bind(PPG))
			.then(function(kk){
				PPG.KeyStore.set(kk.key, kk.name);	
				PPG.main_page();
			}).catch(PPG.start.bind(PPG));
		} else {
			PPG.main_page();
		}
	}
	
	PPG.main_page = function() {
		console.log("main page");
	}

	
})();

