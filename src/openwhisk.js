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
const openwhisk = require('openwhisk');

/**
 * Creates a openwhisk client that propagates the transaction id.
 * this is required until https://github.com/apache/openwhisk-client-js/issues/207 is fixed
 * and available in runtime.
 */
function createPatchedClient(...opts) {
  const ow = openwhisk(...opts);
  const { client } = ow.actions;
  const originalParams = client.params.bind(client);

  // inject x-request-id if not present
  client.params = async (...args) => {
    const ps = await originalParams(...args);
    // eslint-disable-next-line no-underscore-dangle
    const txId = process.env.__OW_TRANSACTION_ID;
    /* istanbul ignore next */
    if (!ps.headers['x-request-id'] && txId) {
      ps.headers['x-request-id'] = txId;
    }
    return ps;
  };

  return ow;
}

module.exports = createPatchedClient;
