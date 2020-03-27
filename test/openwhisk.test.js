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

/* eslint-env mocha */
const nock = require('nock');
const assert = require('assert');
const openhwisk = require('../src/openwhisk.js');

const TEST_TRANSACTION_ID = 'test-transaction-id';

describe('Openhwisk Tests', () => {
  after(() => {
    // eslint-disable-next-line no-underscore-dangle
    delete process.env.__OW_TRANSACTION_ID;
  });

  it('action invoke includes transaction id', async () => {
    // eslint-disable-next-line no-underscore-dangle
    process.env.__OW_TRANSACTION_ID = TEST_TRANSACTION_ID;

    const scope = nock('https://adobeioruntime.net')
      .post('/api/v1/namespaces/helix/actions/test?blocking=true')
      .matchHeader('x-request-id', TEST_TRANSACTION_ID)
      .reply(200, {
        activationId: 'f57fac72d12b4e0ebfac72d12bee0e92',
        response: {
          result: {
            body: {
              transactionId: TEST_TRANSACTION_ID,
            },
            headers: {
              'Content-Type': 'application/json',
            },
            statusCode: 200,
          },
          status: 'success',
          success: true,
        },
      });

    const ow = openhwisk({
      api_key: 'foo',
      apihost: 'https://adobeioruntime.net',
    });

    const res = await ow.actions.invoke({
      name: 'test',
      namespace: 'helix',
      result: true,
      blocking: true,
    });
    assert.deepEqual(res, {
      body: {
        transactionId: TEST_TRANSACTION_ID,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      statusCode: 200,
    });

    await scope.done();
  });
});
