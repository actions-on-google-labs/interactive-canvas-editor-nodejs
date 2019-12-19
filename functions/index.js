// Copyright 2019, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

/**
 * Interactive Canvas editor fulfillment logic for the Dialogflow agent.
 */

// Enable debug logging for AoG client library
process.env.DEBUG = 'actions-on-google:*';

const functions = require('firebase-functions');
const firebaseAdmin = require('firebase-admin');

// https://firebase.google.com/docs/functions/config-env
const config = functions.config();
firebaseAdmin.initializeApp(config.firebase);
const db = firebaseAdmin.firestore();

const ENV_CONFIG = JSON.parse(process.env.FIREBASE_CONFIG);

const HOSTING_BASE_URL = `https://${ENV_CONFIG.projectId}.firebaseapp.com/`;

const {
  dialogflow,
  HtmlResponse,
} = require('actions-on-google');

const app = dialogflow({
  debug: true,
});

const randomChar = () => {
  return `${Math.floor(Math.random() * Math.floor(10))}`;
};

/**
 * Generate a random code and persist it in Firestore.
 * @return {string} The random code.
 */
const generateCode = () => {
  const code = `${randomChar()}${randomChar()}${randomChar()}${randomChar()}`;
  console.log(code);

  const codeRef = db.collection('codes').doc(code);
  return codeRef.get().then((doc) => {
    if (!doc.exists) {
      console.log('No such document!');

      return codeRef.set({
        timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      }).then((doc) => {
        if (!doc.exists) {
          console.log('No such document!');
          return new Promise((resolve, reject) => {
            resolve(code);
          });
        } else {
          console.log('Document data:', doc.data());
          return generateCode();
        }
      }).catch((err) => {
        console.log('Error getting document', err);
        return new Promise((resolve, reject) => {
          reject(err);
        });
      });
    } else {
      console.log('Document data:', doc.data());

      // If the code hasn't been used for more than a day, reuse code.
      if (doc.data().timestamp.toMillis() - Date.now() > 1000 * 60 * 60 * 24) {
        return codeRef.update({
          timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        }).then((doc) => {
          return new Promise((resolve, reject) => {
            resolve(code);
          });
        }).catch((err) => {
          console.log('Error getting document', err);
          return new Promise((resolve, reject) => {
            reject(err);
          });
        });
      }

      return generateCode();
    }
  }).catch((err) => {
    console.log('Error getting document', err);
    return new Promise((resolve, reject) => {
      reject(err);
    });
  });
};

/**
 * Default welcome intent handler to launch the Interactive Canvas web app.
 */
app.intent('Default Welcome Intent', (conv) => {
  const hasCanvas = conv.surface.capabilities.has(
      'actions.capability.INTERACTIVE_CANVAS');

  return generateCode().then((result) => {
    console.log(result);
    if (hasCanvas) {
      const t = new Date().getTime();
      conv.ask(new HtmlResponse({
        url: `${HOSTING_BASE_URL}canvas.html?${t}`,
        data: {
          sceneState: 'WELCOME',
          code: result,
          raw: conv.query,
        },
      }));
    } else {
      conv.close(`Interactive Canvas is not supported on this device.`);
    }
  }, (err) => {
    console.log(err);
    conv.close(`Oops! Something went wrong. Please try again later.`);
  });
});

/**
 * Default fallback intent handler to pass all user input to the web app.
 */
app.intent('Default Fallback Intent', (conv) => {
  const hasCanvas = conv.surface.capabilities.has(
      'actions.capability.INTERACTIVE_CANVAS');

  if (hasCanvas) {
    conv.ask(new HtmlResponse({
      data: {
        sceneState: 'FALLBACK',
        raw: conv.query,
      },
    }));
  } else {
    conv.close(`Interactive Canvas is not supported on this device.`);
  }
});

// Cloud Functions for Firebase handler for HTTPS POST requests.
// https://developers.google.com/actions/dialogflow/fulfillment#building_fulfillment_responses
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
