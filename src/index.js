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

const { Response, AbortController } = require('@adobe/helix-fetch');
const { wrap } = require('@adobe/helix-shared');
const { cleanupHeaderValue } = require('@adobe/helix-shared').utils;
const { logger } = require('@adobe/helix-universal-logger');
const { wrap: status } = require('@adobe/helix-status');
const { deepclone } = require('ferrum');
const resolvePreferred = require('./resolve-preferred');
const { fetchers } = require('./fetchers');
const { redirect, abortRedirect } = require('./redirects');
const { fetch, getFetchOptions, appendURLParams } = require('./utils');

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
          const id = err.invokeInfo ? err.invokeInfo.idx : '-';
          log.error(`[${id}] ${err.message}`);
          worst = idx;
        }
      });
      severe = e[worst];
    }
    if (severe.statusCode === 404) {
      return new Response('', {
        status: 404,
      });
    }
    throw severe;
  }
}

function extractActivationId(response) {
  // todo: respect other targets / move to helix-deploy
  let id = response.headers.get('x-last-activation-id');
  if (!id) {
    id = response.headers.get('x-openwhisk-activation-id');
  }
  // google
  if (!id) {
    id = response.headers.get('function-execution-id');
  }
  if (!id) {
    id = '--------no-activation-id--------';
  }
  return id;
}

/**
 * if requested, disable caching in the CDN (private) and
 * tell browser to re-validate after 10 minutes (must-revalidate, max-age=600)
 * @param {Request} req the request
 * @param {Response} resp the response
 * @param {Logger} log the logger
 * @return {Response} the given `resp`
 */
function handleNoCache(req, resp, log) {
  if (req.headers.get('x-dispatch-nocache')) {
    log.info('received no cache instruction via X-Dispatch-NoCache header');
    resp.headers.set('Cache-Control', 'max-age=600, must-revalidate, private');
  }
  return resp;
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
 * @param {Request} req The request
 * @param {Context} context Universal adapter context
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
async function executeActions(req, context, params) {
  const { log, resolver } = context;
  const controllers = [];

  const invoker = async (preparePromise, idx) => {
    // the prepare promise executes any tasks that need to happen before we can invoke the action
    const actionOptions = await preparePromise;

    const { action, params: invokeParams, fetchOpts } = actionOptions;
    const invokeInfo = {
      name: `${action.package}/${action.name}@${action.version}`,
      params: deepclone(invokeParams),
      idx: idx + (actionOptions.idxOffset || 0),
    };
    // todo: sanitizing the secrets should be better handled in the logging framework.
    // maybe with https://github.com/adobe/helix-log/issues/44
    Object.keys(invokeInfo.params).forEach((key) => {
      if (key.match(/^[A-Z0-9_]+$/)) {
        invokeInfo.params[key] = '[undisclosed secret]';
      }
    });
    log.infoFields(`[${invokeInfo.idx}] Action: ${invokeInfo.name}`, { actionOptions: invokeInfo });

    try {
      let res;
      if (!action.name) {
        res = new Response('', {
          status: 404,
        });
      } else {
        const url = appendURLParams(resolver.createURL(action), invokeParams);
        const controller = new AbortController();
        const abortInfo = {
          controller,
        };
        controllers.push(abortInfo);
        res = await fetch(url, getFetchOptions({
          ...fetchOpts,
          signal: controller.signal,
        }));
        abortInfo.res = res;
      }
      res.invokeInfo = invokeInfo; // remember options for resolver
      const activationId = extractActivationId(res);
      log.info(`[${invokeInfo.idx}] ${activationId} ${res.status}`);
      return actionOptions.resolve(res);
    } catch (e) {
      /* istanbul ignore next */
      e.invokeInfo = invokeInfo;
      /* istanbul ignore next */
      throw e;
    }
  };

  // default response
  let fetch404Promise = Promise.resolve(new Response('', { status: 404 }));
  let resp;
  try {
    const tasks = fetchers(req, context, params);

    // start the base fetching processes
    const responsePromise = resolvePreferred(tasks.base.map(invoker));
    // attach catch handler, in case promise resolves before we await for it later
    responsePromise.catch(() => {});

    // start the 404 fetching processes
    if (tasks.fetch404.length) {
      fetch404Promise = resolvePreferred(tasks.fetch404.map(invoker));
      // attach catch handler, in case promise resolves before we await for it later
      fetch404Promise.catch(() => {});
    }

    // we explicitly (a)wait here, so we can catch a potential exception.
    resp = await deErrorify(log, responsePromise);

    if (resp.status === 404) {
      // check for redirect
      const { type, target, response } = await redirect(req, context, params);
      if (type === 'temporary' || type === 'permanent') {
        log.info(`${type} redirect to ${target}`);
        resp = response;
      } else if (type === 'internal' && target) {
        // increase the internal redirect counter
        const redirects = (params.redirects || 0) + 1;
        if (redirects > MAX_REDIRECTS) {
          log.warn(`${type} redirect to ${target} exceeds redirect counter`);
          return abortRedirect(target);
        }
        log.info(`${type} redirect to ${target}`);
        resp = executeActions(req, context, {
          ...params,
          redirects,
          path: target,
        });
      } else {
        // no redirect, handle 404
        resp = await deErrorify(log, fetch404Promise);
      }
    }

    return handleNoCache(req, resp, log);
  } catch (e) {
    /* istanbul ignore else */
    if (e.statusCode) {
      /* istanbul ignore next */
      const propagated = (resp && resp.headers.get('x-error')) || '';
      log.error(`no valid response could be fetched: ${e} ${propagated}`);
      return new Response('', {
        status: /* istanbul ignore next */ e.statusCode === 502 ? 504 : e.statusCode,
        headers: {
          'x-error': cleanupHeaderValue(e.message),
        },
      });
    }

    // a fetchers `resolve` should never throw an exception but report a proper status response.
    // so we consider any exception thrown as application error and bubble it up.
    /* istanbul ignore next */
    log.error(`error while invoking fetchers: ${e}`);
    /* istanbul ignore next */
    throw e;
  } finally {
    // terminate pending requests, if it's not the one we return
    controllers.forEach(({ res, controller }) => {
      // only abort request if we don't return the response (or the proxy of it(
      if (!res || res !== resp) {
        if (!resp || resp.target !== res) {
          controller.abort();
        }
      }
    });
    // ignore errors
    fetch404Promise.then(() => {}).catch(() => {});
  }
}

/**
 * Runs the action. This extra step is added because the resulting status code is most of the
 * time missing in the logs.
 */
async function run(req, context) {
  const { log } = context;
  const { searchParams } = new URL(req.url);
  const params = Array.from(searchParams.entries()).reduce((p, [key, value]) => {
    // eslint-disable-next-line no-param-reassign
    p[key] = value;
    return p;
  }, {});
  const response = await executeActions(req, context, params);
  log.info('dispatch status code: ', response.status);
  return response;
}

/**
 * Main function called by the openwhisk invoker.
 * @param params Action params
 * @returns {Promise<*>} The response
 */
module.exports.main = wrap(run)
  .with(status)
  .with(logger.trace)
  .with(logger);
