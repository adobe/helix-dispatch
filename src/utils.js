/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* eslint-disable no-param-reassign */
const fetchAPI = require('@adobe/helix-fetch');

// force HTTP/1 in order to avoid issues with long-lived HTTP/2 sessions
// on azure/kubernetes based I/O Runtime
process.env.HELIX_FETCH_FORCE_HTTP1 = true;

function createFetchContext() {
  return process.env.HELIX_FETCH_FORCE_HTTP1
    ? fetchAPI.context({ alpnProtocols: [fetchAPI.ALPN_HTTP1_1] })
    /* istanbul ignore next */
    : fetchAPI.context({});
}
const fetchContext = createFetchContext();
const { fetch } = fetchContext;

function appendURLParams(url, params) {
  const u = new URL(url);
  u.searchParams = Object.entries(params).reduce((p, [key, value]) => {
    if (value) {
      p.append(key, value);
    }
    return p;
  }, u.searchParams);

  return u.href;
}

/**
 * Returns fetch compatible options for the given handler options.
 * @param {object} options Handler options
 * @return {object} fetch options.
 */
function getFetchOptions(options) {
  const headers = {
    ...options.headers /* istanbul ignore next */ || {},
  };
  delete headers.host;
  delete headers.connection;
  return {
    cache: 'no-cache',
    redirect: 'manual',
    ...options,
    headers,
  };
}

module.exports = {
  appendURLParams,
  fetch,
  fetchContext,
  getFetchOptions,
};
