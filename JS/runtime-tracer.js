(function () {
    "use strict";

    var enabled = /(?:^|[?&])traceRuntime=1(?:&|$)/.test(window.location.search) ||
        window.localStorage.getItem("vinayak_runtime_trace") === "1";
    if (!enabled || window.__vinayakRuntimeTracerInstalled) return;
    window.__vinayakRuntimeTracerInstalled = true;

    function trace(label, detail) {
        if (!window.console) return;
        console.groupCollapsed("[RuntimeTrace] " + label, detail || "");
        console.trace();
        console.groupEnd();
    }

    var originalFetch = window.fetch;
    if (typeof originalFetch === "function") {
        window.fetch = function () {
            trace("fetch", arguments[0]);
            return originalFetch.apply(this, arguments);
        };
    }

    var originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        trace("XMLHttpRequest.open", { method: method, url: url });
        return originalXhrOpen.apply(this, arguments);
    };

    var originalSetInterval = window.setInterval;
    window.setInterval = function (handler, delay) {
        trace("setInterval", { delay: delay, handler: handler && handler.name || "anonymous" });
        return originalSetInterval.apply(this, arguments);
    };

    var originalSetTimeout = window.setTimeout;
    window.setTimeout = function (handler, delay) {
        trace("setTimeout", { delay: delay, handler: handler && handler.name || "anonymous" });
        return originalSetTimeout.apply(this, arguments);
    };

    var originalRequestAnimationFrame = window.requestAnimationFrame;
    if (typeof originalRequestAnimationFrame === "function") {
        window.requestAnimationFrame = function (callback) {
            trace("requestAnimationFrame", callback && callback.name || "anonymous");
            return originalRequestAnimationFrame.apply(this, arguments);
        };
    }

    var originalWindowAddEventListener = window.addEventListener;
    window.addEventListener = function (type, listener) {
        trace("window.addEventListener", { type: type, listener: listener && listener.name || "anonymous" });
        return originalWindowAddEventListener.apply(this, arguments);
    };

    var originalDocumentAddEventListener = document.addEventListener;
    document.addEventListener = function (type, listener) {
        trace("document.addEventListener", { type: type, listener: listener && listener.name || "anonymous" });
        return originalDocumentAddEventListener.apply(this, arguments);
    };

    var originalElementAddEventListener = Element.prototype.addEventListener;
    Element.prototype.addEventListener = function (type, listener) {
        trace("Element.addEventListener", {
            type: type,
            tag: this && this.tagName,
            id: this && this.id,
            className: this && this.className,
            listener: listener && listener.name || "anonymous"
        });
        return originalElementAddEventListener.apply(this, arguments);
    };

    function describeNode(node) {
        if (!node || !node.tagName) return node;
        return {
            tag: node.tagName,
            src: node.src || node.getAttribute && node.getAttribute("src") || "",
            id: node.id || "",
            dataset: node.dataset ? Object.assign({}, node.dataset) : {}
        };
    }

    var originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function (node) {
        if (node && node.tagName === "SCRIPT") trace("appendChild(script)", describeNode(node));
        return originalAppendChild.apply(this, arguments);
    };

    var originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function (node) {
        if (node && node.tagName === "SCRIPT") trace("insertBefore(script)", describeNode(node));
        return originalInsertBefore.apply(this, arguments);
    };
}());
