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

function strict(res) {
  if (res && res.statusCode >= 400) {
    return Promise.reject(new Error(`Error ${res.statusCode}`));
  }
  return Promise.resolve(res);
}

function lenient(res) {
  if (res && res.statusCode === 200) {
    res.statusCode = 404;
    return Promise.resolve(res);
  }
  return Promise.reject(new Error('No Error Page Found'));
}

function fetchers(params = {}) {
  const url = params.path || '/';
  const {
    dir, ext, base,
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
    names.push(path.resolve(dir, base));
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
    package: params['content.package'],
  };

  const attempts = [];
  const staticaction = contentOpts.package ? `${contentOpts.package}/hlx--static` : 'helix-services/static@v1';

  // first, try to get the raw content from the content repo
  names.forEach((name) => {
    attempts.push({
      resolve: strict,
      name: staticaction,
      blocking: true,
      result: true,
      params: {
        path: name,
        entry: name,
        esi: false,
        plain: true,
        ...contentOpts,
      },
    });
  });

  // then, try to call the action
  names.forEach((name) => {
    const extension = path.extname(name);
    const selector = (path.basename(name, extension).match(/\.(.*)/) || ['', ''])[1];
    const actionname = `${contentOpts.package || 'default'}/${selector ? `${selector}_` : ''}${extension.replace(/^\./, '')}`;
    const resource = path.resolve(path.dirname(name), `${path.basename(name, extension)}.md`);

    attempts.push({
      resolve: strict,
      name: actionname,
      blocking: true,
      result: true,
      params: {
        path: resource,
        ...contentOpts,
      },
    });
  });

  // then, try to get the raw content from the static repo
  names.forEach((name) => {
    attempts.push({
      resolve: strict,
      name: staticaction,
      blocking: true,
      result: true,
      params: {
        path: name,
        entry: name,
        esi: false,
        plain: true,
        ...staticOpts,
      },
    });
  });

  // then get the 404.html from the content repo
  attempts.push({
    resolve: lenient,
    name: staticaction,
    blocking: true,
    result: true,
    params: {
      path: '/404.html',
      entry: '/404.html',
      esi: false,
      plain: true,
      ...contentOpts,
    },
  });

  // if all fails, get the 404.html from the static repo
  attempts.push({
    resolve: lenient,
    name: staticaction,
    blocking: true,
    result: true,
    params: {
      path: '/404.html',
      entry: '/404.html',
      esi: false,
      plain: true,
      ...staticOpts,
    },
  });

  return attempts;
}

module.exports = { fetchers, strict, lenient };
