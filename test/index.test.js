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
const { MemLogger, SimpleInterface } = require('@adobe/helix-log');

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

const ERR_RESULT = () => Promise.resolve({
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

const FAIL_RESULT = () => {
  throw new Error('runtime failure.');
};

// this is a bit a hack, but I don't know how to change it during tests
let invokeResult = OK_RESULT;

// count how many time espagon was run.
let epsagonified = 0;

const index = proxyquire('../src/index.js', {
  openwhisk() {
    return {
      actions: {
        invoke(...args) {
          return invokeResult(...args);
        },
      },
    };
  },

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
  });

  it('index returns pingdom response', async () => {
    const result = await index({
      __ow_method: 'get',
      __ow_path: '/_status_check/pingdom.xml',
    });
    delete result.actionOptions;
    delete result.headers['X-Version'];
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.headers, {
      'Content-Type': 'application/xml',
    });
    assert.ok(/<pingdom_http_custom_check>[^]*<\/pingdom_http_custom_check>/.test(result.body));
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
    invokeResult = ERR_RESULT;

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    }, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 404,
    });

    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 500 response', async () => {
    const logger = createLogger();
    invokeResult = (req) => {
      if (req.params.path === '/404.html') {
        return ERR_RESULT();
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
        return ERR_RESULT();
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

  it('index produces application error when fetcher fails.', async () => {
    const logger = createLogger();
    invokeResult = FAIL_RESULT;

    const result = await index({
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      'content.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      __ow_logger: logger,
    });
    assert.ok(result.error.indexOf('Error: runtime failure.\n    at FAIL_RESULT') >= 0);

    const output = JSON.stringify(logger.logger.buf);
    assert.ok(output.indexOf('error while invoking fetchers: Error: runtime failure.') >= 0);
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
});
