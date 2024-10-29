import "whatwg-fetch";
import offset from "dom-helpers/offset";

declare let AjaxyLiveSearchSettings: any, window: any;
class SFResults {
	element: HTMLUListElement;
	items: Array<HTMLElement> = [];
	parent: SF;
	constructor(data, parent) {
		this.items = [];
		this.parent = parent;
		this.element = document.createElement("ul");

		const { options, input } = this.parent;
		if (this.isString(data)) {
			let results = [];
			data.split(",").map((val) => {
				var dm = val.split(":");
				if (dm.length == 2) {
					if (dm[1].indexOf(input.value) == 0) {
						results.push({ value: dm[0], label: dm[1] });
					}
				} else if (dm.length == 1) {
					if (val.indexOf(input.value) == 0) {
						results.push({ value: val, label: val });
					}
				}
			});

			results.map(({ label, value }) => {
				let child = document.createElement("li");
				child.classList.add("sf-lnk");
				child.innerHTML = label;
				child.setAttribute("data-value", value);
				this.element.appendChild(child);
				this.items.push(child);
			});
		} else {
			Object.keys(data).map((key) => {
				let results = data[key];
				results.map(({ all, class_name, template, title }) => {
					if (all && all.length) {
						if (title) {
							let li = document.createElement("li");
							li.classList.add("sf-header");
							li.innerText = title;
							this.element.appendChild(li);
						}

						let li = document.createElement("li");
						let div = document.createElement("div");
						div.classList.add("sf-result-container");

						let ul = document.createElement("ul");
						all.map((result) => {
							let child = document.createElement("li");
							let classes = class_name ? class_name.split(" ").map((v) => v.trim()) : [];
							child.classList.add("sf-lnk", ...classes);
							child.innerHTML = this.replaceResults(result, template);
							ul.appendChild(child);
							this.items.push(child);
						});

						div.appendChild(ul);
						li.appendChild(div);

						this.element.appendChild(li);
					}
				});
			});
		}

		if (!options.callback) {
			var nTemplate = AjaxyLiveSearchSettings.more;

			nTemplate = nTemplate.replace(/{search_value_escaped}/g, `${input.value}`);
			nTemplate = nTemplate.replace(/{search_url_escaped}/g, options.searchUrl.replace("%s", encodeURI(input.value)));
			nTemplate = nTemplate.replace(/{search_value}/g, `${input.value}`);
			nTemplate = nTemplate.replace(/{total}/g, this.items.length);

			let child = document.createElement("li");
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

	loadLiveEvents(callback) {
		this.items.map((item) => {
			item.addEventListener("mouseover", (e) => {
				this.items.map((xitem) => {
					xitem != item && xitem.classList.remove("sf-selected");
				});
				item.classList.add("sf-selected");
			});
		});

		if (callback) {
			this.items.map((item) => {
				item.addEventListener("click", (e) => {
					try {
						(window[callback] as any)(item, this);
					} catch (e) {
						alert(e);
					}
				});
			});
		}

		window.addEventListener("keydown", (event: KeyboardEvent) => {
			if (this.parent.mainElem.style.display != "none") {
				if (event.key == "ArrowUp" || event.key == "ArrowDown") {
					var sindex = -1;
					event.stopPropagation();
					event.preventDefault();

					this.items.some((item, index) => {
						if (item.classList.contains("sf-selected")) {
							sindex = index;
							return true;
						}
						return false;
					});

					let currentIndex = -1;
					if (event.key == "ArrowDown") {
						if (sindex + 1 < this.items.length && this.items[sindex + 1]) {
							currentIndex = sindex + 1;
						}
					} else if (event.key == "ArrowUp") {
						if (sindex - 1 > 0 && this.items[sindex - 1]) {
							currentIndex = sindex - 1;
						} else {
							currentIndex = 0;
						}
					}

					if (currentIndex >= 0) {
						this.items.map((item) => item.classList.remove("sf-selected"));
						this.items[currentIndex].classList.add("sf-selected");
						this.items[currentIndex].focus();
					}
				} else if (event.key == "Escape") {
					this.parent.mainElem.style.display = "none";
				} else if (event.key == "Enter") {
					let selected = this.items.filter((item) => item.classList.contains("sf-selected"));
					let href = this.parent.options.searchUrl.replace("%s", encodeURI(this.parent.input.value));
					if (selected.length > 0) {
						href = selected[0].querySelector("a").href;
					}
					if (href && href != "") {
						if (callback) {
							(window[callback] as any)(selected.length ? selected[0] : null, this);
						} else {
							window.location.href = href;
						}
						return false;
					}
				}
			}
		});
	}

	replaceResults(results, template) {
		for (var s in results) {
			template = template.replace(new RegExp("{" + s + "}", "g"), results[s]);
		}
		return template;
	}

	isString = (str) => Object.prototype.toString.call(str) === "[object String]";
}
class SF {
	input = null;
	timeout = null;
	options = null;
	mainElem: HTMLDivElement;
	resultsElem: HTMLDivElement;
	valElem: HTMLDivElement;
	moreElem: HTMLDivElement;
	results: any[];

	defaults: {
		delay: number;
		leftOffset: number;
		topOffset: number;
		text: string;
		iwidth: number;
		width: string;
		ajaxUrl: string;
		ajaxData?: {
			[x: string]: any;
		};
		searchUrl: string;
		callback: any;
		rtl: boolean;
		search: boolean;
	} = {
		delay: 500,
		leftOffset: 0,
		topOffset: 5,
		text: "Search For",
		iwidth: 180,
		width: "315px",
		ajaxUrl: "",
		ajaxData: null, //function to extend data sent to server
		searchUrl: "",
		callback: false,
		rtl: false,
		search: false,
	};

	constructor(selector: string, options) {
		this.input = document.querySelector(selector);
		if (!this.input) {
			console.warn(`Ajaxy Instant Search can't find input ${selector}`);
			return;
		}
		this.timeout = null;
		this.options = Object.assign(this.defaults, options);

		this.attr({ placeholder: options.text, autocomplete: "off" }, this.input);

		this.mainElem = document.createElement("div");
		this.mainElem.classList.add("sf-container");

		let userAgent = window.navigator.userAgent;
		if (userAgent.indexOf("Win") != -1) {
			this.mainElem.classList.add("sf-windows");
		}
		if (this.options.rtl) {
			this.mainElem.classList.add("sf-rtl");
		}

		this.mainElem.style.position = "absolute";
		this.mainElem.style.display = "none";
		this.mainElem.style.width = `${options.width}`;
		this.mainElem.style.zIndex = "9999";

		let mainCont = document.createElement("div");
		mainCont.classList.add("sf-sb-cont");

		let topCont = document.createElement("div");
		topCont.classList.add("sf-sb-top");

		let bottomCont = document.createElement("div");
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

	attr(attrs, elm) {
		Object.keys(attrs).map((attr) => {
			elm.setAttribute(attr, attrs[attr]);
		});
	}

	loader(value) {
		let ul = document.createElement("ul");
		let li = document.createElement("li");
		li.classList.add("sf-lnk", "sf-more", "sf-selected");

		let link = document.createElement("a");
		link.classList.add("sf-loading");
		link.href = this.options.searchUrl.replace("%s", encodeURI(value));
		li.appendChild(link);
		ul.appendChild(li);

		this.valElem.innerHTML = "";
		this.valElem.appendChild(ul);
	}

	loadResults() {
		if (this.input.value != "") {
			this.loader(this.input.value);

			this.mainElem.style.display = "block";
			this.adjustPosition();

			let data = new FormData();
			data.append("action", "ajaxy_sf");
			data.append("value", this.input.value);

			if (this.options.ajaxData) {
				let keys = Object.keys(this.options.ajaxData);
				keys.map((key) => {
					data.append(key, this.options.ajaxData[key]);
				});
			}
			if (this.options.search) {
				let nResults = new SFResults(this.options.search, this);

				this.valElem.innerHTML = "";
				this.valElem.appendChild(nResults.element);

				this.mainElem.style.display = "block";
			} else {
				fetch(this.options.ajaxUrl, {
					body: data,
					method: "post",
				})
					.then((response) => {
						response
							.json()
							.then((results) => {
								this.parseResults(results);
							})
							.catch((e) => {
								console.error(e);
								this.parseResults([]);
							});
					})
					.catch((e) => {
						console.error(e);
						this.parseResults([]);
					});
			}
		} else {
			this.mainElem.style.display = "none";
		}
	}

	adjustPosition() {
		var pos = this.bounds(this.input, this.options);
		if (!pos || this.mainElem.style.display == "none") {
			this.mainElem.style.display = "none";
			return false;
		}
		if (Math.ceil(pos.left) + parseInt(this.options.width, 10) > window.innerWidth) {
			this.mainElem.style.width = `${window.innerWidth - pos.left - 20}px`;
		}

		if (this.options.rtl) {
			this.mainElem.style.top = `${pos.bottom}px`;
			this.mainElem.style.left = `${pos.right}px`;
			this.mainElem.style.right = `auto`;
		} else {
			this.mainElem.style.top = `${pos.bottom}px`;
			this.mainElem.style.left = `${pos.left}px`;
			this.mainElem.style.right = `auto`;
		}
	}

	parseResults(results) {
		let nResults = new SFResults(results, this);

		this.valElem.innerHTML = "";
		this.valElem.appendChild(nResults.element);

		this.mainElem.style.display = "block";
	}
	bounds(elem, options) {
		var elmOffset = offset(elem);
		if (elmOffset) {
			return {
				top: elmOffset.top,
				left: elmOffset.left + options.leftOffset,
				bottom: elmOffset.top + elem.clientHeight + options.topOffset,
				right: elmOffset.left - this.mainElem.clientWidth + elem.clientWidth,
			};
		}
	}

	hide() {
		this.mainElem && (this.mainElem.style.display = "none");
	}

	loadEvents() {
		window.addEventListener("resize", () => {
			if (this.mainElem.style.display == "none") {
				return;
			}
			this.adjustPosition();
		});

		window.addEventListener("scroll", () => {
			if (this.mainElem.style.display == "none") {
				return;
			}
			this.adjustPosition();
		});

		this.input.addEventListener("keyup", (event) => {
			if (
				event.key != "ArrowUp" &&
				event.key != "ArrowDown" &&
				event.key != "Enter" &&
				event.key != "Escape" &&
				event.key != "ArrowRight" &&
				event.key != "ArrowLeft"
			) {
				if (this.timeout != null) {
					clearTimeout(this.timeout);
				}

				this.mainElem.classList.add("sf-focused");

				this.timeout = setTimeout(() => {
					this.loadResults();
				}, this.options.delay);
			}
		});

		document.addEventListener("click", this.hide.bind(this));
	}
}

let ready = (fn) => {
	if (document.readyState != "loading") {
		fn();
	} else {
		document.addEventListener("DOMContentLoaded", fn);
	}
};

window.SFBoxes = {};

ready(() => {
	AjaxyLiveSearchSettings.boxes.map((box) => {
		if (!window.SFBoxes[box.selector]) {
			window.SFBoxes[box.selector] = new SF(box.selector, box.options);
		}
	});
});

window.SF = SF;
