// All these are required to ensure everything runs smoothly
// in an Akamai EdgeWorker
var window = {};
var TextDecoder = function() {};
var setTimeout = function(callback) { callback(); };
var XMLHttpRequest = function() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.onreadystatechange = null;

    this.open = function(method, url) {
        this.method = method;
        this.url = url;
        this.readyState = 1; // OPENED
        if (this.onreadystatechange) {
            this.onreadystatechange();
        }
    };

    this.send = async function() {
        const self = this;
        try {
            const response = await httpRequest(this.url, { method: this.method });
            self.status = response.status;
            self.responseText = await response.text();
            self.readyState = 4; // DONE
            if (self.onreadystatechange) {
                self.onreadystatechange();
            }
        } catch (error) {
            console.error('Request failed', error);
        }
    };
};
