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

/* eslint-disable no-console,camelcase */
const crypto = require('crypto');
const { Request } = require('node-fetch');
const action = require('../../src/index');

require('dotenv').config();

async function run() {
  Object.assign(process.env, {
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    __OW_ACTION_NAME: '/helix/helix-services/dispatch@3.2.4-testing',
    __OW_ACTION_VERSION: '0.0.3',
    __OW_ACTIVATION_ID: crypto.randomBytes(16).toString('hex'),
    __OW_API_HOST: 'https://adobeioruntime.net',
    // __OW_API_HOST: 'https://localhost:9998',
    __OW_TRANSACTION_ID: crypto.randomBytes(16).toString('hex'),
    __OW_NAMESPACE: 'helix-pages',
  });

  const x_backend_url = '/api/v1/web/helix-pages/helix-services/dispatch@v4?static.owner=adobe&static.repo=helix-pages&static.ref=master&static.root=/htdocs&content.owner=adobe&content.repo=pages&content.ref=master&content.root=&content.package=abd2c50ff6c05cdd9c8139d9b389389a02b8326a&content.index=index.html&path=/static/ete/hero-posters/hero_ps_pr_two.png&strain=default&rootPath=&params=';

  const ret = await action.main(new Request(`https://adobeioruntime.net${x_backend_url}`, {
  }), {
    env: {},
    resolver: {
      createURL({ package, name, version }) {
        return new URL(`https://adobeioruntime.net/api/v1/web/helix-pages/${package}/${name}@${version}`);
      },
    },
  });
  console.log(ret.status);
  console.log(ret.headers.raw());
  const buffer = Buffer.from(await ret.arrayBuffer());
  console.log(`${buffer.length} bytes`);
}

run().catch(console.error);
