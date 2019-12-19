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
 * Main script for the Interactive Canvas web app.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  const DEFAULT_CODE = '1111';
  let headerHeightPx = -1;
  // Keep track of which mark events to ignore
  let ignoreMarkStart = false;
  let ignoreMarkEnd = false;
  const iframe = document.getElementById('iframe');

  /**
   * Load the HTML from Firestore for the iframe based on the code.
   * @param {string} code Code generated for the user session.
   */
  const loadIframe = (code) => {
    const db = firebase.firestore();
    const doc = db.collection('codes').doc(code);
    document.getElementById('code').innerHTML = code;

    if (code !== DEFAULT_CODE) {
      doc.onSnapshot((doc) => {
        const html = doc.data().html;

        if (html !== undefined && html !== '') {
          iframe.srcdoc = html;
          iframe.style.visibility = 'visible';
        } else if (doc.data().linked) {
          iframe.srcdoc = doc.data().html;
          // Hide the intro message
          document.getElementById('message').style.display = 'none';
          document.getElementById('linked').style.display = 'block';
        } else {
          document.getElementById('load').innerHTML = '';
          iframe.style.visibility = 'hidden';
        }
      });
    }
  };

  /**
   * Interactive Canvas callbacks.
   */
  const callbacks = {
    onUpdate(state) {
      const sceneState = state.sceneState;
      const code = state.code;
      const raw = state.raw;

      switch (sceneState) {
        case 'WELCOME':
          loadIframe(code);
          break;

        case 'FALLBACK':
        default:
          // Ignore dummy messages
          if (raw !== ' ') {
            const message = {
              type: 'callback',
              name: 'onUpdate',
              parameter: state,
            };
            iframe.contentWindow.postMessage(message, '*');
          }
          break;
      }
    },
    onTtsMark(markName) {
      if (markName === 'START' && ignoreMarkStart) {
        ignoreMarkStart = false;
        return;
      }
      if (markName === 'END' && ignoreMarkEnd) {
        ignoreMarkEnd = false;
        return;
      }
      const message = {
        type: 'callback',
        name: 'onTtsMark',
        parameter: markName,
      };
      iframe.contentWindow.postMessage(message, '*');
    },
  };

  /**
   * Prepend to the log viewer.
   * @param {*} level The level of the line.
   * @param {*} line The line of text.
   */
  const prepend = (level, line) => {
    const log = document.getElementsByClassName('logs')[0];
    const p = document.createElement('p');
    p.textContent = line;
    p.className = level;
    log.prepend(document.createElement('br'));
    log.prepend(p);
  };

  /**
   * Proxy the Interactive Canvas API to the iframe by sending messages.
   */
  window.addEventListener('message', (event) => {
    console.log(`canvas message:  ${JSON.stringify(event.data)}`);
    try {
      const data = event.data;
      switch (data.type) {
        case 'log':
          prepend(data.level, data.messages);
          break;
        case 'method':
          if (event.data.name === 'sendTextQuery') {
            interactiveCanvas.sendTextQuery(
                event.data.parameter).then((status) => {
              const message = {
                type: 'sendTextQuery',
                name: 'status',
                parameter: status,
              };
              iframe.contentWindow.postMessage(message, '*');
            });
          } else if (event.data.name === 'ready') {
            if (headerHeightPx !== -1) {
              const message = {
                type: 'getHeaderHeightPx',
                name: 'height',
                parameter: headerHeightPx,
              };
              iframe.contentWindow.postMessage(message, '*');
            }
          } else if (event.data.name === 'getHeaderHeightPx') {
            if (headerHeightPx !== -1) {
              const message = {
                type: 'getHeaderHeightPx',
                name: 'height',
                parameter: headerHeightPx,
              };
              iframe.contentWindow.postMessage(message, '*');
            }
          }
          break;
        default:
      }
    } catch (error) {
      console.error(error);
    }
  }, false);

  /**
   * Register the callbacks for the Interactive Canvas library.
   */
  interactiveCanvas.ready(callbacks);
  interactiveCanvas.getHeaderHeightPx().then((height) => {
    headerHeightPx = height;
  });

  /**
   * Periodically send a dummy message to keep the action alive.
   */
  setInterval(() => {
    interactiveCanvas.sendTextQuery(' ').then((status) => {
      if (status != 'BLOCKED') {
        ignoreMarkStart = true;
        ignoreMarkEnd = true;
      }
    });
  }, 1 * 60 * 1000);

  /**
   * Track Firebase initialization.
   */
  try {
    const app = firebase.app();
    document.getElementById('hostingUrl').innerHTML =
      `https://${app.options.projectId}.firebaseapp.com`;
    const features = ['database'].filter((feature) => typeof app[
        feature] === 'function');
    document.getElementById('load').innerHTML =
      `Firebase SDK loaded with ${features.join(', ')}`;
  } catch (e) {
    console.error(e);
    document.getElementById('load').innerHTML =
      'Error loading the Firebase SDK, check the console.';
  }
});
