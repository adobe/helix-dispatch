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
const openwhisk = require('openwhisk');
const { logger } = require('@adobe/openwhisk-action-builder/src/logging');

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

function staticaction(contentOpts) {
  return contentOpts.package ? `${contentOpts.package}/hlx--static` : 'helix-services/static@v1';
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
 * Standard Parameters for Pipeline and Static Invocations
 *
 * @typedef ActionOptions
 * @property {string} owner GitHub user or organization name
 * @property {string} repo Repository name
 * @property {string} ref branch or tag name, or sha of a commit
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

/**
 * Gets the tasks to fetch the 404 files, one from the content repo, one
 * from the fallback repo
 * @param {PathInfo[]} infos the paths to fetch from
 * @param {Promise<ActionOptions>} contentPromise coordinates for the content repo
 * @param {Promise<ActionOptions>} staticPromise coordinates for the fallback repo
 * @returns {object[]} list of actions that should get invoked
 */
function fetch404tasks(infos, contentPromise, staticPromise) {
  const attempts = [];
  if (infos[0].ext === 'html') {
    // then get the 404.html from the content repo, but only for html requests
    attempts.push(contentPromise.then(contentOpts => ({
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
    })));
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
/**
 * Gets the tasks to fetch raw content from the fallback repo
 * @param {PathInfo[]} infos the paths to fetch from
 * @param {object} wskOpts additional options for the OpenWhisk invocation
 * @param {Promise<ActionOptions>} contentPromise coordinates for the content repo
 * @param {Promise<ActionOptions>} staticPromise coordinates for the fallback repo
 * @returns {object[]} list of actions that should get invoked
 */
function fetchfallbacktasks(infos, wskOpts, contentPromise, staticPromise) {
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
/**
 * Gets the tasks to invoke the pipeline action
 * @param {PathInfo[]} infos the paths to fetch from
 * @param {object} wskOpts additional options for the OpenWhisk invocation
 * @param {Promise<ActionOptions>} contentPromise coordinates for the content repo
 * @returns {object[]} list of actions that should get invoked
 */
function fetchactiontasks(infos, contentPromise, params, wskOpts) {
  return infos.map(info => contentPromise.then((contentOpts) => {
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
/**
 * Gets the tasks to fetch raw content from the content repo
 * @param {PathInfo[]} infos the paths to fetch from
 * @param {Promise<ActionOptions>} contentPromise coordinates for the content repo
 * @returns {object[]} list of actions that should get invoked
 */
function fetchrawtasks(infos, params, contentPromise) {
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

/**
 * Resolves the branch or tag name into a sha.
 * @param {ActionOptions} opts action options
 * @returns {Promise<ActionOptions>} returns a promise of the resolve action
 * options, with a sha instead of a branch name
 */
function resolveOpts(opts, log) {
  const { ref } = opts;
  if (ref && ref.match(/^[a-f0-9]{40}$/i)) {
    return Promise.resolve(opts);
  }
  const ow = openwhisk();
  ow.actions.invoke({
    name: 'helix-services/resolve-git-ref@v1',
    blocking: true,
    result: true,
    params: opts,
  }).then(res => ({
    // use the resolved ref
    ref: res.body.sha,
    ...opts,
  })).catch((e) => {
    log.error(`Unable to resolve branch name ${e}`);
    return opts;
  }); // if the resolver fails, just use the unresolved ref
  return Promise.resolve(opts);
}

function equalOpts(o1, o2) {
  return (o1.owner === o2.owner
    && o1.repo === o2.repo
    && o1.ref === o2.ref);
}

/**
 * Returns the action options to fetch the contents from.
 * @param {object} params - action params
 * @returns {Array} Array of action options to use to ow.action.invoke
 */
function fetchers(params = {}, log = logger()) {
  const dirindex = (params['content.index'] || 'index.html,README.html').split(',');
  const infos = getPathInfos(params.path || '/', params.rootPath || '', dirindex);

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

  const staticPromise = resolveOpts(staticOpts, log);
  const contentPromise = equalOpts(staticOpts, contentOpts)
    ? staticPromise
    : resolveOpts(contentOpts, log);

  const wskOpts = {
    // eslint-disable-next-line no-underscore-dangle
    __ow_headers: params.__ow_headers,
    // eslint-disable-next-line no-underscore-dangle
    __ow_method: params.__ow_method,
  };

  return [
    // try to get the raw content from the content repo
    ...fetchrawtasks(infos, params, contentPromise),
    // then, try to call the action
    ...fetchactiontasks(infos, contentPromise, params, wskOpts),
    // try to get the raw content from the static repo
    ...fetchfallbacktasks(infos, wskOpts, contentPromise, staticPromise),
    // finally, fetch the 404 pages
    ...fetch404tasks(infos, contentPromise, staticPromise),
  ];
}

module.exports = {
  fetchers,
  defaultResolver,
  errorPageResolver,
  getPathInfos,
};
