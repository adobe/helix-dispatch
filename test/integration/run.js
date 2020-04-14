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

/* eslint-disable no-console */
const crypto = require('crypto');
const action = require('../../src/index');

require('dotenv').config();

async function run() {
  Object.assign(process.env, {
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    __OW_ACTION_NAME: '/helix/helix-services-private/dispatch@3.2.4-testing',
    __OW_ACTION_VERSION: '0.0.3',
    __OW_ACTIVATION_ID: crypto.randomBytes(16).toString('hex'),
    __OW_API_HOST: 'https://adobeioruntime.net',
    // __OW_API_HOST: 'https://localhost:9998',
    __OW_TRANSACTION_ID: crypto.randomBytes(16).toString('hex'),
    __OW_NAMESPACE: process.env.WSK_NAMESPACE,
    __OW_API_KEY: process.env.WSK_AUTH,
  });

  const ret = await action.main({
    'content.owner': 'adobe',
    'content.repo': 'theblog',
    'content.ref': 'master',
    'content.root': '',
    'content.index': 'index.html',
    'content.package': 'github-com--adobe--helix-pages--v1-8-14-dirty',
    'static.owner': 'adobe',
    'static.repo': 'helix-pages',
    'static.ref': 'master',
    'static.root': '/htdocs',
    path: '/en/archive/2020/introducing-public-beta.html',
    rootPath: '',
    params: '',
    strain: 'default',
    EPSAGON_TOKEN: process.env.EPSAGON_TOKEN,
  });
  console.log(ret);
}

run().catch(console.error);
