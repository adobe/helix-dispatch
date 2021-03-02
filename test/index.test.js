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

/* eslint-env mocha */

process.env.HELIX_FETCH_FORCE_HTTP1 = true;

const assert = require('assert');
const querystring = require('querystring');
const { Request } = require('@adobe/helix-fetch');
const nock = require('nock');
const {
  // eslint-disable-next-line no-unused-vars
  MemLogger, ConsoleLogger, MultiLogger, SimpleInterface,
} = require('@adobe/helix-log');
const pkgJson = require('../package.json');
const index = require('../src/index.js').main;
const { fetchContext } = require('../src/utils.js');

function createLogger(level = 'info') {
  const mem = new MemLogger({
    level,
    filter: (fields) => ({
      ...fields,
      timestamp: '1970-01-01T00:00:00.000Z',
    }),
  });
  const logger = new MultiLogger({
    // uncommet to debug
    // cons: new ConsoleLogger({ level }),
    mem,
  });
  const log = new SimpleInterface({ logger });
  log.output = () => JSON.stringify(mem.buf, null, 2);
  return log;
}

const OK_RESULT = () => [200, 'Hello, world.', { 'x-openwhisk-activation-id': 'abcd-1234' }];

const OK_RESULT_404 = () => [200, '404 Page', { 'x-last-activation-id': 'abcd-1234' }];

const ERR_RESULT_404 = () => [404, 'not found', { 'x-openwhisk-activation-id': 'abcd-1234' }];

const SEVERE_RESULT = () => [500, 'server error', { 'x-openwhisk-activation-id': 'abcd-1234' }];

const TIMEOUT_RESULT = () => [503, 'gateway timeout', { 'x-openwhisk-activation-id': 'abcd-1234' }];

const TIMEOUT_ERROR = () => [502, 'The action exceeded its time limits of 100 milliseconds.', { 'x-openwhisk-activation-id': 'abcd-1234' }];

const OVERLOAD_RESULT = () => [429, 'too many requests', { 'x-openwhisk-activation-id': 'abcd-1234' }];

const OVERLOAD_ERROR = () => {
  throw new Error('POST https://runtime.adobe.io/api/v1/namespaces/helix-mini/actions/hellooo?blocking=true Returned HTTP 429 (Too Many Requests) --> "Too many requests in the last minute (count: 3, allowed: 2)."', {}, 429);
};

const ACTION_TIMEOUT_RESULT = () => [502, 'action timed out', { 'x-openwhisk-activation-id': 'abcd-1234' }];

const ERR_RESULT_404_HANDLED = (params) => {
  if (params.path === '/404.html') {
    return OK_RESULT_404();
  }
  return ERR_RESULT_404();
};

const FAIL_RESULT_404 = () => [404, 'The requested resource does not exist.'];

const FAIL_RESULT_502 = () => [502, 'The action did not produce a valid response and exited unexpectedly.'];

const REF_RESULT = () => [
  200,
  {
    fqRef: 'refs/heads/master',
    sha: '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
  },
  {
    'Content-Type': 'application/json',
  }];

const NO_REDIR_RESULT = () => [204];

const TEMP_REDIR_RESULT = () => [302, '', { location: '/look-here.html' }];

const PERM_REDIR_RESULT = () => [301, '', { location: '/look-here.html' }];

const INTL_REDIR_RESULT = () => [307, '', { location: '/look-here.html' }];

const STATIC_REDIR_RESULT = () => [307, '', { location: 'https://raw.githubusercontent.com/adobe/helix-dispatch/main/README.md' }];

let staticResult = OK_RESULT;
let invokeResult = OK_RESULT;
let refResult = REF_RESULT;
let redirResult = NO_REDIR_RESULT;

const runtimeInterceptor = function interceptor(uri) {
  // console.log('intercept', uri);

  // check request headers
  for (const name of ['connection', 'upgrade', 'http2-settings', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'te']) {
    if (name in this.req.headers) {
      // eslint-disable-next-line no-console
      console.error(`Illegal use of connection header: ${name}`);
      return [400];
    }
  }

  const params = querystring.parse(uri.split('?')[1]);
  if (uri.indexOf('resolve-git-ref') > 0) {
    return refResult(params);
  }
  if (uri.indexOf('redirect') > 0) {
    return redirResult(params);
  }
  if (uri.indexOf('static') > 0) {
    return staticResult(params);
  }
  return invokeResult(params);
};

function createRequest(params = {}, headers = {
  host: 'foo.com',
}) {
  return new Request(`https://action.com/dispatch?${querystring.encode(params)}`, {
    headers,
  });
}

function createContext(opts) {
  return {
    log: createLogger(),
    resolver: {
      createURL({ package, name, version }) {
        if (!name) {
          throw Error('missing action name');
        }
        return new URL(`https://adobeioruntime.net/api/v1/web/helix/${package}/${name}@${version}`);
      },
    },
    ...opts,
  };
}

describe('Index Tests', () => {
  before(() => {
    nock('https://adobeioruntime.net')
      .persist()
      .get(/.*/)
      .delay(Math.random() * 200 + 100)
      .reply(runtimeInterceptor);
  });

  beforeEach(() => {
    invokeResult = OK_RESULT;
    staticResult = OK_RESULT;
    redirResult = NO_REDIR_RESULT;
  });

  after(async () => {
    nock.cleanAll();
    await fetchContext.reset();
  });

  it('index returns status response', async () => {
    const result = await index(createRequest(), createContext({
      pathInfo: {
        suffix: '/_status_check/healthcheck.json',
      },
    }));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), 'application/json');

    const body = JSON.parse(await result.text());
    delete body.process;
    delete body.response_time;
    assert.deepEqual(body, {
      status: 'OK',
      version: pkgJson.version,
    });
  });

  it('index returns action response', async () => {
    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext());

    assert.equal(result.status, 200);
    assert.equal(await result.text(), 'Hello, world.');
  });

  it('filters out illegal headers', async () => {
    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }, {
      host: 'foo',
      connection: 'foo',
      upgrade: 'foo',
      'http2-settings': 'foo',
      'Keep-Alive': 'foo',
      'ProxY-Connection': 'foo',
      'transfer-encoding': 'foo',
      te: 'foo',
    }), createContext());

    assert.equal(result.status, 200);
    assert.equal(await result.text(), 'Hello, world.');
  });

  it('index returns action response and aborts pending requests', async () => {
    invokeResult = ERR_RESULT_404;
    staticResult = INTL_REDIR_RESULT;
    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      path: '/test.png',
    }), createContext());

    assert.equal(result.status, 307);
    assert.equal(await result.text(), '');
  }).timeout(10000);

  it('index returns action response even with redirect', async () => {
    redirResult = PERM_REDIR_RESULT;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    }), createContext());

    assert.equal(result.status, 200);
    assert.equal(await result.text(), 'Hello, world.');
  });

  it('index returns 301 for permanent redirect', async () => {
    invokeResult = ERR_RESULT_404;
    staticResult = ERR_RESULT_404;
    redirResult = PERM_REDIR_RESULT;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    }), createContext());

    assert.equal(result.status, 301);
    assert.equal(result.headers.get('location'), '/look-here.html');
  });

  it('index returns 302 for temporary redirect', async () => {
    invokeResult = ERR_RESULT_404;
    staticResult = ERR_RESULT_404;
    redirResult = TEMP_REDIR_RESULT;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    }), createContext());

    assert.equal(result.status, 302);
    assert.equal(result.headers.get('location'), '/look-here.html');
  });

  it('index returns 302 for temporary redirect even if 404 is handled', async () => {
    invokeResult = ERR_RESULT_404;
    staticResult = ERR_RESULT_404_HANDLED;
    redirResult = TEMP_REDIR_RESULT;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    }), createContext());

    assert.equal(result.status, 302);
    assert.equal(result.headers.get('location'), '/look-here.html');
  });

  it('index returns 508 for internal redirect loop', async () => {
    invokeResult = ERR_RESULT_404;
    staticResult = ERR_RESULT_404;
    redirResult = INTL_REDIR_RESULT;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    }), createContext());

    assert.equal(result.status, 508);
    assert.equal(await result.text(), 'Too many internal redirects to /look-here.html');
  }).timeout(4000);

  it('action does not reveal secrets', async () => {
    const log = createLogger('debug');
    await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      GITHUB_TOKEN: 'super-secret-token',
    }, {
      authorization: 'super-secret-authorization',
    }), createContext({ log }));

    const output = log.output();
    assert.ok(output.indexOf('super-secret-token') < 0, 'log should not contain GITHUB_TOKEN');
    assert.ok(output.indexOf('super-secret-authorization') < 0, 'log should not contain authorization header');
  });

  it('X-Dispatch-NoCache header is set, Cache-Control and Surrogate-Control response header are set', async () => {
    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }, {
      'x-dispatch-nocache': 'true',
    }), createContext());

    assert.equal(result.status, 200);
    assert.equal(await result.text(), 'Hello, world.');
    assert.equal(result.headers.get('cache-control'), 'max-age=600, must-revalidate, private');
  });

  it('index returns 404 response', async () => {
    const log = createLogger('debug');
    invokeResult = ERR_RESULT_404;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));
    assert.equal(result.status, 404);
  });

  it('index returns 200 response for static files', async () => {
    invokeResult = ERR_RESULT_404;
    staticResult = (params) => {
      if (params.path === '/index.html') {
        return OK_RESULT();
      } else {
        return ERR_RESULT_404();
      }
    };

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext());

    assert.equal(result.status, 200);
    assert.equal(await result.text(), 'Hello, world.');
  });

  it('index returns 200 response for static files with ref=master', async () => {
    invokeResult = (params) => {
      if (params.path === '/index.md') {
        return OK_RESULT();
      } else {
        return ERR_RESULT_404();
      }
    };

    const result = await index(createRequest({
      'static.owner': 'trieloff',
      'static.repo': 'helix-demo',
      'static.ref': 'master',
      path: '/index.md',
    }), createContext());

    assert.equal(result.status, 200);
    assert.equal(await result.text(), 'Hello, world.');
  });

  it('index returns 500 response', async () => {
    const log = createLogger();
    invokeResult = SEVERE_RESULT;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));

    const output = log.output();
    // console.log(output);

    assert.equal(result.status, 500);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 503 response', async () => {
    const log = createLogger();
    invokeResult = TIMEOUT_RESULT;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));

    const output = log.output();
    // console.log(output);

    assert.equal(result.status, 503);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 429 response when seeing 429s', async () => {
    const log = createLogger();
    invokeResult = OVERLOAD_RESULT;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));

    const output = log.output();
    assert.equal(result.status, 429);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 429 response when seeing 429s (as Errors)', async () => {
    const log = createLogger();
    refResult = OVERLOAD_ERROR;
    invokeResult = OVERLOAD_RESULT;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));

    const output = log.output();
    assert.equal(result.status, 429);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 504 response when seeing 502s', async () => {
    const log = createLogger();
    invokeResult = ACTION_TIMEOUT_RESULT;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));

    const output = log.output();
    assert.equal(result.status, 504);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 504 response when seeing 502s (as Errors)', async () => {
    const log = createLogger();
    refResult = TIMEOUT_ERROR;
    invokeResult = TIMEOUT_ERROR;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));

    const output = log.output();
    assert.equal(result.status, 504);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index produces 404 when fetcher fails due to missing action (with 404 handler).', async () => {
    invokeResult = FAIL_RESULT_404;
    staticResult = ERR_RESULT_404_HANDLED;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext());

    assert.equal(result.status, 404);
    assert.equal(await result.text(), '404 Page');
  });

  it('index produces 404 when fetcher fails due to missing action (without 404 handler).', async () => {
    invokeResult = FAIL_RESULT_404;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext());

    assert.equal(result.status, 404);
    assert.equal(await result.text(), '');
  });

  it('index produces 404 when fetcher fails due to wrong path.', async () => {
    invokeResult = OK_RESULT;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      path: '/foo/bar.',
    }), createContext());

    assert.equal(result.status, 404);
    assert.equal(await result.text(), '');
  });

  it('index produces 504 error when fetcher fails due to terminating action (with 404 handler).', async () => {
    const log = createLogger();
    invokeResult = FAIL_RESULT_502;
    staticResult = ERR_RESULT_404_HANDLED;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));

    const output = log.output();
    // console.log(output);

    assert.equal(result.status, 504);
    assert.ok(output.indexOf(' 502 The action did not produce a valid response and exited unexpectedly.') >= 0);
  });

  it('index produces 504 error when fetcher fails due to terminating action (without 404 handler).', async () => {
    const log = createLogger();
    invokeResult = FAIL_RESULT_502;
    staticResult = ERR_RESULT_404;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext({ log }));

    const output = log.output();
    // console.log(output);

    assert.equal(result.status, 504);
    assert.ok(output.indexOf(' 502 The action did not produce a valid response and exited unexpectedly.') >= 0);
  });

  it('redirect from static is preserved.', async () => {
    invokeResult = ERR_RESULT_404;
    staticResult = STATIC_REDIR_RESULT;

    const result = await index(createRequest({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }), createContext());

    assert.equal(result.status, 307);
    assert.equal(result.headers.get('location'), 'https://raw.githubusercontent.com/adobe/helix-dispatch/main/README.md');
  });
});
