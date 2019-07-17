/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const openwhisk = require('openwhisk');
const { logger: setupLogger } = require('@adobe/openwhisk-action-builder/src/logging');
const { wrap } = require('@adobe/helix-pingdom-status');
const race = require('./race');
const { fetchers } = require('./fetchers');

// global logger
let log;

/**
 * This function dispatches the request to the content repository, the pipeline, and the static
 * repository. The preference order is:
 * 1. fetch from the content repository
 * 2. dynamically render using the content repository
 * 3. fetch from the fallback (`static`) repository
 * 4. fetch `/404.html` from the content or fallback repository
 *
 * @param {object} params the URL parameters
 * @param {string} params.content.owner the GitHub owner of the content (primary) repository
 * @param {string} params.content.repo the GitHub repo of the content repository
 * @param {string} params.content.ref the GitHub commit sha or branch name of the content repository
 * @param {string} params.content.package the OpenWhisk package name used for rendering actions.
 * @param {string} params.content.index a comma separated list of the directory index files to try
 * when requesting a directory
 * @param {string} params.static.owner the GitHub owner of the fallback repository
 * @param {string} params.static.repo the GitHub repo of the fallback repository
 * @param {string} params.static.ref the GitHub commit sha or branch name of the fallback repository
 * @param {string} params.path the requested URL, without a query string
 * @returns {object} the HTTP response
 */
async function executeActions(params) {
  const ow = openwhisk();

  const invoker = (actionOptions, idx) => {
    log.info(`[${idx}] Action: ${actionOptions.name}`);
    log.debug(`[${idx}] Action: ${JSON.stringify(actionOptions, null, 2)}`);
    return ow.actions.invoke(actionOptions)
      .then((reply) => {
        const res = reply.response.result;
        res.actionOptions = actionOptions;
        log.info(`[${idx}] ${reply.activationId} ${res.statusCode} ${res.errorMessage || ''}`);
        return actionOptions.resolve(res);
      });
  };

  try {
    // we explicitly (a)wait here, so we can catch a potential exception.
    const resp = await race(fetchers(params).map(invoker));

    // check if X-CACHECONTROL header is in the request,
    // this will override the Cache-Control response header

    log.info('received params', JSON.stringify(params));

    // eslint-disable-next-line no-underscore-dangle
    // if (resp && params.__ow_headers && params.__ow_headers['x-cachecontrol']) {
    resp.headers = resp.headers || {};
    // eslint-disable-next-line no-underscore-dangle
    resp.headers['Cache-Control'] = 'max-age=604800, private';
    resp.headers['Surrogate-Control'] = 'max-age=0';
    // }

    return resp;
  } catch (e) {
    if (Array.isArray(e)) {
      log.error('no valid response could be fetched');
      let severe = 0;
      e.forEach((err, idx) => {
        log.error(err.message);
        if (err.statusCode === 500) {
          severe = idx;
        }
      });
      return {
        statusCode: e[severe].statusCode,
      };
    }

    log.error('error while invoking fetchers: ', e);
    return {
      // a fetchers `resolve` should never throw an exception but report a proper status response.
      // so we consider any exception thrown as application error and propagate it to openwhisk.
      error: String(e.stack),
    };
  }
}

/**
 * Runs the action by wrapping the `fetch` function with the pingdom-status utility.
 * Additionally, if a EPSAGON_TOKEN is configured, the epsagon tracers are instrumented.
 * @param params Action params
 * @returns {Promise<*>} The response
 */
async function run(params) {
  let action = executeActions;
  if (params && params.EPSAGON_TOKEN) {
    // ensure that epsagon is only required, if a token is present. this is to avoid invoking their
    // patchers otherwise.
    // eslint-disable-next-line global-require
    const { openWhiskWrapper } = require('epsagon');
    log.info('instrumenting epsagon.');
    action = openWhiskWrapper(action, {
      token_param: 'EPSAGON_TOKEN',
      appName: 'Helix Services',
      metadataOnly: false, // Optional, send more trace data
    });
  }
  // we don't issue any pingdom checks, since those backends are tested by
  // the respective fetcher-actions
  return wrap(action)(params);
}

/**
 * Main function called by the openwhisk invoker.
 * @param params Action params
 * @param logger Existing logger to use (mainly for testing)
 * @returns {Promise<*>} The response
 */
async function main(params, logger = log) {
  try {
    log = setupLogger(params, logger);
    const result = await run(params);
    if (log.flush) {
      log.flush(); // don't wait
    }
    return result;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return {
      statusCode: e.statusCode || 500,
    };
  }
}

module.exports.main = main;
