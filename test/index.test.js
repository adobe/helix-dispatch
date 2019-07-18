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
const { Logger } = require('@adobe/helix-shared');

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

const FAIL_RESULT = () => {
  throw new Error('runtime failure.');
};

// this is a bit a hack, but I don't know how to change it during tests
let invokeResult = OK_RESULT;

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
      return params => action(params);
    },
  },
}).main;


describe('Index Tests', () => {
  beforeEach(() => {
    invokeResult = OK_RESULT;
  });

  it('index returns pingdom response', async () => {
    const result = await index({
      __ow_method: 'get',
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
    const result = await index({});
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 200,
      body: 'Hello, world.',
    });
  });

  it('X-Dispatch-NoCache header is set, Cache-Control and Surrogate-Control response header are set', async () => {
    const result = await index({
      __ow_headers: {
        'X-Dispatch-NoCache': 'true',
      },
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
    const logger = Logger.getTestLogger({
      // tune this for debugging
      level: 'info',
    });
    logger.fields = {}; // avoid errors during setup. test logger is winston, but we need bunyan.
    logger.flush = () => {};
    invokeResult = ERR_RESULT;

    const result = await index({}, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 404,
    });

    const output = await logger.getOutput();
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index returns 500 response', async () => {
    const logger = Logger.getTestLogger({
      // tune this for debugging
      level: 'info',
    });
    logger.fields = {}; // avoid errors during setup. test logger is winston, but we need bunyan.
    logger.flush = () => {};
    invokeResult = (req) => {
      if (req.params.path === '/404.html') {
        return ERR_RESULT();
      } else {
        return SEVERE_RESULT();
      }
    };

    const result = await index({}, logger);
    delete result.actionOptions;
    assert.deepEqual(result, {
      statusCode: 500,
    });

    const output = await logger.getOutput();
    assert.ok(output.indexOf('no valid response could be fetched') >= 0);
  });

  it('index produces application error when fetcher fails.', async () => {
    const logger = Logger.getTestLogger({
      // tune this for debugging
      level: 'info',
    });
    logger.fields = {}; // avoid errors during setup. test logger is winston, but we need bunyan.
    logger.flush = () => {};
    invokeResult = FAIL_RESULT;

    const result = await index({}, logger);
    assert.ok(result.error.indexOf('Error: runtime failure.\n    at FAIL_RESULT') >= 0);

    const output = await logger.getOutput();
    assert.ok(output.indexOf('error while invoking fetchers: runtime failure.') >= 0);
  });

  it('index function instruments epsagon', async () => {
    const logger = Logger.getTestLogger({
      // tune this for debugging
      level: 'info',
    });
    logger.fields = {}; // avoid errors during setup. test logger is winston, but we need bunyan.
    logger.flush = () => {};
    await index({
      EPSAGON_TOKEN: 'foobar',
    }, logger);

    const output = await logger.getOutput();
    assert.ok(output.indexOf('instrumenting epsagon.') >= 0);
  });

  it('error in main function is caught', async () => {
    const logger = Logger.getTestLogger({
      // tune this for debugging
      level: 'info',
    });
    logger.fields = {}; // avoid errors during setup. test logger is winston, but we need bunyan.
    logger.flush = () => {
      throw new Error('error during flush.');
    };
    const result = await index({}, logger);

    assert.deepEqual(result, {
      statusCode: 500,
    });
  });
});
