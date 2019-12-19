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
 * Main script for the desktop web editors. The contents of the editors
 * are stored in Firebase and then dynamically loaded into an iframe
 * on the smart display.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  const iframe = document.getElementById('iframe');
  const loadElement = document.getElementById('load');

  /**
   * Adjust the editors heights to use the full document height.
   */
  const adjustEditorHeights = () => {
    const editorHeight = `${(document.body.clientHeight - 200) / 2}px`;
    document.getElementById('htmlEditor').style.height = editorHeight;
    document.getElementById('cssEditor').style.height = editorHeight;
    document.getElementById('jsEditor').style.height = editorHeight;
    iframe.style.height = editorHeight;
  };

  window.addEventListener('resize', adjustEditorHeights);
  adjustEditorHeights();

  // Configure the editors.
  ace.require('ace/ext/language_tools');
  const htmlEditor = ace.edit('htmlEditor');
  htmlEditor.setTheme('ace/theme/crimson_editor');
  htmlEditor.getSession().setMode('ace/mode/html');
  htmlEditor.setOptions({
    enableBasicAutocompletion: true,
  });
  // Initialize the editor with HTML.
  htmlEditor.setValue(`<h1>Welcome!</h1><div id="message"></div>`, -1);

  const cssEditor = ace.edit('cssEditor');
  cssEditor.setTheme('ace/theme/crimson_editor');
  cssEditor.getSession().setMode('ace/mode/css');
  cssEditor.setOptions({
    enableBasicAutocompletion: true,
  });
  // Initialize the editor with CSS.
  cssEditor.setValue(`h1 {color: green;}`, -1);

  const jsEditor = ace.edit('jsEditor');
  jsEditor.setTheme('ace/theme/crimson_editor');
  jsEditor.getSession().setMode('ace/mode/javascript');
  jsEditor.setOptions({
    enableBasicAutocompletion: true,
  });
  // Initialize the editor with JavaScript.
  jsEditor.setValue(`document.getElementById('message').innerText =
      new Date().toTimeString().split(' ')[0];
    interactiveCanvas.getHeaderHeightPx().then((height) => {
      console.log('height=' + height);
      document.body.style.paddingTop = height + 'px';
    });

    callbacks = {
      onUpdate(state) {
          console.log('onUpdate', JSON.stringify(state));
      },
      onTtsMark(markName) {
          console.log('onTtsMark', JSON.stringify(markName));
      },
    };
    interactiveCanvas.ready(callbacks);`, -1);

  // Default code used for testing
  const DEFAULT_CODE = '1111';
  let firebaseCode = DEFAULT_CODE;

  /**
   * Update Firestore with the code the user entered.
   */
  const update = () => {
    try {
      const code = document.getElementById('code').value;
      if (code === '') {
        loadElement.innerHTML = 'Invalid code.';
        return;
      }

      loadElement.innerHTML = '';

      firebaseCode = code;

      if (firebaseCode !== DEFAULT_CODE) {
        const db = firebase.firestore();
        const codeRef = db.collection('codes').doc(firebaseCode);

        codeRef.get().then((doc) => {
          if (!doc.exists) {
            console.log('No such document!');
            loadElement.innerHTML = 'Invalid code.';
          } else {
            console.log(`Document data: ${doc.data()}`);
            codeRef.set({
              linked: true,
            }).then((doc) => {
              console.log('Document updated.');
              document.getElementById('instructions').style.visibility =
                'visible';
            }).catch((err) => {
              console.error('Error updating document', err);
              loadElement.innerHTML = err;
            });
          }
        }).catch((err) => {
          console.error('Error getting document', err);
        });
      }
    } catch (e) {
      console.error(e);
      loadElement.innerHTML = 'Error loading the Firebase SDK.';
    }
  };

  document.getElementById('form').addEventListener('submit', update);

  /**
   * Handler for the run button. HTML is generated from the editor's contents
   * and then persisted in Firestore.
   * @param {object} event The HTML click event.
   */
  const run = (event) => {
    if (event) {
      event.preventDefault();
    }

    const previewDoc = window.frames[0].document;
    // Generate the HTML to persist in Firestore.
    const makeHtml = (desktop) => {
      return `<!DOCTYPE html>
        <html>
          <head>
            <script type='text/javascript'>window.desktop = ${desktop};</script>
            <script src='/js/canvasPolyfill.js'></script>
            <style type='text/css'>${cssEditor.getSession().getValue()}</style>
          </head>
          <body>
            ${htmlEditor.getSession().getValue()}
            <script type='text/javascript'>
              ${jsEditor.getSession().getValue()}
            </script>
          </body>
        </html>`;
    };
    // Create HTML for the desktop preview.
    const html = makeHtml(true);

    try {
      previewDoc.write(html);
    } catch (error) {
      console.log(error);
    }
    previewDoc.close();

    console.log(firebaseCode);
    console.log(html);

    // Update Firebase with the HTML for the code the user entered.
    if (firebaseCode !== DEFAULT_CODE) {
      try {
        const db = firebase.firestore();
        const codeRef = db.collection('codes').doc(firebaseCode);

        codeRef.get().then((doc) => {
          if (!doc.exists) {
            console.log('No such document!');
            loadElement.innerHTML = 'Invalid code.';
          } else {
            console.log('Document data:', doc.data());
            // Store HTML for the Interactive Canvas Action.
            codeRef.set({
              html: makeHtml(false),
            }).then((doc) => {
              console.log('Document updated.');
            })
                .catch((err) => {
                  console.log('Error updating document', err);
                  loadElement.innerHTML = err;
                });
          }
        }).catch((err) => {
          console.log('Error getting document', err);
        });
      } catch (e) {
        console.error(e);
        loadElement.innerHTML = 'Error loading the Firebase SDK.';
      }
    }
  };

  document.getElementById('run').addEventListener('click', run);

  // Invoke the run button to preview the current HTML + CSS + JavaScript
  // editors contents.
  iframe.onload = run;

  /**
   * Handler for format button to format the editors contents.
   * @param {object} event The HTML click event.
   */
  const format = (event) => {
    if (event) {
      event.preventDefault();
    }

    const htmlSession = htmlEditor.getSession();
    htmlSession.setValue(html_beautify(htmlSession.getValue()));

    const cssSession = cssEditor.getSession();
    cssSession.setValue(css_beautify(cssSession.getValue()));

    const jsSession = jsEditor.getSession();
    jsSession.setValue(js_beautify(jsSession.getValue()));
  };

  document.getElementById('format').addEventListener('click', format);

  // Invoke the format button to format the editors content.
  format();
});
