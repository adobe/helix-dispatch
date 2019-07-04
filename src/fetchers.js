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
const path = require('path').posix;

/**
 * Default resolver that rejects statusCodes >= 400.
 * @param res action response
 * @returns {Promise<never>}
 */
function defaultResolver(res) {
  if (res && res.statusCode >= 400) {
    const { params } = res.actionOptions;
    const rp = `${params.owner}/${params.repo}/${params.ref}${params.path}`;
    return Promise.reject(new Error(`Error invoking ${res.actionOptions.name}(${rp}): ${res.statusCode}`));
  }
  return Promise.resolve(res);
}

/**
 * Resolver used for error pages. Resolves with a 404 if the action responed with a 200.
 * @param res action response
 * @returns {Promise<any>}
 */
function errorPageResolver(res) {
  if (res && res.statusCode === 200) {
    res.statusCode = 404;
    return Promise.resolve(res);
  }
  const { params } = res.actionOptions;
  const rp = `${params.owner}/${params.repo}/${params.ref}${params.path}`;
  return Promise.reject(new Error(`Error invoking ${res.actionOptions.name}(${rp}): ${res.statusCode}`));
}

/**
 * Path info structure.
 *
 * @typedef {object} PathInfo
 * @property {string} path - The path of the requested resource. eg '/foo/index.info.html'.
 * @property {string} name - The name part of the resolved resource. eg 'index'.
 * @property {string} selector - The selector of the resolved resource. eg 'info'.
 * @property {string} ext - The extension of the resolved resource. eg 'html'.
 * @property {string} relPath - The relative path ot the resolved resource. eg '/foo/index'.
 */

/**
 * Resolves the given url in respect to the mount point and potential fallback directory indices.
 * @param {string} urlPath - The requested path.
 * @param {string} mount - The mount path of a strain.
 * @param {string[]} indices - array of indices.
 * @returns {PathInfo[]} An array of path info structures.
 */
function getPathInfos(urlPath, mount, indices) {
  // check if url has extension, and if not create array of directory indices.
  const urls = [];
  if (urlPath.lastIndexOf('.') <= urlPath.lastIndexOf('/')) {
    // no extension, get the directory index
    indices.forEach((index) => {
      urls.push(path.resolve(urlPath || '/', index));
    });
  } else {
    urls.push(urlPath);
  }

  // calculate the path infos for each url
  return urls.map((url) => {
    const lastSlash = url.lastIndexOf('/');
    const lastDot = url.lastIndexOf('.');
    if (lastDot <= lastSlash) {
      // this should not happen, as the directory index should always have an extension.
      throw new Error('directory index must have an extension.');
    }
    const ext = url.substring(lastDot + 1);
    let name = url.substring(lastSlash + 1, lastDot);
    let relPath = url.substring(0, lastDot);

    // check for selector
    let selector = '';
    const selDot = relPath.lastIndexOf('.');
    if (selDot > lastSlash) {
      name = url.substring(lastSlash + 1, selDot);
      selector = relPath.substring(selDot + 1);
      relPath = relPath.substring(0, selDot);
    }

    // remove mount root if needed
    let pth = url;
    if (mount && mount !== '/') {
      // strain selection should only select strains that match the url. but better check again
      if (`${relPath}/`.startsWith(`${mount}/`)) {
        relPath = relPath.substring(mount.length);
        pth = url.substring(mount.length);
      }
    }

    return {
      path: pth,
      name,
      selector,
      ext,
      relPath,
    };
  });
}

/**
 * Returns the action options to fetch the contents from.
 * @param {object} params - action params
 * @returns {Array} Array of action options to use to ow.action.invoke
 */
function fetchers(params = {}) {
  const dirindex = (params['content.index'] || 'index.html,README.html').split(',');
  const infos = getPathInfos(params.path || '/', params.mount || '', dirindex);

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
    params: params.params,
  };

  const attempts = [];
  const staticaction = contentOpts.package ? `${contentOpts.package}/hlx--static` : 'helix-services/static@v1';

  // first, try to get the raw content from the content repo
  infos.forEach((info) => {
    attempts.push({
      resolve: defaultResolver,
      name: staticaction,
      blocking: true,
      result: true,
      params: {
        path: info.path,
        entry: info.path,
        esi: false,
        plain: true,
        root: params['content.root'],
        ...contentOpts,
      },
    });
  });

  // then, try to call the action
  infos.forEach((info) => {
    const actionname = `${contentOpts.package || 'default'}/${info.selector ? `${info.selector}_` : ''}${info.ext}`;

    attempts.push({
      resolve: defaultResolver,
      name: actionname,
      blocking: true,
      result: true,
      params: {
        path: `${info.relPath}.md`,
        ...contentOpts,
      },
    });
  });

  // then, try to get the raw content from the static repo
  infos.forEach((info) => {
    attempts.push({
      resolve: defaultResolver,
      name: staticaction,
      blocking: true,
      result: true,
      params: {
        path: info.path,
        entry: info.path,
        esi: false,
        plain: true,
        ...staticOpts,
      },
    });
  });

  // then get the 404.html from the content repo
  attempts.push({
    resolve: errorPageResolver,
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
    resolve: errorPageResolver,
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

module.exports = {
  fetchers,
  defaultResolver,
  errorPageResolver,
  getPathInfos,
};
