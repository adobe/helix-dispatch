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

const { wrap } = require('@adobe/openwhisk-action-utils');
const { logger } = require('@adobe/openwhisk-action-logger');
const { wrap: status } = require('@adobe/helix-status');
const { epsagon } = require('@adobe/helix-epsagon');
const { deepclone } = require('ferrum');
const openwhisk = require('./openwhisk.js');
const resolvePreferred = require('./resolve-preferred');
const { fetchers } = require('./fetchers');
const { redirect, abortRedirect } = require('./redirects');

/**
 * Executes the fetcher promise and catches the errors. It determines the most severe error and
 * throws it, unless it is a 404, in which case the function resolves with a 404 status code.
 * @param {Logger} log logger
 * @param {Promise} promise The promise of `executeActions`.
 * @returns The result.
 */
async function deErrorify(log, promise) {
  try {
    return await promise;
  } catch (e) {
    let severe = e;
    /* istanbul ignore next */
    if (Array.isArray(e)) {
      let worst = 0;
      e.forEach((err, idx) => {
        if (!err.statusCode || err.statusCode >= 500 || err.statusCode === 429) {
          const id = err.actionOptions ? err.actionOptions.idx : '-';
          log.error(`[${id}] ${err.message}`);
          worst = idx;
        }
      });
      severe = e[worst];
    }
    if (severe.statusCode === 404) {
      return severe;
    }
    throw severe;
  }
}

/**
 * Helper function to safely get header, guarding against potentially missing __ow_headers
 * @param {object} params action params
 * @param {string} name header name
 * @returns {string} the header or the empty string.
 */
function getHeader(params, name) {
  if (!params || !params.__ow_headers) {
    return '';
  }
  return params.__ow_headers[name] || '';
}

/**
 * Maximum number of internal redirects to follow before a loop is assumed
 */
const MAX_REDIRECTS = 3;

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

  const invoker = (actionPromise, idx) => Promise.resolve(actionPromise).then((actionOptions) => {
    // todo: sanitizing the secrets should be better handled in the logging framework.
    // maybe with https://github.com/adobe/helix-log/issues/44
    const opts = {
      name: actionOptions.name,
      params: deepclone(actionOptions.params),
      idx: idx + (actionOptions.idxOffset || 0),
    };
    Object.keys(opts.params).forEach((key) => {
      if (key.match(/^[A-Z0-9_]+$/)) {
        opts.params[key] = '[undisclosed secret]';
      }
    });
    if (getHeader(opts.params, 'authorization')) {
      opts.params.__ow_headers.authorization = '[undisclosed secret]';
    }
    log.infoFields(`[${opts.idx}] Action: ${actionOptions.name}`, { actionOptions: opts });
    return ow.actions.invoke(actionOptions)
      .then((reply) => {
        if (reply && reply.response && reply.response.result) {
          const res = reply.response.result;
          res.actionOptions = opts;
          log.info(`[${opts.idx}] ${reply.activationId} ${res.statusCode} ${res.errorMessage || ''}`);
          return actionOptions.resolve(res);
        } else {
          if (reply && reply.response) {
            log.error(`[${opts.idx}] provided a response but no result. Unknown state for ${reply.activationId}`, reply);
          } else {
            /* istanbul ignore next */
            log.error(`[${opts.idx}] did not provide a response. Unknown state for ${reply && reply.activationId ? reply.activationId : 'No activation id'}`, reply);
          }
          return {
            statusCode: 500,
            body: 'Invalid state',
          };
        }
      }).catch((err) => {
        // eslint-disable-next-line no-param-reassign
        err.actionOptions = opts;
        throw err;
      });
  });

  let fetch404Promise = Promise.reject();
  try {
    const tasks = fetchers(params, log);

    // start the base fetching processes
    const responsePromise = resolvePreferred(tasks.base.map(invoker));

    // start the 404 fetching processes
    fetch404Promise = resolvePreferred(tasks.fetch404.map(invoker));

    // we explicitly (a)wait here, so we can catch a potential exception.
    let resp = await deErrorify(log, responsePromise);

    if (resp.statusCode === 404) {
      // check for redirect
      const { type, target, result } = await redirect(params, ow);
      if (type === 'temporary' || type === 'permanent') {
        log.info(`${type} redirect to ${target}`);
        return result;
      } else if (type === 'internal' && target) {
        // increase the internal redirect counter
        const redirects = (params.redirects || 0) + 1;
        if (redirects > MAX_REDIRECTS) {
          log.warn(`${type} redirect to ${target} exceeds redirect counter`);
          return abortRedirect(target);
        }
        log.info(`${type} redirect to ${target}`);
        return executeActions({
          ...params,
          redirects,
          path: target,
        });
      }
    }

    try {
      // todo: maybe we should also only load the 404.html if resp.statusCode === 404 ?
      const resp404 = await fetch404Promise;
      if (resp.statusCode === 404) {
        resp = resp404;
      }
    } catch (e) {
      if (resp.statusCode === 404) {
        log.info('no valid response could be fetched');
      }
    }

    // if requested, disable caching in the CND (private) and
    // tell browser to re-validate after 10 minutes (must-revalidate, max-age=600)
    if (getHeader(params, 'x-dispatch-nocache')) {
      log.info('received no cache instruction via X-Dispatch-NoCache header');
      resp.headers = resp.headers || {};
      resp.headers['Cache-Control'] = 'max-age=600, must-revalidate, private';
    }

    return resp;
  } catch (e) {
    try {
      // we need to wait for the 404 requests, otherwise we have unhandled promise rejections
      await fetch404Promise;
    } catch {
      // ignore
    }

    /* istanbul ignore else */
    if (e.statusCode) {
      log.error(`no valid response could be fetched: ${e}`);
      return {
        statusCode: e.statusCode === 502 ? 504 : e.statusCode,
      };
    }

    // a fetchers `resolve` should never throw an exception but report a proper status response.
    // so we consider any exception thrown as application error and propagate it to openwhisk.
    /* istanbul ignore next */
    log.error(`error while invoking fetchers: ${e}`);
    /* istanbul ignore next */
    return {
      error: `${String(e.stack)}`,
    };
  }
}

/**
 * Runs the action. This extra step is added because the resulting status code is most of the
 * time missing in the logs.
 */
async function run(params) {
  const { __ow_logger: log } = params;
  const result = await executeActions(params);
  log.info('dispatch status code: ', result.statusCode);
  return result;
}

/**
 * Main function called by the openwhisk invoker.
 * @param params Action params
 * @returns {Promise<*>} The response
 */
module.exports.main = wrap(run)
  .with(epsagon)
  .with(status)
  .with(logger.trace)
  .with(logger);
