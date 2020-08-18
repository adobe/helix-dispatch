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

const proxyquire = require('proxyquire');
const assert = require('assert');
const OpenWhiskError = require('openwhisk/lib/openwhisk_error');
const { MemLogger, SimpleInterface } = require('@adobe/helix-log');
const pkgJson = require('../package.json');

function createLogger(level = 'info') {
  const logger = new MemLogger({
    level,
    filter: (fields) => ({
      ...fields,
      timestamp: '1970-01-01T00:00:00.000Z',
    }),
  });
  return new SimpleInterface({ logger });
}

const OK_RESULT = () => Promise.resolve({
  activationId: 'abcd-1234',
  response: {
    result: {
      statusCode: 200,
      body: 'Hello, world.',
    },
  },
});

const ERR_RESULT_404 = () => Promise.resolve({
  activationId: 'abcd-1234',
  response: {
    result: {
      statusCode: 404,
      body: 'not found',
    },
  },
});

const SEVERE_RESULT = () => Promise.resolve({
  activationId: 'abcd-1234',
  response: {
    result: {
      statusCode: 500,
      body: 'server error',
    },
  },
});

const TIMEOUT_RESULT = () => Promise.resolve({
  activationId: 'abcd-1234',
  response: {
    result: {
      statusCode: 503,
      body: 'gateway timeout',
    },
  },
});

const TIMEOUT_ERROR = () => {
  throw new OpenWhiskError('POST https://runtime.adobe.io/api/v1/namespaces/helix-mini/actions/hello?blocking=true Returned HTTP 502 (Bad Gateway) --> "The action exceeded its time limits of 100 milliseconds."', {}, 502);
};

const OVERLOAD_RESULT = () => Promise.resolve({
  activationId: 'abcd-1234',
  response: {
    result: {
      statusCode: 429,
      body: 'too many requests',
    },
  },
});

const OVERLOAD_ERROR = () => {
  throw new OpenWhiskError('POST https://runtime.adobe.io/api/v1/namespaces/helix-mini/actions/hellooo?blocking=true Returned HTTP 429 (Too Many Requests) --> "Too many requests in the last minute (count: 3, allowed: 2)."', {}, 429);
};

const ACTION_TIMEOUT_RESULT = () => Promise.resolve({
  activationId: 'abcd-1234',
  response: {
    result: {
      statusCode: 502,
      body: 'action timed out',
    },
  },
});

const FAIL_RESULT_404 = (handle404) => async (resolver) => {
  // only create 404 failure for html action.
  if (resolver.name === 'default/html') {
    const error = new Error('OpenWhiskError: POST https://runtime.adobe.io/api/v1/namespaces/acme/default/html Returned HTTP 404 (Not Found)');
    error.error = {
      code: '46qNNODdPtdUc0BEwMJzvVqOBDcv18uA',
      error: 'The requested resource does not exist.',
    };
    error.statusCode = 404;
    throw error;
  } else if (resolver.params.path === '/404.html' && handle404) {
    return OK_RESULT();
  } else {
    return ERR_RESULT_404();
  }
};

const FAIL_RESULT_502 = (handle404) => async (resolver) => {
  // only create 502 failure for html action.
  if (resolver.name === 'default/html') {
    const error = new Error('OpenWhiskError: POST https://runtime.adobe.io/api/v1/namespaces/acme/default/html Returned HTTP 502 (Bad Gateway)');
    error.error = {
      activationId: '1f92c2987a9a4eef92c2987a9abeefcf',
      response: {
        result: {
          error: 'The action did not produce a valid response and exited unexpectedly.',
        },
        status: 'action developer error',
        success: false,
      },
    };
    error.statusCode = 502;
    throw error;
  } else if (resolver.params.path === '/404.html' && handle404) {
    return OK_RESULT();
  } else {
    return ERR_RESULT_404();
  }
};

const REF_RESULT = () => Promise.resolve({
  body:
  {
    fqRef: 'refs/heads/master',
    sha: '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
  },
  headers: { 'Content-Type': 'application/json' },
  statusCode: 200,
});

const NO_REDIR_RESULT = () => Promise.resolve({
  statusCode: 204,
});

const TEMP_REDIR_RESULT = () => Promise.resolve({
  statusCode: 302,
  headers: {
    Location: '/look-here.html',
  },
});

const PERM_REDIR_RESULT = () => Promise.resolve({
  statusCode: 301,
  headers: {
    Location: '/look-here.html',
  },
});

const INTL_REDIR_RESULT = () => Promise.resolve({
  statusCode: 307,
  headers: {
    Location: '/look-here.html',
  },
});

// this is a bit a hack, but I don't know how to change it during tests
let invokeResult = OK_RESULT;
let refResult = REF_RESULT;
let redirResult = NO_REDIR_RESULT;

// count how many time espagon was run.
let epsagonified = 0;

const fetchers = proxyquire('../src/fetchers.js', {
  './openwhisk.js': () => ({
    actions: {
      async invoke(params) {
        if (params.name === 'helix-services/resolve-git-ref@v1_link') {
          return {
            statusCode: 200,
            body: {
              sha: '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
            },
          };
        } else {
          throw Error('unexpected call to action ', params.name);
        }
      },
    },
  }),
});

const index = proxyquire('../src/index.js', {
  './fetchers.js': fetchers,
  './openwhisk.js': () => ({
    actions: {
      invoke(...args) {
        if (args[0].name.startsWith('helix-services/resolve-git-ref')) {
          return refResult(...args);
        } else if (args[0].name.startsWith('helix-services/redirect')) {
          return redirResult(...args);
        }
        return invokeResult(...args);
      },
    },
  }),

  epsagon: {
    openWhiskWrapper(action) {
      return (params) => {
        epsagonified += 1;
        return action(params);
      };
    },
    '@global': true,
  },
}).main;

describe('Index Tests', () => {
  beforeEach(() => {
    invokeResult = OK_RESULT;
    redirResult = NO_REDIR_RESULT;
  });

  it('index returns pingdom response', async () => {
    const result = await index({
      __ow_method: 'get',
      __ow_path: '/_status_check/healthcheck.json',
    });
    delete result.actionOptions;
    delete result.headers['X-Version'];
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.headers, {
      'Content-Type': 'application/json',
    });
    const { body } = result;
    delete body.process;
    delete body.response_time;
    assert.deepEqual(body, {
      status: 'OK',
      version: pkgJson.version,
    });
  });

  it('index returns action response', async () => {
    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    });
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 200,
      body: 'Hello, world.',
    });
  });

  it('index returns action response when redirect cannot be determined', async () => {
    redirResult = ERR_RESULT_404;

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    });
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 200,
      body: 'Hello, world.',
    });
  });

  it('index returns 301 for permanent redirect', async () => {
    redirResult = PERM_REDIR_RESULT;

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    });

    assert.deepEqual(result, {
      statusCode: 301,
      headers: {
        Location: '/look-here.html',
      },
    });
  });

  it('index returns 302 for temporary redirect', async () => {
    redirResult = TEMP_REDIR_RESULT;

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    });

    assert.deepEqual(result, {
      statusCode: 302,
      headers: {
        Location: '/look-here.html',
      },
    });
  });

  it('index returns 508 for internal redirect loop', async () => {
    redirResult = INTL_REDIR_RESULT;

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.owner': 'adobe',
      'content.repo': 'helix-home',
      'content.path': '/redirect-me',
    });

    assert.deepEqual(result, {
      statusCode: 508,
      body: 'Too many internal redirects to /look-here.html',
    });
  });

  it('action does not reveal secrets', async () => {
    const logger = createLogger('debug');
    await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      GITHUB_TOKEN: 'super-secret-token',
      __ow_logger: logger,
      __ow_headers: {
        authorization: 'super-secret-authorization',
      },
    });
    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('super-secret-token') < 0, 'log should not contain GITHUB_TOKEN');
    assert.ok(output.indexOf('super-secret-authorization') < 0, 'log should not contain authorization header');
  });

  it('X-Dispatch-NoCache header is set, Cache-Control and Surrogate-Control response header are set', async () => {
    const result = await index({
      __ow_headers: {
        'x-dispatch-nocache': 'true',
      },
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    });
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 200,
      body: 'Hello, world.',
      headers: {
        'Cache-Control': 'max-age=604800, must-revalidate, private',
        'Surrogate-Control': 'max-age=0',
      },
    });
  });

  it('index returns 404 response', async () => {
    const logger = createLogger('debug');
    invokeResult = ERR_RESULT_404;

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 404,
    });

    const output = JSON.stringify(logger.logger.buf, null, 2);
    // console.log(output);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 200 response for static files', async () => {
    const logger = createLogger('debug');
    invokeResult = (req) => {
      if (req.params.path === '/index.html') {
        return OK_RESULT();
      } else {
        return FAIL_RESULT_404(false);
      }
    };

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      body: 'Hello, world.',
      statusCode: 200,
    });
  });

  it('index returns 200 response for static files with ref=master', async () => {
    const logger = createLogger('debug');
    invokeResult = (req) => {
      if (req.params.path === '/index.md') {
        return OK_RESULT();
      } else {
        return FAIL_RESULT_404(false);
      }
    };

    const result = await index({
      'static.owner': 'trieloff',
      'static.repo': 'helix-demo',
      'static.ref': 'master',
      path: '/index.md',
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      body: 'Hello, world.',
      statusCode: 200,
    });
  });

  it('index returns 500 response', async () => {
    const logger = createLogger();
    invokeResult = (req) => {
      if (req.params.path === '/404.html') {
        return ERR_RESULT_404();
      } else {
        return SEVERE_RESULT();
      }
    };

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 500,
    });

    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 503 response', async () => {
    const logger = createLogger();
    invokeResult = (req) => {
      if (req.params.path === '/404.html') {
        return ERR_RESULT_404();
      } else {
        return TIMEOUT_RESULT();
      }
    };

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 503,
    });

    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 429 response when seeing 429s', async () => {
    const logger = createLogger();
    invokeResult = (req) => {
      if (req.params.path === '/404.html') {
        return ERR_RESULT_404();
      } else {
        return OVERLOAD_RESULT();
      }
    };

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 429,
    });

    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 429 response when seeing 429s (as Errors)', async () => {
    const logger = createLogger();
    refResult = OVERLOAD_ERROR;
    invokeResult = (req) => {
      if (req.params.path === '/404.html') {
        return ERR_RESULT_404();
      } else {
        return OVERLOAD_ERROR();
      }
    };

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 429,
    });

    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 504 response when seeing 502s', async () => {
    const logger = createLogger();
    invokeResult = (req) => {
      if (req.params.path === '/404.html') {
        return ERR_RESULT_404();
      } else {
        return ACTION_TIMEOUT_RESULT();
      }
    };

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 504,
    });

    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 504 response when seeing 502s (as Errors)', async () => {
    const logger = createLogger();
    refResult = TIMEOUT_ERROR;
    invokeResult = (req) => {
      if (req.params.path === '/404.html') {
        return ERR_RESULT_404();
      } else {
        return TIMEOUT_ERROR();
      }
    };

    const result = await index({
      'static.ref': 'master',
      'content.ref': 'master',
      __ow_logger: logger,
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 504,
    });

    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index produces 404 when fetcher fails due to missing action (with 404 handler).', async () => {
    const logger = createLogger();
    invokeResult = FAIL_RESULT_404(true);

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    });

    // const output = JSON.stringify(logger.logger.buf, null, 2);
    // console.log(output);

    delete result.actionOptions;
    assert.deepEqual(result, {
      body: 'Hello, world.',
      statusCode: 404,
    });
  });

  it('index produces 404 when fetcher fails due to missing action (without 404 handler).', async () => {
    const logger = createLogger();
    invokeResult = FAIL_RESULT_404(false);

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    });

    // const output = JSON.stringify(logger.logger.buf, null, 2);
    // console.log(output);

    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 404,
    });
  });

  it('index produces 504 error when fetcher fails due to terminating action (with 404 handler).', async () => {
    const logger = createLogger();
    invokeResult = FAIL_RESULT_502(true);

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    });
    const output = JSON.stringify(logger.logger.buf, null, 2);
    // console.log(output);

    assert.deepEqual(result, {
      statusCode: 504,
    });
    assert.ok(output.indexOf('Error: OpenWhiskError: POST https://runtime.adobe.io/api/v1/namespaces/acme/default/html Returned HTTP 502 (Bad Gateway)') >= 0);
  });

  it('index produces 504 error when fetcher fails due to terminating action (without 404 handler).', async () => {
    const logger = createLogger();
    invokeResult = FAIL_RESULT_502(false);

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    });
    const output = JSON.stringify(logger.logger.buf, null, 2);
    // console.log(output);
    assert.deepEqual(result, {
      statusCode: 504,
    });
    assert.ok(output.indexOf('Error: OpenWhiskError: POST https://runtime.adobe.io/api/v1/namespaces/acme/default/html Returned HTTP 502 (Bad Gateway)') >= 0);
  });

  it('index function w/o token does not instrument epsagon', async () => {
    const expected = epsagonified;
    await index({});
    assert.equal(expected, epsagonified, 'epsagon not instrumented');
  });

  it('index function instruments epsagon', async () => {
    const expected = epsagonified + 1;
    await index({
      EPSAGON_TOKEN: 'foobar',
    });
    assert.equal(expected, epsagonified, 'epsagon instrumented');
  });

  it('index function runs epsagon once for each invocation', async () => {
    const expected = epsagonified + 2;
    await index({
      EPSAGON_TOKEN: 'foobar',
    });
    await index({
      EPSAGON_TOKEN: 'foobar',
    });
    assert.equal(expected, epsagonified, 'epsagon instrumented');
  });

  it('index does not crash with empty action response', async () => {
    invokeResult = () => Promise.resolve({});

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    });
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 500,
      body: 'Invalid state',
    });
  });

  it('index does not crash with no action response', async () => {
    invokeResult = () => Promise.resolve();

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    });
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 500,
      body: 'Invalid state',
    });
  });

  it('index does not crash with incomplete action response', async () => {
    invokeResult = () => Promise.resolve({
      activationId: 'abcd-1234',
      response: {
      },
    });

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
    });
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 500,
      body: 'Invalid state',
    });
  });
});
