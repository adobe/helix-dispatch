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
const {
  HTTP2_HEADER_CONNECTION,
  HTTP2_HEADER_UPGRADE,
  HTTP2_HEADER_HOST,
  HTTP2_HEADER_HTTP2_SETTINGS,
  HTTP2_HEADER_KEEP_ALIVE,
  HTTP2_HEADER_PROXY_CONNECTION,
  HTTP2_HEADER_TRANSFER_ENCODING,
  HTTP2_HEADER_TE,
} = require('http2').constants;
const fetchAPI = require('@adobe/helix-fetch');

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

function isIllegalConnectionSpecificHeader(name, value) {
  switch (name) {
    case HTTP2_HEADER_CONNECTION:
    case HTTP2_HEADER_UPGRADE:
    case HTTP2_HEADER_HOST:
    case HTTP2_HEADER_HTTP2_SETTINGS:
    case HTTP2_HEADER_KEEP_ALIVE:
    case HTTP2_HEADER_PROXY_CONNECTION:
    case HTTP2_HEADER_TRANSFER_ENCODING:
      return true;
    case HTTP2_HEADER_TE:
      /* istanbul ignore next */
      return value !== 'trailers';
    default:
      return false;
  }
}

/**
 * Returns fetch compatible options for the given handler options.
 * @param {object} options Handler options
 * @return {object} fetch options.
 */
function getFetchOptions(options) {
  const headers = Object.entries(options.headers /* istanbul ignore next */ || {})
    .filter(([name, value]) => !isIllegalConnectionSpecificHeader(name, value))
    .reduce((obj, [name, value]) => {
      obj[name] = value;
      return obj;
    }, {});
  return {
    cache: 'no-store',
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
