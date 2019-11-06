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
const { logger } = require('@adobe/openwhisk-action-utils');
const { wrap } = require('@adobe/helix-status');
const { deepclone } = require('ferrum');
const resolvePreferred = require('./resolve-preferred');
const { fetchers } = require('./fetchers');

// todo: sanitizing the secrets should be better handled in the logging framework.
const sanitizeParams = (params) => {
  // backup and restore __ow_logger because deepclone cannot clone it
  // eslint-disable-next-line camelcase
  const { __ow_logger } = params;
  // eslint-disable-next-line no-underscore-dangle, no-param-reassign
  delete params.__ow_logger;

  const filtered = deepclone(params);

  Object.keys(filtered).forEach((key) => {
    if (key.match(/^[A-Z0-9_]+$/)) {
      filtered[key] = '[undisclosed secret]';
    }
  });

  if (filtered.__ow_headers && filtered.__ow_headers.authorization) {
    filtered.__ow_headers.authorization = '[undisclosed secret]';
  }

  // eslint-disable-next-line no-underscore-dangle, no-param-reassign, camelcase
  params.__ow_logger = __ow_logger;

  return filtered;
};

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
  const { __ow_logger: log } = params;
  const ow = openwhisk();

  const sanitizedParams = sanitizeParams(params);
  log.info('executeActions - entering dispatch action', sanitizedParams);

  const invoker = (actionPromise, idx) => Promise.resolve(actionPromise).then((actionOptions) => {
    const newParams = actionOptions.params;

    // propage the OW headers
    newParams.__ow_headers = params.__ow_headers || {};

    const opts = {
      name: actionOptions.name,
      params: sanitizedParams,
    };

    log.info({ actionOptions: opts }, `[${idx}] Action: ${actionOptions.name}`);
    return ow.actions.invoke(actionOptions)
      .then((reply) => {
        const res = reply.response.result;
        res.actionOptions = opts;
        log.info(`[${idx}] Result: ${reply.activationId} ${res.statusCode} ${res.errorMessage || ''}`);
        return actionOptions.resolve(res);
      }).catch((reply) => {
        const res = reply.response.result;
        log.info(`[${idx}] Result error: ${reply.activationId} ${res.statusCode} ${res.errorMessage || ''}`);
      });
  });

  try {
    // we explicitly (a)wait here, so we can catch a potential exception.
    const resp = await resolvePreferred(fetchers(params, log).map(invoker));

    // check if X-Dispatch-NoCache header is in the request,
    // this will override the Cache-Control and Surrogate-Control
    // response headers to ensure no caching
    // eslint-disable-next-line no-underscore-dangle
    if (resp && params.__ow_headers && params.__ow_headers['x-dispatch-nocache']) {
      log.info('received no cache instruction via X-Dispatch-NoCache header');
      resp.headers = resp.headers || {};
      resp.headers['Cache-Control'] = 'max-age=604800, must-revalidate, private';
      resp.headers['Surrogate-Control'] = 'max-age=0';
    }

    return resp;
  } catch (e) {
    let severe = e;

    /* istanbul ignore next */
    if (Array.isArray(e)) {
      let worst = 0;
      e.forEach((err, idx) => {
        if (!err.statusCode || err.statusCode >= 500) {
          log.error(err.message);
          worst = idx;
        }
      });
      severe = e[worst];
    }

    if (severe.statusCode) {
      if (severe.statusCode >= 500) {
        log.error('no valid response could be fetched', severe);
      } else {
        log.info('no valid response could be fetched', severe);
      }
      return {
        statusCode: severe.statusCode,
      };
    }

    // a fetchers `resolve` should never throw an exception but report a proper status response.
    // so we consider any exception thrown as application error and propagate it to openwhisk.
    log.error('error while invoking fetchers: ', severe);
    return {
      error: `${String(severe.stack)}`,
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
  const { __ow_logger: log } = params;
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
      ignoredKeys: [/[A-Z0-0_]+/],
    });
  }
  // we don't issue any pingdom checks, since those backends are tested by
  // the respective fetcher-actions
  return wrap(action)(params);
}

/**
 * Main function called by the openwhisk invoker.
 * @param params Action params
 * @returns {Promise<*>} The response
 */
async function main(params) {
  return logger.wrap(run, params);
}

module.exports.main = main;
