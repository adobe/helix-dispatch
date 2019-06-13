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
const assert = require('assert');
const { fetchers } = require('../src/fetchers');

const opts = {
  'static.owner': 'adobe',
  'content.owner': 'trieloff',
  'content.package': '60ef2a011a6a91647eba00f798e9c16faa9f78ce',
};

function logres(res) {
  console.table(res.map(r => ({
    name: r.name,
    owner: r.params.owner,
    path: r.params.path,
  })));
}

describe('testing fetchers.js', () => {
  it('fetch nothing', () => {
    const res = fetchers();

    logres(res);
  });

  it('fetch basic HTML', () => {
    const res = fetchers({
      ...opts,
      path: '/dir/example.html',
    });

    logres(res);
  });

  it('fetch HTML with selector', () => {
    const res = fetchers({
      ...opts,
      path: '/dir/example.nav.html',
    });

    logres(res);
  });

  it('fetch directory index', () => {
    const res = fetchers({
      ...opts,
      path: '/example/dir',
    });

    logres(res);
  });
});
