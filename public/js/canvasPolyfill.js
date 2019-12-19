// Copyright 2019 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Polyfill for the Interactive Canvas JavaScript API which is
 * proxied through the parent of the iframe in which this script
 * is loaded. The iframe content is loaded dynamically from Firestore.
 */
if (!window.canvasPolyfill) {
  window.canvasPolyfill = true;
  console.log('canvasPolyfill.js start');
  // Track if this is running on the desktop preview.
  console.log(`canvasPolyfill.js desktop=${window.desktop}`);

  let headerHeightPx = -1;
  let sendTextQueryState = null;

  /**
   * Interactive Canvas polyfill class.
   */
  class InteractiveCanvasPolyfill {
    /**
     * Constructor of class.
     */
    constructor() {
      console.log('InteractiveCanvasPolyfill');
      this.callbacks = {};
    }

    /**
     * Register the callbacks with the Interactive Canvas library.
     * @param {object} callbacks The Interactive Canvas callbacks.
     */
    ready(callbacks) {
      console.log('InteractiveCanvasPolyfill ready');
      this.callbacks = callbacks;
      const message = {
        type: 'method',
        name: 'ready',
      };
      window.parent.postMessage(message, '*');
    }

    /**
     * Send a query to invoke the Dialogflow agent and associated fulfillment.
     * @param {string} textQuery The query to match the Dialogflow agent intent.
     * @return {promise} The promise with the status.
     */
    sendTextQuery(textQuery) {
      console.log('InteractiveCanvasPolyfill sendTextQuery');
      if (window.desktop) {
        return new Promise((resolve) => {
          console.log('Respond with READY for editor');
          resolve('READY');
        });
      } else if (sendTextQueryState != null) {
        return new Promise((resolve) => {
          resolve(sendTextQueryState);
          sendTextQueryState = null;
        });
      } else {
        const that = this;
        const promise = new Promise((resolve) => {
          that.sendTextQueryStateResolve = resolve.bind(that);
        });
        const message = {
          type: 'method',
          name: 'sendTextQuery',
          parameter: textQuery,
        };
        window.parent.postMessage(message, '*');
        return promise;
      }
    }

    /**
     * Get the height of the header on the smart display.
     * @return {number} The header height in pixels.
     */
    getHeaderHeightPx() {
      console.log('InteractiveCanvasPolyfill getHeaderHeightPx');
      if (window.desktop) {
        return new Promise((resolve) => {
          console.log('Adjust header height to 0 for editor');
          resolve(0);
        });
      } else if (headerHeightPx != -1) {
        return new Promise((resolve) => {
          resolve(headerHeightPx);
        });
      } else {
        const that = this;
        const promise = new Promise((resolve) => {
          that.headerHeightPxResolve = resolve.bind(that);
        });
        const message = {
          type: 'method',
          name: 'getHeaderHeightPx',
        };
        window.parent.postMessage(message, '*');
        return promise;
      }
    }
  }

  /**
   * Set the polyfill to handle the Interactive Canvas API's.
   */
  window['interactiveCanvas'] = new InteractiveCanvasPolyfill();

  window.addEventListener('message', (event) => {
    console.log(`canvasPolyfill message: ${JSON.stringify(event.data)}`);
    switch (event.data.type) {
      case 'callback':
        if (interactiveCanvas.callbacks[event.data.name]) {
          interactiveCanvas.callbacks[event.data.name](event.data.parameter);
        }
        break;

      case 'getHeaderHeightPx':
        if (window['interactiveCanvas'].headerHeightPxResolve) {
          headerHeightPx = parseInt(event.data.parameter);
          window['interactiveCanvas'].headerHeightPxResolve(headerHeightPx);
        }
        break;

      case 'sendTextQuery':
        if (window['interactiveCanvas'].sendTextQueryStateResolve) {
          sendTextQueryState = event.data.parameter;
          window['interactiveCanvas'].sendTextQueryStateResolve(
              sendTextQueryState);
          sendTextQueryState = null;
        }
        break;

      default:
        break;
    }
  }, false);

  console.log('canvasPolyfill.js end');
} else {
  console.log('canvasPolyfill again');
}
