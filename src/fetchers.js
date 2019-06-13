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
const path = require('path');

function fetchers(params = {}) {

  const url = params.path || '/';
  const {
    dir, ext, base
  } = path.parse(url);

  const names = [];
  // no extension, get the directory index
  if (!ext) {
    const dirindex = (params['content.index'] || 'index.html,README.html').split(',');
    // and build a new path with the directory index
    dirindex.reduce((allnames, index) => {
      allnames.push(path.resolve(dir, base, index));
      return allnames;
    }, names);
  } else {
    names.push(base);
  }

  const staticOpts = {
    owner: params['static.owner'],
    repo: params['static.repo'],
    ref: params['static.ref'],
    esi: params['static.esi'],
    root: params['static.root'],
  };

  const contentOpts = {
    owner: params['content.owner'],
    repo: params['content.repo'],
    ref: params['content.ref'],
    esi: false,
  };

  // eslint-disable-next-line no-console
  console.log(names);

  return [
    {
      name: 'helix-services/static@latest',
      blocking: true,
      result: true,
      params,
    }
  ];
}

module.exports = { fetchers };