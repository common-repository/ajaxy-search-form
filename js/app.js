(function () {
    'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || from);
    }

    var global =
      (typeof globalThis !== 'undefined' && globalThis) ||
      (typeof self !== 'undefined' && self) ||
      (typeof global !== 'undefined' && global);

    var support = {
      searchParams: 'URLSearchParams' in global,
      iterable: 'Symbol' in global && 'iterator' in Symbol,
      blob:
        'FileReader' in global &&
        'Blob' in global &&
        (function() {
          try {
            new Blob();
            return true
          } catch (e) {
            return false
          }
        })(),
      formData: 'FormData' in global,
      arrayBuffer: 'ArrayBuffer' in global
    };

    function isDataView(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    if (support.arrayBuffer) {
      var viewClasses = [
        '[object Int8Array]',
        '[object Uint8Array]',
        '[object Uint8ClampedArray]',
        '[object Int16Array]',
        '[object Uint16Array]',
        '[object Int32Array]',
        '[object Uint32Array]',
        '[object Float32Array]',
        '[object Float64Array]'
      ];

      var isArrayBufferView =
        ArrayBuffer.isView ||
        function(obj) {
          return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
        };
    }

    function normalizeName(name) {
      if (typeof name !== 'string') {
        name = String(name);
      }
      if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
        throw new TypeError('Invalid character in header field name: "' + name + '"')
      }
      return name.toLowerCase()
    }

    function normalizeValue(value) {
      if (typeof value !== 'string') {
        value = String(value);
      }
      return value
    }

    // Build a destructive iterator for the value list
    function iteratorFor(items) {
      var iterator = {
        next: function() {
          var value = items.shift();
          return {done: value === undefined, value: value}
        }
      };

      if (support.iterable) {
        iterator[Symbol.iterator] = function() {
          return iterator
        };
      }

      return iterator
    }

    function Headers(headers) {
      this.map = {};

      if (headers instanceof Headers) {
        headers.forEach(function(value, name) {
          this.append(name, value);
        }, this);
      } else if (Array.isArray(headers)) {
        headers.forEach(function(header) {
          this.append(header[0], header[1]);
        }, this);
      } else if (headers) {
        Object.getOwnPropertyNames(headers).forEach(function(name) {
          this.append(name, headers[name]);
        }, this);
      }
    }

    Headers.prototype.append = function(name, value) {
      name = normalizeName(name);
      value = normalizeValue(value);
      var oldValue = this.map[name];
      this.map[name] = oldValue ? oldValue + ', ' + value : value;
    };

    Headers.prototype['delete'] = function(name) {
      delete this.map[normalizeName(name)];
    };

    Headers.prototype.get = function(name) {
      name = normalizeName(name);
      return this.has(name) ? this.map[name] : null
    };

    Headers.prototype.has = function(name) {
      return this.map.hasOwnProperty(normalizeName(name))
    };

    Headers.prototype.set = function(name, value) {
      this.map[normalizeName(name)] = normalizeValue(value);
    };

    Headers.prototype.forEach = function(callback, thisArg) {
      for (var name in this.map) {
        if (this.map.hasOwnProperty(name)) {
          callback.call(thisArg, this.map[name], name, this);
        }
      }
    };

    Headers.prototype.keys = function() {
      var items = [];
      this.forEach(function(value, name) {
        items.push(name);
      });
      return iteratorFor(items)
    };

    Headers.prototype.values = function() {
      var items = [];
      this.forEach(function(value) {
        items.push(value);
      });
      return iteratorFor(items)
    };

    Headers.prototype.entries = function() {
      var items = [];
      this.forEach(function(value, name) {
        items.push([name, value]);
      });
      return iteratorFor(items)
    };

    if (support.iterable) {
      Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
    }

    function consumed(body) {
      if (body.bodyUsed) {
        return Promise.reject(new TypeError('Already read'))
      }
      body.bodyUsed = true;
    }

    function fileReaderReady(reader) {
      return new Promise(function(resolve, reject) {
        reader.onload = function() {
          resolve(reader.result);
        };
        reader.onerror = function() {
          reject(reader.error);
        };
      })
    }

    function readBlobAsArrayBuffer(blob) {
      var reader = new FileReader();
      var promise = fileReaderReady(reader);
      reader.readAsArrayBuffer(blob);
      return promise
    }

    function readBlobAsText(blob) {
      var reader = new FileReader();
      var promise = fileReaderReady(reader);
      reader.readAsText(blob);
      return promise
    }

    function readArrayBufferAsText(buf) {
      var view = new Uint8Array(buf);
      var chars = new Array(view.length);

      for (var i = 0; i < view.length; i++) {
        chars[i] = String.fromCharCode(view[i]);
      }
      return chars.join('')
    }

    function bufferClone(buf) {
      if (buf.slice) {
        return buf.slice(0)
      } else {
        var view = new Uint8Array(buf.byteLength);
        view.set(new Uint8Array(buf));
        return view.buffer
      }
    }

    function Body() {
      this.bodyUsed = false;

      this._initBody = function(body) {
        /*
          fetch-mock wraps the Response object in an ES6 Proxy to
          provide useful test harness features such as flush. However, on
          ES5 browsers without fetch or Proxy support pollyfills must be used;
          the proxy-pollyfill is unable to proxy an attribute unless it exists
          on the object before the Proxy is created. This change ensures
          Response.bodyUsed exists on the instance, while maintaining the
          semantic of setting Request.bodyUsed in the constructor before
          _initBody is called.
        */
        this.bodyUsed = this.bodyUsed;
        this._bodyInit = body;
        if (!body) {
          this._bodyText = '';
        } else if (typeof body === 'string') {
          this._bodyText = body;
        } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
          this._bodyBlob = body;
        } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
          this._bodyFormData = body;
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this._bodyText = body.toString();
        } else if (support.arrayBuffer && support.blob && isDataView(body)) {
          this._bodyArrayBuffer = bufferClone(body.buffer);
          // IE 10-11 can't handle a DataView body.
          this._bodyInit = new Blob([this._bodyArrayBuffer]);
        } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
          this._bodyArrayBuffer = bufferClone(body);
        } else {
          this._bodyText = body = Object.prototype.toString.call(body);
        }

        if (!this.headers.get('content-type')) {
          if (typeof body === 'string') {
            this.headers.set('content-type', 'text/plain;charset=UTF-8');
          } else if (this._bodyBlob && this._bodyBlob.type) {
            this.headers.set('content-type', this._bodyBlob.type);
          } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
          }
        }
      };

      if (support.blob) {
        this.blob = function() {
          var rejected = consumed(this);
          if (rejected) {
            return rejected
          }

          if (this._bodyBlob) {
            return Promise.resolve(this._bodyBlob)
          } else if (this._bodyArrayBuffer) {
            return Promise.resolve(new Blob([this._bodyArrayBuffer]))
          } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as blob')
          } else {
            return Promise.resolve(new Blob([this._bodyText]))
          }
        };

        this.arrayBuffer = function() {
          if (this._bodyArrayBuffer) {
            var isConsumed = consumed(this);
            if (isConsumed) {
              return isConsumed
            }
            if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
              return Promise.resolve(
                this._bodyArrayBuffer.buffer.slice(
                  this._bodyArrayBuffer.byteOffset,
                  this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                )
              )
            } else {
              return Promise.resolve(this._bodyArrayBuffer)
            }
          } else {
            return this.blob().then(readBlobAsArrayBuffer)
          }
        };
      }

      this.text = function() {
        var rejected = consumed(this);
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      };

      if (support.formData) {
        this.formData = function() {
          return this.text().then(decode)
        };
      }

      this.json = function() {
        return this.text().then(JSON.parse)
      };

      return this
    }

    // HTTP methods whose capitalization should be normalized
    var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

    function normalizeMethod(method) {
      var upcased = method.toUpperCase();
      return methods.indexOf(upcased) > -1 ? upcased : method
    }

    function Request(input, options) {
      if (!(this instanceof Request)) {
        throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
      }

      options = options || {};
      var body = options.body;

      if (input instanceof Request) {
        if (input.bodyUsed) {
          throw new TypeError('Already read')
        }
        this.url = input.url;
        this.credentials = input.credentials;
        if (!options.headers) {
          this.headers = new Headers(input.headers);
        }
        this.method = input.method;
        this.mode = input.mode;
        this.signal = input.signal;
        if (!body && input._bodyInit != null) {
          body = input._bodyInit;
          input.bodyUsed = true;
        }
      } else {
        this.url = String(input);
      }

      this.credentials = options.credentials || this.credentials || 'same-origin';
      if (options.headers || !this.headers) {
        this.headers = new Headers(options.headers);
      }
      this.method = normalizeMethod(options.method || this.method || 'GET');
      this.mode = options.mode || this.mode || null;
      this.signal = options.signal || this.signal;
      this.referrer = null;

      if ((this.method === 'GET' || this.method === 'HEAD') && body) {
        throw new TypeError('Body not allowed for GET or HEAD requests')
      }
      this._initBody(body);

      if (this.method === 'GET' || this.method === 'HEAD') {
        if (options.cache === 'no-store' || options.cache === 'no-cache') {
          // Search for a '_' parameter in the query string
          var reParamSearch = /([?&])_=[^&]*/;
          if (reParamSearch.test(this.url)) {
            // If it already exists then set the value with the current time
            this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
          } else {
            // Otherwise add a new '_' parameter to the end with the current time
            var reQueryString = /\?/;
            this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
          }
        }
      }
    }

    Request.prototype.clone = function() {
      return new Request(this, {body: this._bodyInit})
    };

    function decode(body) {
      var form = new FormData();
      body
        .trim()
        .split('&')
        .forEach(function(bytes) {
          if (bytes) {
            var split = bytes.split('=');
            var name = split.shift().replace(/\+/g, ' ');
            var value = split.join('=').replace(/\+/g, ' ');
            form.append(decodeURIComponent(name), decodeURIComponent(value));
          }
        });
      return form
    }

    function parseHeaders(rawHeaders) {
      var headers = new Headers();
      var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
      // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
      preProcessedHeaders
        .split('\r')
        .map(function(header) {
          return header.indexOf('\n') === 0 ? header.substr(1, header.length) : header
        })
        .forEach(function(line) {
          var parts = line.split(':');
          var key = parts.shift().trim();
          if (key) {
            var value = parts.join(':').trim();
            headers.append(key, value);
          }
        });
      return headers
    }

    Body.call(Request.prototype);

    function Response(bodyInit, options) {
      if (!(this instanceof Response)) {
        throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
      }
      if (!options) {
        options = {};
      }

      this.type = 'default';
      this.status = options.status === undefined ? 200 : options.status;
      this.ok = this.status >= 200 && this.status < 300;
      this.statusText = options.statusText === undefined ? '' : '' + options.statusText;
      this.headers = new Headers(options.headers);
      this.url = options.url || '';
      this._initBody(bodyInit);
    }

    Body.call(Response.prototype);

    Response.prototype.clone = function() {
      return new Response(this._bodyInit, {
        status: this.status,
        statusText: this.statusText,
        headers: new Headers(this.headers),
        url: this.url
      })
    };

    Response.error = function() {
      var response = new Response(null, {status: 0, statusText: ''});
      response.type = 'error';
      return response
    };

    var redirectStatuses = [301, 302, 303, 307, 308];

    Response.redirect = function(url, status) {
      if (redirectStatuses.indexOf(status) === -1) {
        throw new RangeError('Invalid status code')
      }

      return new Response(null, {status: status, headers: {location: url}})
    };

    var DOMException = global.DOMException;
    try {
      new DOMException();
    } catch (err) {
      DOMException = function(message, name) {
        this.message = message;
        this.name = name;
        var error = Error(message);
        this.stack = error.stack;
      };
      DOMException.prototype = Object.create(Error.prototype);
      DOMException.prototype.constructor = DOMException;
    }

    function fetch$1(input, init) {
      return new Promise(function(resolve, reject) {
        var request = new Request(input, init);

        if (request.signal && request.signal.aborted) {
          return reject(new DOMException('Aborted', 'AbortError'))
        }

        var xhr = new XMLHttpRequest();

        function abortXhr() {
          xhr.abort();
        }

        xhr.onload = function() {
          var options = {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: parseHeaders(xhr.getAllResponseHeaders() || '')
          };
          options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
          var body = 'response' in xhr ? xhr.response : xhr.responseText;
          setTimeout(function() {
            resolve(new Response(body, options));
          }, 0);
        };

        xhr.onerror = function() {
          setTimeout(function() {
            reject(new TypeError('Network request failed'));
          }, 0);
        };

        xhr.ontimeout = function() {
          setTimeout(function() {
            reject(new TypeError('Network request failed'));
          }, 0);
        };

        xhr.onabort = function() {
          setTimeout(function() {
            reject(new DOMException('Aborted', 'AbortError'));
          }, 0);
        };

        function fixUrl(url) {
          try {
            return url === '' && global.location.href ? global.location.href : url
          } catch (e) {
            return url
          }
        }

        xhr.open(request.method, fixUrl(request.url), true);

        if (request.credentials === 'include') {
          xhr.withCredentials = true;
        } else if (request.credentials === 'omit') {
          xhr.withCredentials = false;
        }

        if ('responseType' in xhr) {
          if (support.blob) {
            xhr.responseType = 'blob';
          } else if (
            support.arrayBuffer &&
            request.headers.get('Content-Type') &&
            request.headers.get('Content-Type').indexOf('application/octet-stream') !== -1
          ) {
            xhr.responseType = 'arraybuffer';
          }
        }

        if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
          Object.getOwnPropertyNames(init.headers).forEach(function(name) {
            xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
          });
        } else {
          request.headers.forEach(function(value, name) {
            xhr.setRequestHeader(name, value);
          });
        }

        if (request.signal) {
          request.signal.addEventListener('abort', abortXhr);

          xhr.onreadystatechange = function() {
            // DONE (success or failure)
            if (xhr.readyState === 4) {
              request.signal.removeEventListener('abort', abortXhr);
            }
          };
        }

        xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
      })
    }

    fetch$1.polyfill = true;

    if (!global.fetch) {
      global.fetch = fetch$1;
      global.Headers = Headers;
      global.Request = Request;
      global.Response = Response;
    }

    /* eslint-disable no-bitwise, no-cond-assign */

    /**
     * Checks if an element contains another given element.
     * 
     * @param context the context element
     * @param node the element to check
     */
    function contains(context, node) {
      // HTML DOM and SVG DOM may have different support levels,
      // so we need to check on context instead of a document root element.
      if (context.contains) return context.contains(node);
      if (context.compareDocumentPosition) return context === node || !!(context.compareDocumentPosition(node) & 16);
    }

    /**
     * Returns the owner document of a given element.
     * 
     * @param node the element
     */
    function ownerDocument(node) {
      return node && node.ownerDocument || document;
    }

    function isDocument(element) {
      return 'nodeType' in element && element.nodeType === document.DOCUMENT_NODE;
    }

    function isWindow(node) {
      if ('window' in node && node.window === node) return node;
      if (isDocument(node)) return node.defaultView || false;
      return false;
    }

    function getscrollAccessor(offset) {
      var prop = offset === 'pageXOffset' ? 'scrollLeft' : 'scrollTop';

      function scrollAccessor(node, val) {
        var win = isWindow(node);

        if (val === undefined) {
          return win ? win[offset] : node[prop];
        }

        if (win) {
          win.scrollTo(win[offset], val);
        } else {
          node[prop] = val;
        }
      }

      return scrollAccessor;
    }

    /**
     * Gets or sets the scroll left position of a given element.
     * 
     * @param node the element
     * @param val the position to set
     */

    var scrollLeft = getscrollAccessor('pageXOffset');

    /**
     * Gets or sets the scroll top position of a given element.
     * 
     * @param node the element
     * @param val the position to set
     */

    var scrollTop = getscrollAccessor('pageYOffset');

    /**
     * Returns the offset of a given element, including top and left positions, width and height.
     * 
     * @param node the element
     */

    function offset(node) {
      var doc = ownerDocument(node);
      var box = {
        top: 0,
        left: 0,
        height: 0,
        width: 0
      };
      var docElem = doc && doc.documentElement; // Make sure it's not a disconnected DOM node

      if (!docElem || !contains(docElem, node)) return box;
      if (node.getBoundingClientRect !== undefined) box = node.getBoundingClientRect();
      box = {
        top: box.top + scrollTop(docElem) - (docElem.clientTop || 0),
        left: box.left + scrollLeft(docElem) - (docElem.clientLeft || 0),
        width: box.width,
        height: box.height
      };
      return box;
    }

    var SFResults = (function () {
        function SFResults(data, parent) {
            var _this = this;
            this.items = [];
            this.isString = function (str) { return Object.prototype.toString.call(str) === "[object String]"; };
            this.items = [];
            this.parent = parent;
            this.element = document.createElement("ul");
            var _a = this.parent, options = _a.options, input = _a.input;
            if (this.isString(data)) {
                var results_1 = [];
                data.split(",").map(function (val) {
                    var dm = val.split(":");
                    if (dm.length == 2) {
                        if (dm[1].indexOf(input.value) == 0) {
                            results_1.push({ value: dm[0], label: dm[1] });
                        }
                    }
                    else if (dm.length == 1) {
                        if (val.indexOf(input.value) == 0) {
                            results_1.push({ value: val, label: val });
                        }
                    }
                });
                results_1.map(function (_a) {
                    var label = _a.label, value = _a.value;
                    var child = document.createElement("li");
                    child.classList.add("sf-lnk");
                    child.innerHTML = label;
                    child.setAttribute("data-value", value);
                    _this.element.appendChild(child);
                    _this.items.push(child);
                });
            }
            else {
                Object.keys(data).map(function (key) {
                    var results = data[key];
                    results.map(function (_a) {
                        var all = _a.all, class_name = _a.class_name, template = _a.template, title = _a.title;
                        if (all && all.length) {
                            if (title) {
                                var li_1 = document.createElement("li");
                                li_1.classList.add("sf-header");
                                li_1.innerText = title;
                                _this.element.appendChild(li_1);
                            }
                            var li = document.createElement("li");
                            var div = document.createElement("div");
                            div.classList.add("sf-result-container");
                            var ul_1 = document.createElement("ul");
                            all.map(function (result) {
                                var _a;
                                var child = document.createElement("li");
                                var classes = class_name ? class_name.split(" ").map(function (v) { return v.trim(); }) : [];
                                (_a = child.classList).add.apply(_a, __spreadArray(["sf-lnk"], classes, false));
                                child.innerHTML = _this.replaceResults(result, template);
                                ul_1.appendChild(child);
                                _this.items.push(child);
                            });
                            div.appendChild(ul_1);
                            li.appendChild(div);
                            _this.element.appendChild(li);
                        }
                    });
                });
            }
            if (!options.callback) {
                var nTemplate = AjaxyLiveSearchSettings.more;
                nTemplate = nTemplate.replace(/{search_value_escaped}/g, "".concat(input.value));
                nTemplate = nTemplate.replace(/{search_url_escaped}/g, options.searchUrl.replace("%s", encodeURI(input.value)));
                nTemplate = nTemplate.replace(/{search_value}/g, "".concat(input.value));
                nTemplate = nTemplate.replace(/{total}/g, this.items.length);
                var child = document.createElement("li");
                child.classList.add("sf-lnk", "sf-more");
                if (this.items.length == 0) {
                    child.classList.add("sf-selected");
                }
                child.innerHTML = nTemplate;
                this.element.appendChild(child);
                this.items.push(child);
            }
            this.loadLiveEvents(options.callback);
        }
        SFResults.prototype.loadLiveEvents = function (callback) {
            var _this = this;
            this.items.map(function (item) {
                item.addEventListener("mouseover", function (e) {
                    _this.items.map(function (xitem) {
                        xitem != item && xitem.classList.remove("sf-selected");
                    });
                    item.classList.add("sf-selected");
                });
            });
            if (callback) {
                this.items.map(function (item) {
                    item.addEventListener("click", function (e) {
                        try {
                            window[callback](item, _this);
                        }
                        catch (e) {
                            alert(e);
                        }
                    });
                });
            }
            window.addEventListener("keydown", function (event) {
                if (_this.parent.mainElem.style.display != "none") {
                    if (event.key == "ArrowUp" || event.key == "ArrowDown") {
                        var sindex = -1;
                        event.stopPropagation();
                        event.preventDefault();
                        _this.items.some(function (item, index) {
                            if (item.classList.contains("sf-selected")) {
                                sindex = index;
                                return true;
                            }
                            return false;
                        });
                        var currentIndex = -1;
                        if (event.key == "ArrowDown") {
                            if (sindex + 1 < _this.items.length && _this.items[sindex + 1]) {
                                currentIndex = sindex + 1;
                            }
                        }
                        else if (event.key == "ArrowUp") {
                            if (sindex - 1 > 0 && _this.items[sindex - 1]) {
                                currentIndex = sindex - 1;
                            }
                            else {
                                currentIndex = 0;
                            }
                        }
                        if (currentIndex >= 0) {
                            _this.items.map(function (item) { return item.classList.remove("sf-selected"); });
                            _this.items[currentIndex].classList.add("sf-selected");
                            _this.items[currentIndex].focus();
                        }
                    }
                    else if (event.key == "Escape") {
                        _this.parent.mainElem.style.display = "none";
                    }
                    else if (event.key == "Enter") {
                        var selected = _this.items.filter(function (item) { return item.classList.contains("sf-selected"); });
                        var href = _this.parent.options.searchUrl.replace("%s", encodeURI(_this.parent.input.value));
                        if (selected.length > 0) {
                            href = selected[0].querySelector("a").href;
                        }
                        if (href && href != "") {
                            if (callback) {
                                window[callback](selected.length ? selected[0] : null, _this);
                            }
                            else {
                                window.location.href = href;
                            }
                            return false;
                        }
                    }
                }
            });
        };
        SFResults.prototype.replaceResults = function (results, template) {
            for (var s in results) {
                template = template.replace(new RegExp("{" + s + "}", "g"), results[s]);
            }
            return template;
        };
        return SFResults;
    }());
    var SF = (function () {
        function SF(selector, options) {
            this.input = null;
            this.timeout = null;
            this.options = null;
            this.defaults = {
                delay: 500,
                leftOffset: 0,
                topOffset: 5,
                text: "Search For",
                iwidth: 180,
                width: "315px",
                ajaxUrl: "",
                ajaxData: null,
                searchUrl: "",
                callback: false,
                rtl: false,
                search: false,
            };
            this.input = document.querySelector(selector);
            if (!this.input) {
                console.warn("Ajaxy Live Search can't find input ".concat(selector));
                return;
            }
            this.timeout = null;
            this.options = Object.assign(this.defaults, options);
            this.attr({ placeholder: options.text, autocomplete: "off" }, this.input);
            this.mainElem = document.createElement("div");
            this.mainElem.classList.add("sf-container");
            var userAgent = window.navigator.userAgent;
            if (userAgent.indexOf("Win") != -1) {
                this.mainElem.classList.add("sf-windows");
            }
            if (this.options.rtl) {
                this.mainElem.classList.add("sf-rtl");
            }
            this.mainElem.style.position = "absolute";
            this.mainElem.style.display = "none";
            this.mainElem.style.width = "".concat(options.width);
            this.mainElem.style.zIndex = "9999";
            var mainCont = document.createElement("div");
            mainCont.classList.add("sf-sb-cont");
            var topCont = document.createElement("div");
            topCont.classList.add("sf-sb-top");
            var bottomCont = document.createElement("div");
            bottomCont.classList.add("sf-sb-bottom");
            mainCont.appendChild(topCont);
            this.resultsElem = document.createElement("div");
            this.resultsElem.classList.add("sf-results");
            this.valElem = document.createElement("div");
            this.valElem.classList.add("sf-val");
            this.resultsElem.appendChild(this.valElem);
            mainCont.appendChild(this.resultsElem);
            mainCont.appendChild(bottomCont);
            this.mainElem.appendChild(mainCont);
            document.body.appendChild(this.mainElem);
            this.loadEvents();
        }
        SF.prototype.attr = function (attrs, elm) {
            Object.keys(attrs).map(function (attr) {
                elm.setAttribute(attr, attrs[attr]);
            });
        };
        SF.prototype.loader = function (value) {
            var ul = document.createElement("ul");
            var li = document.createElement("li");
            li.classList.add("sf-lnk", "sf-more", "sf-selected");
            var link = document.createElement("a");
            link.classList.add("sf-loading");
            link.href = this.options.searchUrl.replace("%s", encodeURI(value));
            li.appendChild(link);
            ul.appendChild(li);
            this.valElem.innerHTML = "";
            this.valElem.appendChild(ul);
        };
        SF.prototype.loadResults = function () {
            var _this = this;
            if (this.input.value != "") {
                this.loader(this.input.value);
                this.mainElem.style.display = "block";
                this.adjustPosition();
                var data_1 = new FormData();
                data_1.append("action", "ajaxy_sf");
                data_1.append("value", this.input.value);
                if (this.options.ajaxData) {
                    var keys = Object.keys(this.options.ajaxData);
                    keys.map(function (key) {
                        data_1.append(key, _this.options.ajaxData[key]);
                    });
                }
                if (this.options.search) {
                    var nResults = new SFResults(this.options.search, this);
                    this.valElem.innerHTML = "";
                    this.valElem.appendChild(nResults.element);
                    this.mainElem.style.display = "block";
                }
                else {
                    fetch(this.options.ajaxUrl, {
                        body: data_1,
                        method: "post",
                    })
                        .then(function (response) {
                        response
                            .json()
                            .then(function (results) {
                            _this.parseResults(results);
                        })
                            .catch(function (e) {
                            console.error(e);
                            _this.parseResults([]);
                        });
                    })
                        .catch(function (e) {
                        console.error(e);
                        _this.parseResults([]);
                    });
                }
            }
            else {
                this.mainElem.style.display = "none";
            }
        };
        SF.prototype.adjustPosition = function () {
            var pos = this.bounds(this.input, this.options);
            if (!pos || this.mainElem.style.display == "none") {
                this.mainElem.style.display = "none";
                return false;
            }
            if (Math.ceil(pos.left) + parseInt(this.options.width, 10) > window.innerWidth) {
                this.mainElem.style.width = "".concat(window.innerWidth - pos.left - 20, "px");
            }
            if (this.options.rtl) {
                this.mainElem.style.top = "".concat(pos.bottom, "px");
                this.mainElem.style.left = "".concat(pos.right, "px");
                this.mainElem.style.right = "auto";
            }
            else {
                this.mainElem.style.top = "".concat(pos.bottom, "px");
                this.mainElem.style.left = "".concat(pos.left, "px");
                this.mainElem.style.right = "auto";
            }
        };
        SF.prototype.parseResults = function (results) {
            var nResults = new SFResults(results, this);
            this.valElem.innerHTML = "";
            this.valElem.appendChild(nResults.element);
            this.mainElem.style.display = "block";
        };
        SF.prototype.bounds = function (elem, options) {
            var elmOffset = offset(elem);
            if (elmOffset) {
                return {
                    top: elmOffset.top,
                    left: elmOffset.left + options.leftOffset,
                    bottom: elmOffset.top + elem.clientHeight + options.topOffset,
                    right: elmOffset.left - this.mainElem.clientWidth + elem.clientWidth,
                };
            }
        };
        SF.prototype.hide = function () {
            this.mainElem && (this.mainElem.style.display = "none");
        };
        SF.prototype.loadEvents = function () {
            var _this = this;
            window.addEventListener("resize", function () {
                if (_this.mainElem.style.display == "none") {
                    return;
                }
                _this.adjustPosition();
            });
            window.addEventListener("scroll", function () {
                if (_this.mainElem.style.display == "none") {
                    return;
                }
                _this.adjustPosition();
            });
            this.input.addEventListener("keyup", function (event) {
                if (event.key != "ArrowUp" &&
                    event.key != "ArrowDown" &&
                    event.key != "Enter" &&
                    event.key != "Escape" &&
                    event.key != "ArrowRight" &&
                    event.key != "ArrowLeft") {
                    if (_this.timeout != null) {
                        clearTimeout(_this.timeout);
                    }
                    _this.mainElem.classList.add("sf-focused");
                    _this.timeout = setTimeout(function () {
                        _this.loadResults();
                    }, _this.options.delay);
                }
            });
            document.addEventListener("click", this.hide.bind(this));
        };
        return SF;
    }());
    var ready = function (fn) {
        if (document.readyState != "loading") {
            fn();
        }
        else {
            document.addEventListener("DOMContentLoaded", fn);
        }
    };
    window.SFBoxes = {};
    ready(function () {
        AjaxyLiveSearchSettings.boxes.map(function (box) {
            if (!window.SFBoxes[box.selector]) {
                window.SFBoxes[box.selector] = new SF(box.selector, box.options);
            }
        });
    });
    window.SF = SF;

})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlcyI6WyIuLi9zcmMvdHMvbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uL3NyYy90cy9ub2RlX21vZHVsZXMvd2hhdHdnLWZldGNoL2ZldGNoLmpzIiwiLi4vc3JjL3RzL25vZGVfbW9kdWxlcy9kb20taGVscGVycy9lc20vY29udGFpbnMuanMiLCIuLi9zcmMvdHMvbm9kZV9tb2R1bGVzL2RvbS1oZWxwZXJzL2VzbS9vd25lckRvY3VtZW50LmpzIiwiLi4vc3JjL3RzL25vZGVfbW9kdWxlcy9kb20taGVscGVycy9lc20vaXNEb2N1bWVudC5qcyIsIi4uL3NyYy90cy9ub2RlX21vZHVsZXMvZG9tLWhlbHBlcnMvZXNtL2lzV2luZG93LmpzIiwiLi4vc3JjL3RzL25vZGVfbW9kdWxlcy9kb20taGVscGVycy9lc20vZ2V0U2Nyb2xsQWNjZXNzb3IuanMiLCIuLi9zcmMvdHMvbm9kZV9tb2R1bGVzL2RvbS1oZWxwZXJzL2VzbS9zY3JvbGxMZWZ0LmpzIiwiLi4vc3JjL3RzL25vZGVfbW9kdWxlcy9kb20taGVscGVycy9lc20vc2Nyb2xsVG9wLmpzIiwiLi4vc3JjL3RzL25vZGVfbW9kdWxlcy9kb20taGVscGVycy9lc20vb2Zmc2V0LmpzIiwiLi4vc3JjL3RzL3NjcmlwdHMvYXBwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGc7XHJcbiAgICByZXR1cm4gZyA9IHsgbmV4dDogdmVyYigwKSwgXCJ0aHJvd1wiOiB2ZXJiKDEpLCBcInJldHVyblwiOiB2ZXJiKDIpIH0sIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgZnJvbSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG4iLCJ2YXIgZ2xvYmFsID1cbiAgKHR5cGVvZiBnbG9iYWxUaGlzICE9PSAndW5kZWZpbmVkJyAmJiBnbG9iYWxUaGlzKSB8fFxuICAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnICYmIHNlbGYpIHx8XG4gICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBnbG9iYWwpXG5cbnZhciBzdXBwb3J0ID0ge1xuICBzZWFyY2hQYXJhbXM6ICdVUkxTZWFyY2hQYXJhbXMnIGluIGdsb2JhbCxcbiAgaXRlcmFibGU6ICdTeW1ib2wnIGluIGdsb2JhbCAmJiAnaXRlcmF0b3InIGluIFN5bWJvbCxcbiAgYmxvYjpcbiAgICAnRmlsZVJlYWRlcicgaW4gZ2xvYmFsICYmXG4gICAgJ0Jsb2InIGluIGdsb2JhbCAmJlxuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ldyBCbG9iKClcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfSkoKSxcbiAgZm9ybURhdGE6ICdGb3JtRGF0YScgaW4gZ2xvYmFsLFxuICBhcnJheUJ1ZmZlcjogJ0FycmF5QnVmZmVyJyBpbiBnbG9iYWxcbn1cblxuZnVuY3Rpb24gaXNEYXRhVmlldyhvYmopIHtcbiAgcmV0dXJuIG9iaiAmJiBEYXRhVmlldy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihvYmopXG59XG5cbmlmIChzdXBwb3J0LmFycmF5QnVmZmVyKSB7XG4gIHZhciB2aWV3Q2xhc3NlcyA9IFtcbiAgICAnW29iamVjdCBJbnQ4QXJyYXldJyxcbiAgICAnW29iamVjdCBVaW50OEFycmF5XScsXG4gICAgJ1tvYmplY3QgVWludDhDbGFtcGVkQXJyYXldJyxcbiAgICAnW29iamVjdCBJbnQxNkFycmF5XScsXG4gICAgJ1tvYmplY3QgVWludDE2QXJyYXldJyxcbiAgICAnW29iamVjdCBJbnQzMkFycmF5XScsXG4gICAgJ1tvYmplY3QgVWludDMyQXJyYXldJyxcbiAgICAnW29iamVjdCBGbG9hdDMyQXJyYXldJyxcbiAgICAnW29iamVjdCBGbG9hdDY0QXJyYXldJ1xuICBdXG5cbiAgdmFyIGlzQXJyYXlCdWZmZXJWaWV3ID1cbiAgICBBcnJheUJ1ZmZlci5pc1ZpZXcgfHxcbiAgICBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmogJiYgdmlld0NsYXNzZXMuaW5kZXhPZihPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSkgPiAtMVxuICAgIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplTmFtZShuYW1lKSB7XG4gIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICBuYW1lID0gU3RyaW5nKG5hbWUpXG4gIH1cbiAgaWYgKC9bXmEtejAtOVxcLSMkJSYnKisuXl9gfH4hXS9pLnRlc3QobmFtZSkgfHwgbmFtZSA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGNoYXJhY3RlciBpbiBoZWFkZXIgZmllbGQgbmFtZTogXCInICsgbmFtZSArICdcIicpXG4gIH1cbiAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVWYWx1ZSh2YWx1ZSkge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgIHZhbHVlID0gU3RyaW5nKHZhbHVlKVxuICB9XG4gIHJldHVybiB2YWx1ZVxufVxuXG4vLyBCdWlsZCBhIGRlc3RydWN0aXZlIGl0ZXJhdG9yIGZvciB0aGUgdmFsdWUgbGlzdFxuZnVuY3Rpb24gaXRlcmF0b3JGb3IoaXRlbXMpIHtcbiAgdmFyIGl0ZXJhdG9yID0ge1xuICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHZhbHVlID0gaXRlbXMuc2hpZnQoKVxuICAgICAgcmV0dXJuIHtkb25lOiB2YWx1ZSA9PT0gdW5kZWZpbmVkLCB2YWx1ZTogdmFsdWV9XG4gICAgfVxuICB9XG5cbiAgaWYgKHN1cHBvcnQuaXRlcmFibGUpIHtcbiAgICBpdGVyYXRvcltTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gaXRlcmF0b3JcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaXRlcmF0b3Jcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEhlYWRlcnMoaGVhZGVycykge1xuICB0aGlzLm1hcCA9IHt9XG5cbiAgaWYgKGhlYWRlcnMgaW5zdGFuY2VvZiBIZWFkZXJzKSB7XG4gICAgaGVhZGVycy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7XG4gICAgICB0aGlzLmFwcGVuZChuYW1lLCB2YWx1ZSlcbiAgICB9LCB0aGlzKVxuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGVhZGVycykpIHtcbiAgICBoZWFkZXJzLmZvckVhY2goZnVuY3Rpb24oaGVhZGVyKSB7XG4gICAgICB0aGlzLmFwcGVuZChoZWFkZXJbMF0sIGhlYWRlclsxXSlcbiAgICB9LCB0aGlzKVxuICB9IGVsc2UgaWYgKGhlYWRlcnMpIHtcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhoZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHRoaXMuYXBwZW5kKG5hbWUsIGhlYWRlcnNbbmFtZV0pXG4gICAgfSwgdGhpcylcbiAgfVxufVxuXG5IZWFkZXJzLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICBuYW1lID0gbm9ybWFsaXplTmFtZShuYW1lKVxuICB2YWx1ZSA9IG5vcm1hbGl6ZVZhbHVlKHZhbHVlKVxuICB2YXIgb2xkVmFsdWUgPSB0aGlzLm1hcFtuYW1lXVxuICB0aGlzLm1hcFtuYW1lXSA9IG9sZFZhbHVlID8gb2xkVmFsdWUgKyAnLCAnICsgdmFsdWUgOiB2YWx1ZVxufVxuXG5IZWFkZXJzLnByb3RvdHlwZVsnZGVsZXRlJ10gPSBmdW5jdGlvbihuYW1lKSB7XG4gIGRlbGV0ZSB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXVxufVxuXG5IZWFkZXJzLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihuYW1lKSB7XG4gIG5hbWUgPSBub3JtYWxpemVOYW1lKG5hbWUpXG4gIHJldHVybiB0aGlzLmhhcyhuYW1lKSA/IHRoaXMubWFwW25hbWVdIDogbnVsbFxufVxuXG5IZWFkZXJzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHJldHVybiB0aGlzLm1hcC5oYXNPd25Qcm9wZXJ0eShub3JtYWxpemVOYW1lKG5hbWUpKVxufVxuXG5IZWFkZXJzLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXSA9IG5vcm1hbGl6ZVZhbHVlKHZhbHVlKVxufVxuXG5IZWFkZXJzLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLm1hcCkge1xuICAgIGlmICh0aGlzLm1hcC5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB0aGlzLm1hcFtuYW1lXSwgbmFtZSwgdGhpcylcbiAgICB9XG4gIH1cbn1cblxuSGVhZGVycy5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaXRlbXMgPSBbXVxuICB0aGlzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICBpdGVtcy5wdXNoKG5hbWUpXG4gIH0pXG4gIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbn1cblxuSGVhZGVycy5wcm90b3R5cGUudmFsdWVzID0gZnVuY3Rpb24oKSB7XG4gIHZhciBpdGVtcyA9IFtdXG4gIHRoaXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSkge1xuICAgIGl0ZW1zLnB1c2godmFsdWUpXG4gIH0pXG4gIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbn1cblxuSGVhZGVycy5wcm90b3R5cGUuZW50cmllcyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaXRlbXMgPSBbXVxuICB0aGlzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICBpdGVtcy5wdXNoKFtuYW1lLCB2YWx1ZV0pXG4gIH0pXG4gIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbn1cblxuaWYgKHN1cHBvcnQuaXRlcmFibGUpIHtcbiAgSGVhZGVycy5wcm90b3R5cGVbU3ltYm9sLml0ZXJhdG9yXSA9IEhlYWRlcnMucHJvdG90eXBlLmVudHJpZXNcbn1cblxuZnVuY3Rpb24gY29uc3VtZWQoYm9keSkge1xuICBpZiAoYm9keS5ib2R5VXNlZCkge1xuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgVHlwZUVycm9yKCdBbHJlYWR5IHJlYWQnKSlcbiAgfVxuICBib2R5LmJvZHlVc2VkID0gdHJ1ZVxufVxuXG5mdW5jdGlvbiBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpXG4gICAgfVxuICAgIHJlYWRlci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICByZWplY3QocmVhZGVyLmVycm9yKVxuICAgIH1cbiAgfSlcbn1cblxuZnVuY3Rpb24gcmVhZEJsb2JBc0FycmF5QnVmZmVyKGJsb2IpIHtcbiAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgdmFyIHByb21pc2UgPSBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKVxuICByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYilcbiAgcmV0dXJuIHByb21pc2Vcbn1cblxuZnVuY3Rpb24gcmVhZEJsb2JBc1RleHQoYmxvYikge1xuICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKVxuICB2YXIgcHJvbWlzZSA9IGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpXG4gIHJlYWRlci5yZWFkQXNUZXh0KGJsb2IpXG4gIHJldHVybiBwcm9taXNlXG59XG5cbmZ1bmN0aW9uIHJlYWRBcnJheUJ1ZmZlckFzVGV4dChidWYpIHtcbiAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShidWYpXG4gIHZhciBjaGFycyA9IG5ldyBBcnJheSh2aWV3Lmxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHZpZXcubGVuZ3RoOyBpKyspIHtcbiAgICBjaGFyc1tpXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUodmlld1tpXSlcbiAgfVxuICByZXR1cm4gY2hhcnMuam9pbignJylcbn1cblxuZnVuY3Rpb24gYnVmZmVyQ2xvbmUoYnVmKSB7XG4gIGlmIChidWYuc2xpY2UpIHtcbiAgICByZXR1cm4gYnVmLnNsaWNlKDApXG4gIH0gZWxzZSB7XG4gICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShidWYuYnl0ZUxlbmd0aClcbiAgICB2aWV3LnNldChuZXcgVWludDhBcnJheShidWYpKVxuICAgIHJldHVybiB2aWV3LmJ1ZmZlclxuICB9XG59XG5cbmZ1bmN0aW9uIEJvZHkoKSB7XG4gIHRoaXMuYm9keVVzZWQgPSBmYWxzZVxuXG4gIHRoaXMuX2luaXRCb2R5ID0gZnVuY3Rpb24oYm9keSkge1xuICAgIC8qXG4gICAgICBmZXRjaC1tb2NrIHdyYXBzIHRoZSBSZXNwb25zZSBvYmplY3QgaW4gYW4gRVM2IFByb3h5IHRvXG4gICAgICBwcm92aWRlIHVzZWZ1bCB0ZXN0IGhhcm5lc3MgZmVhdHVyZXMgc3VjaCBhcyBmbHVzaC4gSG93ZXZlciwgb25cbiAgICAgIEVTNSBicm93c2VycyB3aXRob3V0IGZldGNoIG9yIFByb3h5IHN1cHBvcnQgcG9sbHlmaWxscyBtdXN0IGJlIHVzZWQ7XG4gICAgICB0aGUgcHJveHktcG9sbHlmaWxsIGlzIHVuYWJsZSB0byBwcm94eSBhbiBhdHRyaWJ1dGUgdW5sZXNzIGl0IGV4aXN0c1xuICAgICAgb24gdGhlIG9iamVjdCBiZWZvcmUgdGhlIFByb3h5IGlzIGNyZWF0ZWQuIFRoaXMgY2hhbmdlIGVuc3VyZXNcbiAgICAgIFJlc3BvbnNlLmJvZHlVc2VkIGV4aXN0cyBvbiB0aGUgaW5zdGFuY2UsIHdoaWxlIG1haW50YWluaW5nIHRoZVxuICAgICAgc2VtYW50aWMgb2Ygc2V0dGluZyBSZXF1ZXN0LmJvZHlVc2VkIGluIHRoZSBjb25zdHJ1Y3RvciBiZWZvcmVcbiAgICAgIF9pbml0Qm9keSBpcyBjYWxsZWQuXG4gICAgKi9cbiAgICB0aGlzLmJvZHlVc2VkID0gdGhpcy5ib2R5VXNlZFxuICAgIHRoaXMuX2JvZHlJbml0ID0gYm9keVxuICAgIGlmICghYm9keSkge1xuICAgICAgdGhpcy5fYm9keVRleHQgPSAnJ1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLl9ib2R5VGV4dCA9IGJvZHlcbiAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYmxvYiAmJiBCbG9iLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICB0aGlzLl9ib2R5QmxvYiA9IGJvZHlcbiAgICB9IGVsc2UgaWYgKHN1cHBvcnQuZm9ybURhdGEgJiYgRm9ybURhdGEucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoYm9keSkpIHtcbiAgICAgIHRoaXMuX2JvZHlGb3JtRGF0YSA9IGJvZHlcbiAgICB9IGVsc2UgaWYgKHN1cHBvcnQuc2VhcmNoUGFyYW1zICYmIFVSTFNlYXJjaFBhcmFtcy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgdGhpcy5fYm9keVRleHQgPSBib2R5LnRvU3RyaW5nKClcbiAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYXJyYXlCdWZmZXIgJiYgc3VwcG9ydC5ibG9iICYmIGlzRGF0YVZpZXcoYm9keSkpIHtcbiAgICAgIHRoaXMuX2JvZHlBcnJheUJ1ZmZlciA9IGJ1ZmZlckNsb25lKGJvZHkuYnVmZmVyKVxuICAgICAgLy8gSUUgMTAtMTEgY2FuJ3QgaGFuZGxlIGEgRGF0YVZpZXcgYm9keS5cbiAgICAgIHRoaXMuX2JvZHlJbml0ID0gbmV3IEJsb2IoW3RoaXMuX2JvZHlBcnJheUJ1ZmZlcl0pXG4gICAgfSBlbHNlIGlmIChzdXBwb3J0LmFycmF5QnVmZmVyICYmIChBcnJheUJ1ZmZlci5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSB8fCBpc0FycmF5QnVmZmVyVmlldyhib2R5KSkpIHtcbiAgICAgIHRoaXMuX2JvZHlBcnJheUJ1ZmZlciA9IGJ1ZmZlckNsb25lKGJvZHkpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChib2R5KVxuICAgIH1cblxuICAgIGlmICghdGhpcy5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJykpIHtcbiAgICAgIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5oZWFkZXJzLnNldCgnY29udGVudC10eXBlJywgJ3RleHQvcGxhaW47Y2hhcnNldD1VVEYtOCcpXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlCbG9iICYmIHRoaXMuX2JvZHlCbG9iLnR5cGUpIHtcbiAgICAgICAgdGhpcy5oZWFkZXJzLnNldCgnY29udGVudC10eXBlJywgdGhpcy5fYm9keUJsb2IudHlwZSlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5zZWFyY2hQYXJhbXMgJiYgVVJMU2VhcmNoUGFyYW1zLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7Y2hhcnNldD1VVEYtOCcpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKHN1cHBvcnQuYmxvYikge1xuICAgIHRoaXMuYmxvYiA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgICByZXR1cm4gcmVqZWN0ZWRcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keUJsb2IpXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5ldyBCbG9iKFt0aGlzLl9ib2R5QXJyYXlCdWZmZXJdKSlcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUZvcm1EYXRhKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyBibG9iJylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobmV3IEJsb2IoW3RoaXMuX2JvZHlUZXh0XSkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5hcnJheUJ1ZmZlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikge1xuICAgICAgICB2YXIgaXNDb25zdW1lZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICAgIGlmIChpc0NvbnN1bWVkKSB7XG4gICAgICAgICAgcmV0dXJuIGlzQ29uc3VtZWRcbiAgICAgICAgfVxuICAgICAgICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFxuICAgICAgICAgICAgdGhpcy5fYm9keUFycmF5QnVmZmVyLmJ1ZmZlci5zbGljZShcbiAgICAgICAgICAgICAgdGhpcy5fYm9keUFycmF5QnVmZmVyLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgICAgIHRoaXMuX2JvZHlBcnJheUJ1ZmZlci5ieXRlT2Zmc2V0ICsgdGhpcy5fYm9keUFycmF5QnVmZmVyLmJ5dGVMZW5ndGhcbiAgICAgICAgICAgIClcbiAgICAgICAgICApXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsb2IoKS50aGVuKHJlYWRCbG9iQXNBcnJheUJ1ZmZlcilcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0aGlzLnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcmVqZWN0ZWQgPSBjb25zdW1lZCh0aGlzKVxuICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgcmV0dXJuIHJlamVjdGVkXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICByZXR1cm4gcmVhZEJsb2JBc1RleHQodGhpcy5fYm9keUJsb2IpXG4gICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVhZEFycmF5QnVmZmVyQXNUZXh0KHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikpXG4gICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5Rm9ybURhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyB0ZXh0JylcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5VGV4dClcbiAgICB9XG4gIH1cblxuICBpZiAoc3VwcG9ydC5mb3JtRGF0YSkge1xuICAgIHRoaXMuZm9ybURhdGEgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKGRlY29kZSlcbiAgICB9XG4gIH1cblxuICB0aGlzLmpzb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy50ZXh0KCkudGhlbihKU09OLnBhcnNlKVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSFRUUCBtZXRob2RzIHdob3NlIGNhcGl0YWxpemF0aW9uIHNob3VsZCBiZSBub3JtYWxpemVkXG52YXIgbWV0aG9kcyA9IFsnREVMRVRFJywgJ0dFVCcsICdIRUFEJywgJ09QVElPTlMnLCAnUE9TVCcsICdQVVQnXVxuXG5mdW5jdGlvbiBub3JtYWxpemVNZXRob2QobWV0aG9kKSB7XG4gIHZhciB1cGNhc2VkID0gbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgcmV0dXJuIG1ldGhvZHMuaW5kZXhPZih1cGNhc2VkKSA+IC0xID8gdXBjYXNlZCA6IG1ldGhvZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gUmVxdWVzdChpbnB1dCwgb3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUmVxdWVzdCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdQbGVhc2UgdXNlIHRoZSBcIm5ld1wiIG9wZXJhdG9yLCB0aGlzIERPTSBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLicpXG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keVxuXG4gIGlmIChpbnB1dCBpbnN0YW5jZW9mIFJlcXVlc3QpIHtcbiAgICBpZiAoaW5wdXQuYm9keVVzZWQpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FscmVhZHkgcmVhZCcpXG4gICAgfVxuICAgIHRoaXMudXJsID0gaW5wdXQudXJsXG4gICAgdGhpcy5jcmVkZW50aWFscyA9IGlucHV0LmNyZWRlbnRpYWxzXG4gICAgaWYgKCFvcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgIHRoaXMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKGlucHV0LmhlYWRlcnMpXG4gICAgfVxuICAgIHRoaXMubWV0aG9kID0gaW5wdXQubWV0aG9kXG4gICAgdGhpcy5tb2RlID0gaW5wdXQubW9kZVxuICAgIHRoaXMuc2lnbmFsID0gaW5wdXQuc2lnbmFsXG4gICAgaWYgKCFib2R5ICYmIGlucHV0Ll9ib2R5SW5pdCAhPSBudWxsKSB7XG4gICAgICBib2R5ID0gaW5wdXQuX2JvZHlJbml0XG4gICAgICBpbnB1dC5ib2R5VXNlZCA9IHRydWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhpcy51cmwgPSBTdHJpbmcoaW5wdXQpXG4gIH1cblxuICB0aGlzLmNyZWRlbnRpYWxzID0gb3B0aW9ucy5jcmVkZW50aWFscyB8fCB0aGlzLmNyZWRlbnRpYWxzIHx8ICdzYW1lLW9yaWdpbidcbiAgaWYgKG9wdGlvbnMuaGVhZGVycyB8fCAhdGhpcy5oZWFkZXJzKSB7XG4gICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICB9XG4gIHRoaXMubWV0aG9kID0gbm9ybWFsaXplTWV0aG9kKG9wdGlvbnMubWV0aG9kIHx8IHRoaXMubWV0aG9kIHx8ICdHRVQnKVxuICB0aGlzLm1vZGUgPSBvcHRpb25zLm1vZGUgfHwgdGhpcy5tb2RlIHx8IG51bGxcbiAgdGhpcy5zaWduYWwgPSBvcHRpb25zLnNpZ25hbCB8fCB0aGlzLnNpZ25hbFxuICB0aGlzLnJlZmVycmVyID0gbnVsbFxuXG4gIGlmICgodGhpcy5tZXRob2QgPT09ICdHRVQnIHx8IHRoaXMubWV0aG9kID09PSAnSEVBRCcpICYmIGJvZHkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCb2R5IG5vdCBhbGxvd2VkIGZvciBHRVQgb3IgSEVBRCByZXF1ZXN0cycpXG4gIH1cbiAgdGhpcy5faW5pdEJvZHkoYm9keSlcblxuICBpZiAodGhpcy5tZXRob2QgPT09ICdHRVQnIHx8IHRoaXMubWV0aG9kID09PSAnSEVBRCcpIHtcbiAgICBpZiAob3B0aW9ucy5jYWNoZSA9PT0gJ25vLXN0b3JlJyB8fCBvcHRpb25zLmNhY2hlID09PSAnbm8tY2FjaGUnKSB7XG4gICAgICAvLyBTZWFyY2ggZm9yIGEgJ18nIHBhcmFtZXRlciBpbiB0aGUgcXVlcnkgc3RyaW5nXG4gICAgICB2YXIgcmVQYXJhbVNlYXJjaCA9IC8oWz8mXSlfPVteJl0qL1xuICAgICAgaWYgKHJlUGFyYW1TZWFyY2gudGVzdCh0aGlzLnVybCkpIHtcbiAgICAgICAgLy8gSWYgaXQgYWxyZWFkeSBleGlzdHMgdGhlbiBzZXQgdGhlIHZhbHVlIHdpdGggdGhlIGN1cnJlbnQgdGltZVxuICAgICAgICB0aGlzLnVybCA9IHRoaXMudXJsLnJlcGxhY2UocmVQYXJhbVNlYXJjaCwgJyQxXz0nICsgbmV3IERhdGUoKS5nZXRUaW1lKCkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBPdGhlcndpc2UgYWRkIGEgbmV3ICdfJyBwYXJhbWV0ZXIgdG8gdGhlIGVuZCB3aXRoIHRoZSBjdXJyZW50IHRpbWVcbiAgICAgICAgdmFyIHJlUXVlcnlTdHJpbmcgPSAvXFw/L1xuICAgICAgICB0aGlzLnVybCArPSAocmVRdWVyeVN0cmluZy50ZXN0KHRoaXMudXJsKSA/ICcmJyA6ICc/JykgKyAnXz0nICsgbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuUmVxdWVzdC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBSZXF1ZXN0KHRoaXMsIHtib2R5OiB0aGlzLl9ib2R5SW5pdH0pXG59XG5cbmZ1bmN0aW9uIGRlY29kZShib2R5KSB7XG4gIHZhciBmb3JtID0gbmV3IEZvcm1EYXRhKClcbiAgYm9keVxuICAgIC50cmltKClcbiAgICAuc3BsaXQoJyYnKVxuICAgIC5mb3JFYWNoKGZ1bmN0aW9uKGJ5dGVzKSB7XG4gICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgdmFyIHNwbGl0ID0gYnl0ZXMuc3BsaXQoJz0nKVxuICAgICAgICB2YXIgbmFtZSA9IHNwbGl0LnNoaWZ0KCkucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgdmFyIHZhbHVlID0gc3BsaXQuam9pbignPScpLnJlcGxhY2UoL1xcKy9nLCAnICcpXG4gICAgICAgIGZvcm0uYXBwZW5kKGRlY29kZVVSSUNvbXBvbmVudChuYW1lKSwgZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSlcbiAgICAgIH1cbiAgICB9KVxuICByZXR1cm4gZm9ybVxufVxuXG5mdW5jdGlvbiBwYXJzZUhlYWRlcnMocmF3SGVhZGVycykge1xuICB2YXIgaGVhZGVycyA9IG5ldyBIZWFkZXJzKClcbiAgLy8gUmVwbGFjZSBpbnN0YW5jZXMgb2YgXFxyXFxuIGFuZCBcXG4gZm9sbG93ZWQgYnkgYXQgbGVhc3Qgb25lIHNwYWNlIG9yIGhvcml6b250YWwgdGFiIHdpdGggYSBzcGFjZVxuICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjNzIzMCNzZWN0aW9uLTMuMlxuICB2YXIgcHJlUHJvY2Vzc2VkSGVhZGVycyA9IHJhd0hlYWRlcnMucmVwbGFjZSgvXFxyP1xcbltcXHQgXSsvZywgJyAnKVxuICAvLyBBdm9pZGluZyBzcGxpdCB2aWEgcmVnZXggdG8gd29yayBhcm91bmQgYSBjb21tb24gSUUxMSBidWcgd2l0aCB0aGUgY29yZS1qcyAzLjYuMCByZWdleCBwb2x5ZmlsbFxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ2l0aHViL2ZldGNoL2lzc3Vlcy83NDhcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3psb2lyb2NrL2NvcmUtanMvaXNzdWVzLzc1MVxuICBwcmVQcm9jZXNzZWRIZWFkZXJzXG4gICAgLnNwbGl0KCdcXHInKVxuICAgIC5tYXAoZnVuY3Rpb24oaGVhZGVyKSB7XG4gICAgICByZXR1cm4gaGVhZGVyLmluZGV4T2YoJ1xcbicpID09PSAwID8gaGVhZGVyLnN1YnN0cigxLCBoZWFkZXIubGVuZ3RoKSA6IGhlYWRlclxuICAgIH0pXG4gICAgLmZvckVhY2goZnVuY3Rpb24obGluZSkge1xuICAgICAgdmFyIHBhcnRzID0gbGluZS5zcGxpdCgnOicpXG4gICAgICB2YXIga2V5ID0gcGFydHMuc2hpZnQoKS50cmltKClcbiAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gcGFydHMuam9pbignOicpLnRyaW0oKVxuICAgICAgICBoZWFkZXJzLmFwcGVuZChrZXksIHZhbHVlKVxuICAgICAgfVxuICAgIH0pXG4gIHJldHVybiBoZWFkZXJzXG59XG5cbkJvZHkuY2FsbChSZXF1ZXN0LnByb3RvdHlwZSlcblxuZXhwb3J0IGZ1bmN0aW9uIFJlc3BvbnNlKGJvZHlJbml0LCBvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBSZXNwb25zZSkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdQbGVhc2UgdXNlIHRoZSBcIm5ld1wiIG9wZXJhdG9yLCB0aGlzIERPTSBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLicpXG4gIH1cbiAgaWYgKCFvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IHt9XG4gIH1cblxuICB0aGlzLnR5cGUgPSAnZGVmYXVsdCdcbiAgdGhpcy5zdGF0dXMgPSBvcHRpb25zLnN0YXR1cyA9PT0gdW5kZWZpbmVkID8gMjAwIDogb3B0aW9ucy5zdGF0dXNcbiAgdGhpcy5vayA9IHRoaXMuc3RhdHVzID49IDIwMCAmJiB0aGlzLnN0YXR1cyA8IDMwMFxuICB0aGlzLnN0YXR1c1RleHQgPSBvcHRpb25zLnN0YXR1c1RleHQgPT09IHVuZGVmaW5lZCA/ICcnIDogJycgKyBvcHRpb25zLnN0YXR1c1RleHRcbiAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICB0aGlzLnVybCA9IG9wdGlvbnMudXJsIHx8ICcnXG4gIHRoaXMuX2luaXRCb2R5KGJvZHlJbml0KVxufVxuXG5Cb2R5LmNhbGwoUmVzcG9uc2UucHJvdG90eXBlKVxuXG5SZXNwb25zZS5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZSh0aGlzLl9ib2R5SW5pdCwge1xuICAgIHN0YXR1czogdGhpcy5zdGF0dXMsXG4gICAgc3RhdHVzVGV4dDogdGhpcy5zdGF0dXNUZXh0LFxuICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKHRoaXMuaGVhZGVycyksXG4gICAgdXJsOiB0aGlzLnVybFxuICB9KVxufVxuXG5SZXNwb25zZS5lcnJvciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobnVsbCwge3N0YXR1czogMCwgc3RhdHVzVGV4dDogJyd9KVxuICByZXNwb25zZS50eXBlID0gJ2Vycm9yJ1xuICByZXR1cm4gcmVzcG9uc2Vcbn1cblxudmFyIHJlZGlyZWN0U3RhdHVzZXMgPSBbMzAxLCAzMDIsIDMwMywgMzA3LCAzMDhdXG5cblJlc3BvbnNlLnJlZGlyZWN0ID0gZnVuY3Rpb24odXJsLCBzdGF0dXMpIHtcbiAgaWYgKHJlZGlyZWN0U3RhdHVzZXMuaW5kZXhPZihzdGF0dXMpID09PSAtMSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHN0YXR1cyBjb2RlJylcbiAgfVxuXG4gIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwge3N0YXR1czogc3RhdHVzLCBoZWFkZXJzOiB7bG9jYXRpb246IHVybH19KVxufVxuXG5leHBvcnQgdmFyIERPTUV4Y2VwdGlvbiA9IGdsb2JhbC5ET01FeGNlcHRpb25cbnRyeSB7XG4gIG5ldyBET01FeGNlcHRpb24oKVxufSBjYXRjaCAoZXJyKSB7XG4gIERPTUV4Y2VwdGlvbiA9IGZ1bmN0aW9uKG1lc3NhZ2UsIG5hbWUpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlXG4gICAgdGhpcy5uYW1lID0gbmFtZVxuICAgIHZhciBlcnJvciA9IEVycm9yKG1lc3NhZ2UpXG4gICAgdGhpcy5zdGFjayA9IGVycm9yLnN0YWNrXG4gIH1cbiAgRE9NRXhjZXB0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlKVxuICBET01FeGNlcHRpb24ucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gRE9NRXhjZXB0aW9uXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmZXRjaChpbnB1dCwgaW5pdCkge1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgUmVxdWVzdChpbnB1dCwgaW5pdClcblxuICAgIGlmIChyZXF1ZXN0LnNpZ25hbCAmJiByZXF1ZXN0LnNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICByZXR1cm4gcmVqZWN0KG5ldyBET01FeGNlcHRpb24oJ0Fib3J0ZWQnLCAnQWJvcnRFcnJvcicpKVxuICAgIH1cblxuICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKVxuXG4gICAgZnVuY3Rpb24gYWJvcnRYaHIoKSB7XG4gICAgICB4aHIuYWJvcnQoKVxuICAgIH1cblxuICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBzdGF0dXM6IHhoci5zdGF0dXMsXG4gICAgICAgIHN0YXR1c1RleHQ6IHhoci5zdGF0dXNUZXh0LFxuICAgICAgICBoZWFkZXJzOiBwYXJzZUhlYWRlcnMoeGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycygpIHx8ICcnKVxuICAgICAgfVxuICAgICAgb3B0aW9ucy51cmwgPSAncmVzcG9uc2VVUkwnIGluIHhociA/IHhoci5yZXNwb25zZVVSTCA6IG9wdGlvbnMuaGVhZGVycy5nZXQoJ1gtUmVxdWVzdC1VUkwnKVxuICAgICAgdmFyIGJvZHkgPSAncmVzcG9uc2UnIGluIHhociA/IHhoci5yZXNwb25zZSA6IHhoci5yZXNwb25zZVRleHRcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUobmV3IFJlc3BvbnNlKGJvZHksIG9wdGlvbnMpKVxuICAgICAgfSwgMClcbiAgICB9XG5cbiAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH0sIDApXG4gICAgfVxuXG4gICAgeGhyLm9udGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH0sIDApXG4gICAgfVxuXG4gICAgeGhyLm9uYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChuZXcgRE9NRXhjZXB0aW9uKCdBYm9ydGVkJywgJ0Fib3J0RXJyb3InKSlcbiAgICAgIH0sIDApXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZml4VXJsKHVybCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHVybCA9PT0gJycgJiYgZ2xvYmFsLmxvY2F0aW9uLmhyZWYgPyBnbG9iYWwubG9jYXRpb24uaHJlZiA6IHVybFxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gdXJsXG4gICAgICB9XG4gICAgfVxuXG4gICAgeGhyLm9wZW4ocmVxdWVzdC5tZXRob2QsIGZpeFVybChyZXF1ZXN0LnVybCksIHRydWUpXG5cbiAgICBpZiAocmVxdWVzdC5jcmVkZW50aWFscyA9PT0gJ2luY2x1ZGUnKSB7XG4gICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdHJ1ZVxuICAgIH0gZWxzZSBpZiAocmVxdWVzdC5jcmVkZW50aWFscyA9PT0gJ29taXQnKSB7XG4gICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gZmFsc2VcbiAgICB9XG5cbiAgICBpZiAoJ3Jlc3BvbnNlVHlwZScgaW4geGhyKSB7XG4gICAgICBpZiAoc3VwcG9ydC5ibG9iKSB7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYidcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHN1cHBvcnQuYXJyYXlCdWZmZXIgJiZcbiAgICAgICAgcmVxdWVzdC5oZWFkZXJzLmdldCgnQ29udGVudC1UeXBlJykgJiZcbiAgICAgICAgcmVxdWVzdC5oZWFkZXJzLmdldCgnQ29udGVudC1UeXBlJykuaW5kZXhPZignYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJykgIT09IC0xXG4gICAgICApIHtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcidcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaW5pdCAmJiB0eXBlb2YgaW5pdC5oZWFkZXJzID09PSAnb2JqZWN0JyAmJiAhKGluaXQuaGVhZGVycyBpbnN0YW5jZW9mIEhlYWRlcnMpKSB7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhpbml0LmhlYWRlcnMpLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihuYW1lLCBub3JtYWxpemVWYWx1ZShpbml0LmhlYWRlcnNbbmFtZV0pKVxuICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgcmVxdWVzdC5oZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgdmFsdWUpXG4gICAgICB9KVxuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0LnNpZ25hbCkge1xuICAgICAgcmVxdWVzdC5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBhYm9ydFhocilcblxuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBET05FIChzdWNjZXNzIG9yIGZhaWx1cmUpXG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgIHJlcXVlc3Quc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgYWJvcnRYaHIpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB4aHIuc2VuZCh0eXBlb2YgcmVxdWVzdC5fYm9keUluaXQgPT09ICd1bmRlZmluZWQnID8gbnVsbCA6IHJlcXVlc3QuX2JvZHlJbml0KVxuICB9KVxufVxuXG5mZXRjaC5wb2x5ZmlsbCA9IHRydWVcblxuaWYgKCFnbG9iYWwuZmV0Y2gpIHtcbiAgZ2xvYmFsLmZldGNoID0gZmV0Y2hcbiAgZ2xvYmFsLkhlYWRlcnMgPSBIZWFkZXJzXG4gIGdsb2JhbC5SZXF1ZXN0ID0gUmVxdWVzdFxuICBnbG9iYWwuUmVzcG9uc2UgPSBSZXNwb25zZVxufVxuIiwiLyogZXNsaW50LWRpc2FibGUgbm8tYml0d2lzZSwgbm8tY29uZC1hc3NpZ24gKi9cblxuLyoqXG4gKiBDaGVja3MgaWYgYW4gZWxlbWVudCBjb250YWlucyBhbm90aGVyIGdpdmVuIGVsZW1lbnQuXG4gKiBcbiAqIEBwYXJhbSBjb250ZXh0IHRoZSBjb250ZXh0IGVsZW1lbnRcbiAqIEBwYXJhbSBub2RlIHRoZSBlbGVtZW50IHRvIGNoZWNrXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNvbnRhaW5zKGNvbnRleHQsIG5vZGUpIHtcbiAgLy8gSFRNTCBET00gYW5kIFNWRyBET00gbWF5IGhhdmUgZGlmZmVyZW50IHN1cHBvcnQgbGV2ZWxzLFxuICAvLyBzbyB3ZSBuZWVkIHRvIGNoZWNrIG9uIGNvbnRleHQgaW5zdGVhZCBvZiBhIGRvY3VtZW50IHJvb3QgZWxlbWVudC5cbiAgaWYgKGNvbnRleHQuY29udGFpbnMpIHJldHVybiBjb250ZXh0LmNvbnRhaW5zKG5vZGUpO1xuICBpZiAoY29udGV4dC5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbikgcmV0dXJuIGNvbnRleHQgPT09IG5vZGUgfHwgISEoY29udGV4dC5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbihub2RlKSAmIDE2KTtcbn0iLCIvKipcbiAqIFJldHVybnMgdGhlIG93bmVyIGRvY3VtZW50IG9mIGEgZ2l2ZW4gZWxlbWVudC5cbiAqIFxuICogQHBhcmFtIG5vZGUgdGhlIGVsZW1lbnRcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gb3duZXJEb2N1bWVudChub2RlKSB7XG4gIHJldHVybiBub2RlICYmIG5vZGUub3duZXJEb2N1bWVudCB8fCBkb2N1bWVudDtcbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpc0RvY3VtZW50KGVsZW1lbnQpIHtcbiAgcmV0dXJuICdub2RlVHlwZScgaW4gZWxlbWVudCAmJiBlbGVtZW50Lm5vZGVUeXBlID09PSBkb2N1bWVudC5ET0NVTUVOVF9OT0RFO1xufSIsImltcG9ydCBpc0RvY3VtZW50IGZyb20gJy4vaXNEb2N1bWVudCc7XG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpc1dpbmRvdyhub2RlKSB7XG4gIGlmICgnd2luZG93JyBpbiBub2RlICYmIG5vZGUud2luZG93ID09PSBub2RlKSByZXR1cm4gbm9kZTtcbiAgaWYgKGlzRG9jdW1lbnQobm9kZSkpIHJldHVybiBub2RlLmRlZmF1bHRWaWV3IHx8IGZhbHNlO1xuICByZXR1cm4gZmFsc2U7XG59IiwiaW1wb3J0IGlzV2luZG93IGZyb20gJy4vaXNXaW5kb3cnO1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0c2Nyb2xsQWNjZXNzb3Iob2Zmc2V0KSB7XG4gIHZhciBwcm9wID0gb2Zmc2V0ID09PSAncGFnZVhPZmZzZXQnID8gJ3Njcm9sbExlZnQnIDogJ3Njcm9sbFRvcCc7XG5cbiAgZnVuY3Rpb24gc2Nyb2xsQWNjZXNzb3Iobm9kZSwgdmFsKSB7XG4gICAgdmFyIHdpbiA9IGlzV2luZG93KG5vZGUpO1xuXG4gICAgaWYgKHZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gd2luID8gd2luW29mZnNldF0gOiBub2RlW3Byb3BdO1xuICAgIH1cblxuICAgIGlmICh3aW4pIHtcbiAgICAgIHdpbi5zY3JvbGxUbyh3aW5bb2Zmc2V0XSwgdmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZVtwcm9wXSA9IHZhbDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc2Nyb2xsQWNjZXNzb3I7XG59IiwiaW1wb3J0IGdldFNjcm9sbEFjY2Vzc29yIGZyb20gJy4vZ2V0U2Nyb2xsQWNjZXNzb3InO1xuLyoqXG4gKiBHZXRzIG9yIHNldHMgdGhlIHNjcm9sbCBsZWZ0IHBvc2l0aW9uIG9mIGEgZ2l2ZW4gZWxlbWVudC5cbiAqIFxuICogQHBhcmFtIG5vZGUgdGhlIGVsZW1lbnRcbiAqIEBwYXJhbSB2YWwgdGhlIHBvc2l0aW9uIHRvIHNldFxuICovXG5cbmV4cG9ydCBkZWZhdWx0IGdldFNjcm9sbEFjY2Vzc29yKCdwYWdlWE9mZnNldCcpOyIsImltcG9ydCBnZXRTY3JvbGxBY2Nlc3NvciBmcm9tICcuL2dldFNjcm9sbEFjY2Vzc29yJztcbi8qKlxuICogR2V0cyBvciBzZXRzIHRoZSBzY3JvbGwgdG9wIHBvc2l0aW9uIG9mIGEgZ2l2ZW4gZWxlbWVudC5cbiAqIFxuICogQHBhcmFtIG5vZGUgdGhlIGVsZW1lbnRcbiAqIEBwYXJhbSB2YWwgdGhlIHBvc2l0aW9uIHRvIHNldFxuICovXG5cbmV4cG9ydCBkZWZhdWx0IGdldFNjcm9sbEFjY2Vzc29yKCdwYWdlWU9mZnNldCcpOyIsImltcG9ydCBjb250YWlucyBmcm9tICcuL2NvbnRhaW5zJztcbmltcG9ydCBvd25lckRvY3VtZW50IGZyb20gJy4vb3duZXJEb2N1bWVudCc7XG5pbXBvcnQgc2Nyb2xsTGVmdCBmcm9tICcuL3Njcm9sbExlZnQnO1xuaW1wb3J0IHNjcm9sbFRvcCBmcm9tICcuL3Njcm9sbFRvcCc7XG4vKipcbiAqIFJldHVybnMgdGhlIG9mZnNldCBvZiBhIGdpdmVuIGVsZW1lbnQsIGluY2x1ZGluZyB0b3AgYW5kIGxlZnQgcG9zaXRpb25zLCB3aWR0aCBhbmQgaGVpZ2h0LlxuICogXG4gKiBAcGFyYW0gbm9kZSB0aGUgZWxlbWVudFxuICovXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIG9mZnNldChub2RlKSB7XG4gIHZhciBkb2MgPSBvd25lckRvY3VtZW50KG5vZGUpO1xuICB2YXIgYm94ID0ge1xuICAgIHRvcDogMCxcbiAgICBsZWZ0OiAwLFxuICAgIGhlaWdodDogMCxcbiAgICB3aWR0aDogMFxuICB9O1xuICB2YXIgZG9jRWxlbSA9IGRvYyAmJiBkb2MuZG9jdW1lbnRFbGVtZW50OyAvLyBNYWtlIHN1cmUgaXQncyBub3QgYSBkaXNjb25uZWN0ZWQgRE9NIG5vZGVcblxuICBpZiAoIWRvY0VsZW0gfHwgIWNvbnRhaW5zKGRvY0VsZW0sIG5vZGUpKSByZXR1cm4gYm94O1xuICBpZiAobm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QgIT09IHVuZGVmaW5lZCkgYm94ID0gbm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgYm94ID0ge1xuICAgIHRvcDogYm94LnRvcCArIHNjcm9sbFRvcChkb2NFbGVtKSAtIChkb2NFbGVtLmNsaWVudFRvcCB8fCAwKSxcbiAgICBsZWZ0OiBib3gubGVmdCArIHNjcm9sbExlZnQoZG9jRWxlbSkgLSAoZG9jRWxlbS5jbGllbnRMZWZ0IHx8IDApLFxuICAgIHdpZHRoOiBib3gud2lkdGgsXG4gICAgaGVpZ2h0OiBib3guaGVpZ2h0XG4gIH07XG4gIHJldHVybiBib3g7XG59IiwiaW1wb3J0IHsgX19zcHJlYWRBcnJheSB9IGZyb20gXCJ0c2xpYlwiO1xuaW1wb3J0IFwid2hhdHdnLWZldGNoXCI7XG5pbXBvcnQgb2Zmc2V0IGZyb20gXCJkb20taGVscGVycy9vZmZzZXRcIjtcbnZhciBTRlJlc3VsdHMgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFNGUmVzdWx0cyhkYXRhLCBwYXJlbnQpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdGhpcy5pdGVtcyA9IFtdO1xuICAgICAgICB0aGlzLmlzU3RyaW5nID0gZnVuY3Rpb24gKHN0cikgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN0cikgPT09IFwiW29iamVjdCBTdHJpbmddXCI7IH07XG4gICAgICAgIHRoaXMuaXRlbXMgPSBbXTtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ1bFwiKTtcbiAgICAgICAgdmFyIF9hID0gdGhpcy5wYXJlbnQsIG9wdGlvbnMgPSBfYS5vcHRpb25zLCBpbnB1dCA9IF9hLmlucHV0O1xuICAgICAgICBpZiAodGhpcy5pc1N0cmluZyhkYXRhKSkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdHNfMSA9IFtdO1xuICAgICAgICAgICAgZGF0YS5zcGxpdChcIixcIikubWFwKGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgICAgICAgICB2YXIgZG0gPSB2YWwuc3BsaXQoXCI6XCIpO1xuICAgICAgICAgICAgICAgIGlmIChkbS5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG1bMV0uaW5kZXhPZihpbnB1dC52YWx1ZSkgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0c18xLnB1c2goeyB2YWx1ZTogZG1bMF0sIGxhYmVsOiBkbVsxXSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChkbS5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsLmluZGV4T2YoaW5wdXQudmFsdWUpID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNfMS5wdXNoKHsgdmFsdWU6IHZhbCwgbGFiZWw6IHZhbCB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVzdWx0c18xLm1hcChmdW5jdGlvbiAoX2EpIHtcbiAgICAgICAgICAgICAgICB2YXIgbGFiZWwgPSBfYS5sYWJlbCwgdmFsdWUgPSBfYS52YWx1ZTtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG4gICAgICAgICAgICAgICAgY2hpbGQuY2xhc3NMaXN0LmFkZChcInNmLWxua1wiKTtcbiAgICAgICAgICAgICAgICBjaGlsZC5pbm5lckhUTUwgPSBsYWJlbDtcbiAgICAgICAgICAgICAgICBjaGlsZC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXZhbHVlXCIsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5pdGVtcy5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMoZGF0YSkubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IGRhdGFba2V5XTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLm1hcChmdW5jdGlvbiAoX2EpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFsbCA9IF9hLmFsbCwgY2xhc3NfbmFtZSA9IF9hLmNsYXNzX25hbWUsIHRlbXBsYXRlID0gX2EudGVtcGxhdGUsIHRpdGxlID0gX2EudGl0bGU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhbGwgJiYgYWxsLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRpdGxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxpXzEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlfMS5jbGFzc0xpc3QuYWRkKFwic2YtaGVhZGVyXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpXzEuaW5uZXJUZXh0ID0gdGl0bGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChsaV8xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGl2LmNsYXNzTGlzdC5hZGQoXCJzZi1yZXN1bHQtY29udGFpbmVyXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHVsXzEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidWxcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbGwubWFwKGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX2E7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjbGFzc2VzID0gY2xhc3NfbmFtZSA/IGNsYXNzX25hbWUuc3BsaXQoXCIgXCIpLm1hcChmdW5jdGlvbiAodikgeyByZXR1cm4gdi50cmltKCk7IH0pIDogW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKF9hID0gY2hpbGQuY2xhc3NMaXN0KS5hZGQuYXBwbHkoX2EsIF9fc3ByZWFkQXJyYXkoW1wic2YtbG5rXCJdLCBjbGFzc2VzLCBmYWxzZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkLmlubmVySFRNTCA9IF90aGlzLnJlcGxhY2VSZXN1bHRzKHJlc3VsdCwgdGVtcGxhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVsXzEuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLml0ZW1zLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXYuYXBwZW5kQ2hpbGQodWxfMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaS5hcHBlbmRDaGlsZChkaXYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChsaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmICghb3B0aW9ucy5jYWxsYmFjaykge1xuICAgICAgICAgICAgdmFyIG5UZW1wbGF0ZSA9IEFqYXh5TGl2ZVNlYXJjaFNldHRpbmdzLm1vcmU7XG4gICAgICAgICAgICBuVGVtcGxhdGUgPSBuVGVtcGxhdGUucmVwbGFjZSgve3NlYXJjaF92YWx1ZV9lc2NhcGVkfS9nLCBcIlwiLmNvbmNhdChpbnB1dC52YWx1ZSkpO1xuICAgICAgICAgICAgblRlbXBsYXRlID0gblRlbXBsYXRlLnJlcGxhY2UoL3tzZWFyY2hfdXJsX2VzY2FwZWR9L2csIG9wdGlvbnMuc2VhcmNoVXJsLnJlcGxhY2UoXCIlc1wiLCBlbmNvZGVVUkkoaW5wdXQudmFsdWUpKSk7XG4gICAgICAgICAgICBuVGVtcGxhdGUgPSBuVGVtcGxhdGUucmVwbGFjZSgve3NlYXJjaF92YWx1ZX0vZywgXCJcIi5jb25jYXQoaW5wdXQudmFsdWUpKTtcbiAgICAgICAgICAgIG5UZW1wbGF0ZSA9IG5UZW1wbGF0ZS5yZXBsYWNlKC97dG90YWx9L2csIHRoaXMuaXRlbXMubGVuZ3RoKTtcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcbiAgICAgICAgICAgIGNoaWxkLmNsYXNzTGlzdC5hZGQoXCJzZi1sbmtcIiwgXCJzZi1tb3JlXCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuaXRlbXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgICAgICBjaGlsZC5jbGFzc0xpc3QuYWRkKFwic2Ytc2VsZWN0ZWRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaGlsZC5pbm5lckhUTUwgPSBuVGVtcGxhdGU7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5wdXNoKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxvYWRMaXZlRXZlbnRzKG9wdGlvbnMuY2FsbGJhY2spO1xuICAgIH1cbiAgICBTRlJlc3VsdHMucHJvdG90eXBlLmxvYWRMaXZlRXZlbnRzID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIHRoaXMuaXRlbXMubWFwKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5pdGVtcy5tYXAoZnVuY3Rpb24gKHhpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIHhpdGVtICE9IGl0ZW0gJiYgeGl0ZW0uY2xhc3NMaXN0LnJlbW92ZShcInNmLXNlbGVjdGVkXCIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGl0ZW0uY2xhc3NMaXN0LmFkZChcInNmLXNlbGVjdGVkXCIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMubWFwKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvd1tjYWxsYmFja10oaXRlbSwgX3RoaXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbGVydChlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgaWYgKF90aGlzLnBhcmVudC5tYWluRWxlbS5zdHlsZS5kaXNwbGF5ICE9IFwibm9uZVwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LmtleSA9PSBcIkFycm93VXBcIiB8fCBldmVudC5rZXkgPT0gXCJBcnJvd0Rvd25cIikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2luZGV4ID0gLTE7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5pdGVtcy5zb21lKGZ1bmN0aW9uIChpdGVtLCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW0uY2xhc3NMaXN0LmNvbnRhaW5zKFwic2Ytc2VsZWN0ZWRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaW5kZXggPSBpbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjdXJyZW50SW5kZXggPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50LmtleSA9PSBcIkFycm93RG93blwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2luZGV4ICsgMSA8IF90aGlzLml0ZW1zLmxlbmd0aCAmJiBfdGhpcy5pdGVtc1tzaW5kZXggKyAxXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRJbmRleCA9IHNpbmRleCArIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZXZlbnQua2V5ID09IFwiQXJyb3dVcFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2luZGV4IC0gMSA+IDAgJiYgX3RoaXMuaXRlbXNbc2luZGV4IC0gMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50SW5kZXggPSBzaW5kZXggLSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudEluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudEluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLml0ZW1zLm1hcChmdW5jdGlvbiAoaXRlbSkgeyByZXR1cm4gaXRlbS5jbGFzc0xpc3QucmVtb3ZlKFwic2Ytc2VsZWN0ZWRcIik7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuaXRlbXNbY3VycmVudEluZGV4XS5jbGFzc0xpc3QuYWRkKFwic2Ytc2VsZWN0ZWRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5pdGVtc1tjdXJyZW50SW5kZXhdLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZXZlbnQua2V5ID09IFwiRXNjYXBlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMucGFyZW50Lm1haW5FbGVtLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZXZlbnQua2V5ID09IFwiRW50ZXJcIikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VsZWN0ZWQgPSBfdGhpcy5pdGVtcy5maWx0ZXIoZnVuY3Rpb24gKGl0ZW0pIHsgcmV0dXJuIGl0ZW0uY2xhc3NMaXN0LmNvbnRhaW5zKFwic2Ytc2VsZWN0ZWRcIik7IH0pO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaHJlZiA9IF90aGlzLnBhcmVudC5vcHRpb25zLnNlYXJjaFVybC5yZXBsYWNlKFwiJXNcIiwgZW5jb2RlVVJJKF90aGlzLnBhcmVudC5pbnB1dC52YWx1ZSkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZWN0ZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaHJlZiA9IHNlbGVjdGVkWzBdLnF1ZXJ5U2VsZWN0b3IoXCJhXCIpLmhyZWY7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGhyZWYgJiYgaHJlZiAhPSBcIlwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3dbY2FsbGJhY2tdKHNlbGVjdGVkLmxlbmd0aCA/IHNlbGVjdGVkWzBdIDogbnVsbCwgX3RoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBocmVmO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFNGUmVzdWx0cy5wcm90b3R5cGUucmVwbGFjZVJlc3VsdHMgPSBmdW5jdGlvbiAocmVzdWx0cywgdGVtcGxhdGUpIHtcbiAgICAgICAgZm9yICh2YXIgcyBpbiByZXN1bHRzKSB7XG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UobmV3IFJlZ0V4cChcIntcIiArIHMgKyBcIn1cIiwgXCJnXCIpLCByZXN1bHRzW3NdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGVtcGxhdGU7XG4gICAgfTtcbiAgICByZXR1cm4gU0ZSZXN1bHRzO1xufSgpKTtcbnZhciBTRiA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gU0Yoc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5pbnB1dCA9IG51bGw7XG4gICAgICAgIHRoaXMudGltZW91dCA9IG51bGw7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdHMgPSB7XG4gICAgICAgICAgICBkZWxheTogNTAwLFxuICAgICAgICAgICAgbGVmdE9mZnNldDogMCxcbiAgICAgICAgICAgIHRvcE9mZnNldDogNSxcbiAgICAgICAgICAgIHRleHQ6IFwiU2VhcmNoIEZvclwiLFxuICAgICAgICAgICAgaXdpZHRoOiAxODAsXG4gICAgICAgICAgICB3aWR0aDogXCIzMTVweFwiLFxuICAgICAgICAgICAgYWpheFVybDogXCJcIixcbiAgICAgICAgICAgIGFqYXhEYXRhOiBudWxsLFxuICAgICAgICAgICAgc2VhcmNoVXJsOiBcIlwiLFxuICAgICAgICAgICAgY2FsbGJhY2s6IGZhbHNlLFxuICAgICAgICAgICAgcnRsOiBmYWxzZSxcbiAgICAgICAgICAgIHNlYXJjaDogZmFsc2UsXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuaW5wdXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICAgICAgaWYgKCF0aGlzLmlucHV0KSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJBamF4eSBMaXZlIFNlYXJjaCBjYW4ndCBmaW5kIGlucHV0IFwiLmNvbmNhdChzZWxlY3RvcikpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGltZW91dCA9IG51bGw7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IE9iamVjdC5hc3NpZ24odGhpcy5kZWZhdWx0cywgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuYXR0cih7IHBsYWNlaG9sZGVyOiBvcHRpb25zLnRleHQsIGF1dG9jb21wbGV0ZTogXCJvZmZcIiB9LCB0aGlzLmlucHV0KTtcbiAgICAgICAgdGhpcy5tYWluRWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHRoaXMubWFpbkVsZW0uY2xhc3NMaXN0LmFkZChcInNmLWNvbnRhaW5lclwiKTtcbiAgICAgICAgdmFyIHVzZXJBZ2VudCA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50O1xuICAgICAgICBpZiAodXNlckFnZW50LmluZGV4T2YoXCJXaW5cIikgIT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMubWFpbkVsZW0uY2xhc3NMaXN0LmFkZChcInNmLXdpbmRvd3NcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5ydGwpIHtcbiAgICAgICAgICAgIHRoaXMubWFpbkVsZW0uY2xhc3NMaXN0LmFkZChcInNmLXJ0bFwiKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1haW5FbGVtLnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xuICAgICAgICB0aGlzLm1haW5FbGVtLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgdGhpcy5tYWluRWxlbS5zdHlsZS53aWR0aCA9IFwiXCIuY29uY2F0KG9wdGlvbnMud2lkdGgpO1xuICAgICAgICB0aGlzLm1haW5FbGVtLnN0eWxlLnpJbmRleCA9IFwiOTk5OVwiO1xuICAgICAgICB2YXIgbWFpbkNvbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICBtYWluQ29udC5jbGFzc0xpc3QuYWRkKFwic2Ytc2ItY29udFwiKTtcbiAgICAgICAgdmFyIHRvcENvbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICB0b3BDb250LmNsYXNzTGlzdC5hZGQoXCJzZi1zYi10b3BcIik7XG4gICAgICAgIHZhciBib3R0b21Db250ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgYm90dG9tQ29udC5jbGFzc0xpc3QuYWRkKFwic2Ytc2ItYm90dG9tXCIpO1xuICAgICAgICBtYWluQ29udC5hcHBlbmRDaGlsZCh0b3BDb250KTtcbiAgICAgICAgdGhpcy5yZXN1bHRzRWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHRoaXMucmVzdWx0c0VsZW0uY2xhc3NMaXN0LmFkZChcInNmLXJlc3VsdHNcIik7XG4gICAgICAgIHRoaXMudmFsRWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHRoaXMudmFsRWxlbS5jbGFzc0xpc3QuYWRkKFwic2YtdmFsXCIpO1xuICAgICAgICB0aGlzLnJlc3VsdHNFbGVtLmFwcGVuZENoaWxkKHRoaXMudmFsRWxlbSk7XG4gICAgICAgIG1haW5Db250LmFwcGVuZENoaWxkKHRoaXMucmVzdWx0c0VsZW0pO1xuICAgICAgICBtYWluQ29udC5hcHBlbmRDaGlsZChib3R0b21Db250KTtcbiAgICAgICAgdGhpcy5tYWluRWxlbS5hcHBlbmRDaGlsZChtYWluQ29udCk7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5tYWluRWxlbSk7XG4gICAgICAgIHRoaXMubG9hZEV2ZW50cygpO1xuICAgIH1cbiAgICBTRi5wcm90b3R5cGUuYXR0ciA9IGZ1bmN0aW9uIChhdHRycywgZWxtKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGF0dHJzKS5tYXAoZnVuY3Rpb24gKGF0dHIpIHtcbiAgICAgICAgICAgIGVsbS5zZXRBdHRyaWJ1dGUoYXR0ciwgYXR0cnNbYXR0cl0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFNGLnByb3RvdHlwZS5sb2FkZXIgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdmFyIHVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInVsXCIpO1xuICAgICAgICB2YXIgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG4gICAgICAgIGxpLmNsYXNzTGlzdC5hZGQoXCJzZi1sbmtcIiwgXCJzZi1tb3JlXCIsIFwic2Ytc2VsZWN0ZWRcIik7XG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImFcIik7XG4gICAgICAgIGxpbmsuY2xhc3NMaXN0LmFkZChcInNmLWxvYWRpbmdcIik7XG4gICAgICAgIGxpbmsuaHJlZiA9IHRoaXMub3B0aW9ucy5zZWFyY2hVcmwucmVwbGFjZShcIiVzXCIsIGVuY29kZVVSSSh2YWx1ZSkpO1xuICAgICAgICBsaS5hcHBlbmRDaGlsZChsaW5rKTtcbiAgICAgICAgdWwuYXBwZW5kQ2hpbGQobGkpO1xuICAgICAgICB0aGlzLnZhbEVsZW0uaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgdGhpcy52YWxFbGVtLmFwcGVuZENoaWxkKHVsKTtcbiAgICB9O1xuICAgIFNGLnByb3RvdHlwZS5sb2FkUmVzdWx0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMuaW5wdXQudmFsdWUgIT0gXCJcIikge1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIodGhpcy5pbnB1dC52YWx1ZSk7XG4gICAgICAgICAgICB0aGlzLm1haW5FbGVtLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICAgICAgICB0aGlzLmFkanVzdFBvc2l0aW9uKCk7XG4gICAgICAgICAgICB2YXIgZGF0YV8xID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICAgICAgICBkYXRhXzEuYXBwZW5kKFwiYWN0aW9uXCIsIFwiYWpheHlfc2ZcIik7XG4gICAgICAgICAgICBkYXRhXzEuYXBwZW5kKFwidmFsdWVcIiwgdGhpcy5pbnB1dC52YWx1ZSk7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmFqYXhEYXRhKSB7XG4gICAgICAgICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLm9wdGlvbnMuYWpheERhdGEpO1xuICAgICAgICAgICAgICAgIGtleXMubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YV8xLmFwcGVuZChrZXksIF90aGlzLm9wdGlvbnMuYWpheERhdGFba2V5XSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnNlYXJjaCkge1xuICAgICAgICAgICAgICAgIHZhciBuUmVzdWx0cyA9IG5ldyBTRlJlc3VsdHModGhpcy5vcHRpb25zLnNlYXJjaCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy52YWxFbGVtLmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgICAgICAgICAgdGhpcy52YWxFbGVtLmFwcGVuZENoaWxkKG5SZXN1bHRzLmVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMubWFpbkVsZW0uc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGZldGNoKHRoaXMub3B0aW9ucy5hamF4VXJsLCB7XG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IGRhdGFfMSxcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcInBvc3RcIixcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIC5qc29uKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5wYXJzZVJlc3VsdHMocmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5wYXJzZVJlc3VsdHMoW10pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMucGFyc2VSZXN1bHRzKFtdKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubWFpbkVsZW0uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBTRi5wcm90b3R5cGUuYWRqdXN0UG9zaXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwb3MgPSB0aGlzLmJvdW5kcyh0aGlzLmlucHV0LCB0aGlzLm9wdGlvbnMpO1xuICAgICAgICBpZiAoIXBvcyB8fCB0aGlzLm1haW5FbGVtLnN0eWxlLmRpc3BsYXkgPT0gXCJub25lXCIpIHtcbiAgICAgICAgICAgIHRoaXMubWFpbkVsZW0uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChNYXRoLmNlaWwocG9zLmxlZnQpICsgcGFyc2VJbnQodGhpcy5vcHRpb25zLndpZHRoLCAxMCkgPiB3aW5kb3cuaW5uZXJXaWR0aCkge1xuICAgICAgICAgICAgdGhpcy5tYWluRWxlbS5zdHlsZS53aWR0aCA9IFwiXCIuY29uY2F0KHdpbmRvdy5pbm5lcldpZHRoIC0gcG9zLmxlZnQgLSAyMCwgXCJweFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJ0bCkge1xuICAgICAgICAgICAgdGhpcy5tYWluRWxlbS5zdHlsZS50b3AgPSBcIlwiLmNvbmNhdChwb3MuYm90dG9tLCBcInB4XCIpO1xuICAgICAgICAgICAgdGhpcy5tYWluRWxlbS5zdHlsZS5sZWZ0ID0gXCJcIi5jb25jYXQocG9zLnJpZ2h0LCBcInB4XCIpO1xuICAgICAgICAgICAgdGhpcy5tYWluRWxlbS5zdHlsZS5yaWdodCA9IFwiYXV0b1wiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5tYWluRWxlbS5zdHlsZS50b3AgPSBcIlwiLmNvbmNhdChwb3MuYm90dG9tLCBcInB4XCIpO1xuICAgICAgICAgICAgdGhpcy5tYWluRWxlbS5zdHlsZS5sZWZ0ID0gXCJcIi5jb25jYXQocG9zLmxlZnQsIFwicHhcIik7XG4gICAgICAgICAgICB0aGlzLm1haW5FbGVtLnN0eWxlLnJpZ2h0ID0gXCJhdXRvXCI7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFNGLnByb3RvdHlwZS5wYXJzZVJlc3VsdHMgPSBmdW5jdGlvbiAocmVzdWx0cykge1xuICAgICAgICB2YXIgblJlc3VsdHMgPSBuZXcgU0ZSZXN1bHRzKHJlc3VsdHMsIHRoaXMpO1xuICAgICAgICB0aGlzLnZhbEVsZW0uaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgdGhpcy52YWxFbGVtLmFwcGVuZENoaWxkKG5SZXN1bHRzLmVsZW1lbnQpO1xuICAgICAgICB0aGlzLm1haW5FbGVtLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgfTtcbiAgICBTRi5wcm90b3R5cGUuYm91bmRzID0gZnVuY3Rpb24gKGVsZW0sIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGVsbU9mZnNldCA9IG9mZnNldChlbGVtKTtcbiAgICAgICAgaWYgKGVsbU9mZnNldCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0b3A6IGVsbU9mZnNldC50b3AsXG4gICAgICAgICAgICAgICAgbGVmdDogZWxtT2Zmc2V0LmxlZnQgKyBvcHRpb25zLmxlZnRPZmZzZXQsXG4gICAgICAgICAgICAgICAgYm90dG9tOiBlbG1PZmZzZXQudG9wICsgZWxlbS5jbGllbnRIZWlnaHQgKyBvcHRpb25zLnRvcE9mZnNldCxcbiAgICAgICAgICAgICAgICByaWdodDogZWxtT2Zmc2V0LmxlZnQgLSB0aGlzLm1haW5FbGVtLmNsaWVudFdpZHRoICsgZWxlbS5jbGllbnRXaWR0aCxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFNGLnByb3RvdHlwZS5oaWRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLm1haW5FbGVtICYmICh0aGlzLm1haW5FbGVtLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIik7XG4gICAgfTtcbiAgICBTRi5wcm90b3R5cGUubG9hZEV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKF90aGlzLm1haW5FbGVtLnN0eWxlLmRpc3BsYXkgPT0gXCJub25lXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfdGhpcy5hZGp1c3RQb3NpdGlvbigpO1xuICAgICAgICB9KTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKF90aGlzLm1haW5FbGVtLnN0eWxlLmRpc3BsYXkgPT0gXCJub25lXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfdGhpcy5hZGp1c3RQb3NpdGlvbigpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5pbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQua2V5ICE9IFwiQXJyb3dVcFwiICYmXG4gICAgICAgICAgICAgICAgZXZlbnQua2V5ICE9IFwiQXJyb3dEb3duXCIgJiZcbiAgICAgICAgICAgICAgICBldmVudC5rZXkgIT0gXCJFbnRlclwiICYmXG4gICAgICAgICAgICAgICAgZXZlbnQua2V5ICE9IFwiRXNjYXBlXCIgJiZcbiAgICAgICAgICAgICAgICBldmVudC5rZXkgIT0gXCJBcnJvd1JpZ2h0XCIgJiZcbiAgICAgICAgICAgICAgICBldmVudC5rZXkgIT0gXCJBcnJvd0xlZnRcIikge1xuICAgICAgICAgICAgICAgIGlmIChfdGhpcy50aW1lb3V0ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KF90aGlzLnRpbWVvdXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBfdGhpcy5tYWluRWxlbS5jbGFzc0xpc3QuYWRkKFwic2YtZm9jdXNlZFwiKTtcbiAgICAgICAgICAgICAgICBfdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmxvYWRSZXN1bHRzKCk7XG4gICAgICAgICAgICAgICAgfSwgX3RoaXMub3B0aW9ucy5kZWxheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5oaWRlLmJpbmQodGhpcykpO1xuICAgIH07XG4gICAgcmV0dXJuIFNGO1xufSgpKTtcbnZhciByZWFkeSA9IGZ1bmN0aW9uIChmbikge1xuICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlICE9IFwibG9hZGluZ1wiKSB7XG4gICAgICAgIGZuKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCBmbik7XG4gICAgfVxufTtcbndpbmRvdy5TRkJveGVzID0ge307XG5yZWFkeShmdW5jdGlvbiAoKSB7XG4gICAgQWpheHlMaXZlU2VhcmNoU2V0dGluZ3MuYm94ZXMubWFwKGZ1bmN0aW9uIChib3gpIHtcbiAgICAgICAgaWYgKCF3aW5kb3cuU0ZCb3hlc1tib3guc2VsZWN0b3JdKSB7XG4gICAgICAgICAgICB3aW5kb3cuU0ZCb3hlc1tib3guc2VsZWN0b3JdID0gbmV3IFNGKGJveC5zZWxlY3RvciwgYm94Lm9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcbndpbmRvdy5TRiA9IFNGO1xuIl0sIm5hbWVzIjpbImZldGNoIiwiZ2V0U2Nyb2xsQWNjZXNzb3IiXSwibWFwcGluZ3MiOiI7OztJQUFBO0lBQ0E7QUFDQTtJQUNBO0lBQ0E7QUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7QUFzSkE7SUFDTyxTQUFTLGFBQWEsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRTtJQUM5QyxJQUFJLElBQUksSUFBSSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQ3pGLFFBQVEsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUU7SUFDaEMsWUFBWSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNqRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUIsU0FBUztJQUNULEtBQUs7SUFDTCxJQUFJLE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFDLENBQUM7SUFDakM7O0lDNUtBLElBQUksTUFBTTtJQUNWLEVBQUUsQ0FBQyxPQUFPLFVBQVUsS0FBSyxXQUFXLElBQUksVUFBVTtJQUNsRCxHQUFHLE9BQU8sSUFBSSxLQUFLLFdBQVcsSUFBSSxJQUFJLENBQUM7SUFDdkMsR0FBRyxPQUFPLE1BQU0sS0FBSyxXQUFXLElBQUksTUFBTSxFQUFDO0FBQzNDO0lBQ0EsSUFBSSxPQUFPLEdB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QUMsSUFBSSxDQUFDLEVBQUU7SUFDdkMsTUFBTSxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUM7SUFDeEQsS0FBSztJQUNMLEdBQUc7SUFDSCxFQUFDO0FBQ0Q7SUFDQSxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxXQUFXO0lBQ3BDLEVBQUUsSUFBSSxLQUFLLEdBQUcsR0FBRTtJQUNoQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLEVBQUUsSUFBSSxFQUFFO0lBQ3JDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7SUFDcEIsR0FBRyxFQUFDO0lBQ0osRUFBRSxPQUFPLFdBQVcsQ0FBQyxLQUFLLENBQUM7SUFDM0IsRUFBQztBQUNEO0lBQ0EsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsV0FBVztJQUN0QyxFQUFFLElBQUksS0FBSyxHQUFHLEdBQUU7SUFDaEIsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxFQUFFO0lBQy9CLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUM7SUFDckIsR0FBRyxFQUFDO0lBQ0osRUFBRSxPQUFPLFdBQVcsQ0FBQyxLQUFLLENBQUM7SUFDM0IsRUFBQztBQUNEO0lBQ0EsT0FBTyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsV0FBVztJQUN2QyxFQUFFLElBQUksS0FBSyxHQUFHLEdBQUU7SUFDaEIsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxFQUFFLElBQUksRUFBRTtJQUNyQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQUM7SUFDN0IsR0FBRyxFQUFDO0lBQ0osRUFBRSxPQUFPLFdBQVcsQ0FBQyxLQUFLLENBQUM7SUFDM0IsRUFBQztBQUNEO0lBQ0EsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFO0lBQ3RC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
