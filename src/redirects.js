/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
const { Response } = require('@adobe/helix-universal');
const { cleanupHeaderValue } = require('@adobe/helix-shared').utils;
const { fetch, getFetchOptions, appendURLParams } = require('./utils');

const TYPES = {
  301: 'permanent',
  302: 'temporary',
  307: 'internal',
};

const HELIX_REDIRECT_ACTION = {
  package: 'helix-services',
  name: 'redirect',
  version: 'v1',
};

async function redirect(req, context, params) {
  const { resolver, log } = context;
  const fetchOpts = {
    headers: Array.from(req.headers.keys()).reduce((result, key) => {
      // eslint-disable-next-line no-param-reassign
      result[key] = req.headers.get(key);
      return result;
    }, {}),
  };

  const opts = {
    owner: params['content.owner'],
    repo: params['content.repo'],
    ref: params['content.ref'],
    path: params.path,
  };
  const url = appendURLParams(resolver.createURL(HELIX_REDIRECT_ACTION), opts);
  log.info(`checking redirect for ${JSON.stringify(opts)} using ${url}`);
  const res = await fetch(url, getFetchOptions(fetchOpts));

  const target = res.headers.get('location');
  log.info(`redirect response = ${res.status} -> ${target}`);

  return {
    type: TYPES[res.status] || null,
    target,
    response: res,
  };
}

/* istanbul ignore next */
function abortRedirect(target = '') {
  const sanitized = target
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new Response(`Too many internal redirects to ${sanitized}`, {
    status: 508, // loop detected, from webdav
    headers: {
      'x-error': cleanupHeaderValue(`Too many internal redirects to ${sanitized}`),
    },
  });
}

module.exports = {
  redirect, abortRedirect,
};
