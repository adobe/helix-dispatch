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
    const error = new Error(`Error invoking ${res.actionOptions.name}(${rp}): ${res.statusCode}`);
    error.statusCode = res.statusCode;
    return Promise.reject(error);
  }
  return Promise.resolve(res);
}

/**
 * Resolver used for error pages. Resolves with a 404 if the action responded with a 200.
 * @param res action response
 * @returns {Promise<any>}
 */
function errorPageResolver(res) {
  if (res && res.statusCode === 200) {
    res.statusCode = 404;
    return Promise.resolve(res);
  }
  return defaultResolver(res);
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
  // eslint-disable-next-line no-param-reassign
  urlPath = urlPath.replace(/\/+/, '/');
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


function fetch404(infos, contentPromise, staticPromise) {
  const attempts = [];
  if (infos[0].ext === 'html') {
    // then get the 404.html from the content repo, but only for html requests
    attempts.push(contentPromise.then(contentOpts => {

      return {
      resolve: errorPageResolver,
      name: staticaction(contentOpts),
      blocking: true,
      params: {
        path: '/404.html',
        entry: '/404.html',
        esi: false,
        plain: true,
        ...contentOpts,
      },
    }}));
    // if all fails, get the 404.html from the static repo
    attempts.push(staticPromise.then(staticOpts => contentPromise.then(contentOpts => ({
      resolve: errorPageResolver,
      name: staticaction(contentOpts),
      blocking: true,
      params: {
        path: '/404.html',
        entry: '/404.html',
        esi: false,
        plain: true,
        ...staticOpts,
      },
    }))));
  }
  return attempts;
}

function fetchfallback(infos, wskOpts, contentPromise, staticPromise) {
  return infos.map(info => staticPromise.then(staticOpts => contentPromise.then(contentOpts => ({
    resolve: defaultResolver,
    name: staticaction(contentOpts),
    blocking: true,
    params: {
      path: info.path,
      entry: info.path,
      esi: false,
      plain: true,
      ...wskOpts,
      ...staticOpts,
    },
  }))));
}

function fetchaction(infos, contentPromise, params, wskOpts) {
  return infos.map(info => contentPromise.then(contentOpts => {
    const actionname = `${contentOpts.package || 'default'}/${info.selector ? `${info.selector}_` : ''}${info.ext}`;
    return {
      resolve: defaultResolver,
      name: actionname,
      blocking: true,
      params: {
        path: `${info.relPath}.md`,
        rootPath: params.rootPath || '',
        ...wskOpts,
        ...contentOpts,
      },
    };
  }));
}

function fetchraw(infos, params, contentPromise) {
  return infos.map(info => contentPromise.then(contentOpts => ({
    resolve: defaultResolver,
    name: staticaction(contentOpts),
    blocking: true,
    params: {
      path: info.path,
      entry: info.path,
      esi: false,
      plain: true,
      root: params['content.root'],
      ...contentOpts,
    },
  })));
}

function resolveOpts(opts) {
  const { ref } = opts;
  if (ref && ref.match(/^[a-f0-9]{40}$/i)) {
    return Promise.resolve(opts);
  }
  return Promise.resolve(opts);
}

function staticaction(contentOpts) {
  return contentOpts.package ? `${contentOpts.package}/hlx--static` : 'helix-services/static@v1';
}


/**
 * Returns the action options to fetch the contents from.
 * @param {object} params - action params
 * @returns {Array} Array of action options to use to ow.action.invoke
 */
function fetchers(params = {}) {
  const dirindex = (params['content.index'] || 'index.html,README.html').split(',');
  const infos = getPathInfos(params.path || '/', params.rootPath || '', dirindex);

  const staticOpts = resolveOpts({
    owner: params['static.owner'],
    repo: params['static.repo'],
    ref: params['static.ref'],
    esi: params['static.esi'],
    root: params['static.root'],
  });

  const contentOpts = resolveOpts({
    owner: params['content.owner'],
    repo: params['content.repo'],
    ref: params['content.ref'],
    package: params['content.package'],
    params: params.params,
  });

  const wskOpts = {
    // eslint-disable-next-line no-underscore-dangle
    __ow_headers: params.__ow_headers,
    // eslint-disable-next-line no-underscore-dangle
    __ow_method: params.__ow_method,
  };

  return [
    // try to get the raw content from the content repo
    ...fetchraw(infos, params, contentOpts),
    // then, try to call the action
    ...fetchaction(infos, contentOpts, params, wskOpts),
    // try to get the raw content from the static repo
    ...fetchfallback(infos, wskOpts, contentOpts, staticOpts),
    // finally, fetch the 404 pages
    ...fetch404(infos, contentOpts, staticOpts),
  ];
}

module.exports = {
  fetchers,
  defaultResolver,
  errorPageResolver,
  getPathInfos,
};
