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
const { fetch, getFetchOptions, appendURLParams } = require('./utils');

const HELIX_STATIC_ACTION = {
  package: 'helix-services',
  name: 'static',
  version: 'v1',
};

const HELIX_RESOLVE_GIT_REF_ACTION = {
  package: 'helix-services',
  name: 'resolve-git-ref',
  version: 'v1',
};

/**
 * An order-preserving uniqueness filter
 * @param {Array} arr an array
 * @returns a new array in the same order, with duplicates omitted
 */
const unique = (arr) => arr.reduce((retval, item) => {
  /* istanbul ignore next */
  if (retval.indexOf(item) === -1) {
    retval.push(item);
  }
  return retval;
}, []);

/**
 * Default resolver that rejects statusCodes >= 400.
 * @param {Response} res action response
 * @returns {Promise<Response>}
 */
async function defaultResolver(res) {
  if (res.status >= 400) {
    // ensure to consume body
    const body = await res.text();
    const { params, idx, name } = res.invokeInfo;
    const rp = `${params.owner}/${params.repo}/${params.ref}${params.path}`;
    const error = new Error(`[${idx}] Error invoking ${name}(${rp}): ${res.status} ${body}`);
    error.statusCode = res.status === 502 ? 504 : res.status;
    throw error;
  }
  return res;
}

/**
 * Resolver used for error pages. Resolves with a 404 if the action responded with a 200.
 * @param res action response
 * @returns {Promise<any>}
 */
async function errorPageResolver(res) {
  if (res.status === 200) {
    // create proxy to return 404 status
    const ret = new Proxy(res, {
      get(target, prop, receiver) {
        if (prop === 'status') {
          return 404;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    ret.target = res;
    return ret;
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
 * Standard Parameters for Pipeline and Static Invocations
 *
 * @typedef ActionOptions
 * @property {string} owner GitHub user or organization name
 * @property {string} repo Repository name
 * @property {string} ref branch or tag name, or sha of a commit
 * @property {string} [branch] the optional branch or tag name
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
    // ends with '/', get the directory index
    if (!urlPath || urlPath.endsWith('/')) {
      indices.forEach((index) => {
        const indexPath = path.resolve(urlPath || '/', index);
        urls.push(indexPath);
      });
    } else {
      // allow extension-less requests, i.e. /foo becomes /foo.html
      urls.push(`${path.resolve(urlPath)}.html`);
    }
  } else {
    urls.push(urlPath);
  }

  // calculate the path infos for each url
  return unique(urls).map((url) => {
    const lastSlash = url.lastIndexOf('/');
    const lastDot = url.lastIndexOf('.');
    if (lastDot <= lastSlash) {
      // this should not happen, as the directory index should always have an extension.
      throw new Error('directory index must have an extension.', url);
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
      /* istanbul ignore next */
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
 * @param {object} fetchOpts Additional options for fetch
 * @param {Promise<ActionOptions>} contentPromise coordinates for the content repo
 * @param {Promise<ActionOptions>} staticPromise coordinates for the fallback repo
 * @param {number} idxOffset helper variable for logging
 * @returns {object[]} list of actions that should get invoked
 */
function fetch404tasks(infos, fetchOpts, contentPromise, staticPromise, idxOffset) {
  const attempts = [];
  if (infos[0].ext === 'html') {
    // then get the 404.html from the content repo, but only for html requests
    attempts.push(contentPromise.then((contentOpts) => ({
      resolve: errorPageResolver,
      action: HELIX_STATIC_ACTION,
      fetchOpts,
      idxOffset,
      params: {
        path: '/404.html',
        esi: false,
        plain: true,
        ...contentOpts,
      },
    })));
    // if all fails, get the 404.html from the static repo
    attempts.push(staticPromise.then((staticOpts) => contentPromise.then(() => ({
      resolve: errorPageResolver,
      action: HELIX_STATIC_ACTION,
      fetchOpts,
      idxOffset,
      params: {
        path: '/404.html',
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
 * @param {object} fetchOpts Additional options for fetch
 * @param {Promise<ActionOptions>} contentPromise coordinates for the content repo
 * @param {Promise<ActionOptions>} staticPromise coordinates for the fallback repo
 * @returns {object[]} list of actions that should get invoked
 */
function fetchfallbacktasks(infos, fetchOpts, contentPromise, staticPromise) {
  return infos.map((info) => staticPromise
    .then((staticOpts) => contentPromise
      .then(() => ({
        resolve: defaultResolver,
        action: HELIX_STATIC_ACTION,
        fetchOpts,
        params: {
          path: info.path,
          esi: false,
          plain: true,
          ...staticOpts,
        },
      }))));
}
/**
 * Gets the tasks to invoke the pipeline action
 * @param {PathInfo[]} infos the paths to fetch from
 * @param {object} fetchOpts Additional options for fetch
 * @param {object} params the action params
 * @param {Promise<ActionOptions>} contentPromise coordinates for the content repo
 * @returns {object[]} list of actions that should get invoked
 */
function fetchactiontasks(infos, params, fetchOpts, contentPromise) {
  return infos.map((info) => contentPromise.then((contentOpts) => {
    const actionname = `${info.selector
      ? `${info.selector.toLowerCase().replace(/[^a-z0-9]/g, '')}_`
      : ''}${info.ext.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    return {
      resolve: defaultResolver,
      action: {
        package: contentOpts.package || 'default',
        name: actionname,
        version: '',
      },
      fetchOpts,
      params: {
        path: `${info.relPath}.md`,
        rootPath: params.rootPath || '',
        ...contentOpts,
      },
    };
  }));
}
/**
 * Gets the tasks to fetch raw content from the content repo
 * @param {PathInfo[]} infos the paths to fetch from
 * @param {object} params the action params
 * @param {object} fetchOpts Additional options for fetch
 * @param {Promise<ActionOptions>} contentPromise coordinates for the content repo
 * @returns {object[]} list of actions that should get invoked
 */
function fetchrawtasks(infos, params, fetchOpts, contentPromise) {
  return infos.map((info) => contentPromise.then((contentOpts) => ({
    resolve: defaultResolver,
    action: HELIX_STATIC_ACTION,
    fetchOpts,
    params: {
      path: info.path,
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
 * @param {object} fetchOpts Additional options for fetch
 * @param {Context} context - Universal adapter context
 * @returns {Promise<*>} returns a promise of the resolved ref.
 * options, with a sha instead of a branch name
 */
async function resolveRef(opts, fetchOpts, context) {
  const { log, resolver } = context;
  const { ref } = opts;
  if (ref && ref.match(/^[a-f0-9]{40}$/i)) {
    return { ref };
  }
  if (!opts.owner || !opts.repo) {
    log.info(`Unable to resolve ref ${ref}: owner and repo are mandatory.`);
    return { ref, branch: ref };
  }
  try {
    const url = appendURLParams(resolver.createURL(HELIX_RESOLVE_GIT_REF_ACTION), opts);
    const res = await fetch(url, getFetchOptions(fetchOpts));
    const body = await res.text();
    if (res.ok) {
      const data = JSON.parse(body);
      if (data.sha) {
        return {
          // use the resolved ref
          ref: data.sha,
          branch: ref,
        };
      }
    }
    let level = 'info';
    if (!res.status || res.status >= 500) {
      level = 'error';
    }
    log[level](`Unable to resolve ref ${ref}: ${res.status} ${body}`);
  } catch (e) {
    log.error(`Unable to resolve ref ${ref}: ${e}`);
  }
  return { ref, branch: ref };
}

/**
 * updates the options with the result of the resolver promise.
 * @param {ActionOptions} opts action options
 * @param {Promise<*>} resolverPromise The promise of the resolver.
 * @returns {Promise<ActionOptions>} returns a promise of the resolve action options
 */
function updateOpts(opts, resolverPromise) {
  return resolverPromise.then((ref) => ({ ...opts, ...ref }));
}

/**
 * Checks if the options have same repository coordinates
 * @param {ActionOptions} o1 - first options
 * @param {ActionOptions} o2 - second options
 * @returns {boolean} {@code true} if the two options have same repository coordinates.
 */
function equalRepository(o1, o2) {
  return (o1.owner === o2.owner
    && o1.repo === o2.repo
    && o1.ref === o2.ref);
}

/**
 * Extracts the Github token from the action params. The Github token can be provided either
 * via `GITHUB_TOKEN` action parameter or via `x-github-token` header.
 * @param {Request} req The request
 * @param {object} params - action params
 * @returns {string} the Github token extracted from `params` or `undefined` if none was found
 */
/* istanbul ignore next */
function extractGithubToken(req, params = {}) {
  return params.GITHUB_TOKEN || req.headers.get('x-github-token');
}

/**
 * Returns the action options to fetch the contents from.
 * @param {Request} req Action request
 * @param {Context} context - Universal adapter context
 * @param {object} params - action params
 * @returns {Array} Array of options to use to fetch content from services
 */
function fetchers(req, context, params) {
  const dirindex = (params['content.index'] || 'index.html').split(',');
  const infos = getPathInfos(params.path || '/', params.rootPath || '', dirindex);
  const githubToken = extractGithubToken(req, params);

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

  if (githubToken) {
    staticOpts.GITHUB_TOKEN = githubToken;
    contentOpts.GITHUB_TOKEN = githubToken;
  }

  const fetchOpts = {
    headers: Array.from(req.headers.keys()).reduce((result, key) => {
      // eslint-disable-next-line no-param-reassign
      result[key] = req.headers.get(key);
      return result;
    }, {}),
  };

  const staticResolver = resolveRef(staticOpts, fetchOpts, context);
  const contentResolver = equalRepository(staticOpts, contentOpts)
    ? staticResolver
    : resolveRef(contentOpts, fetchOpts, context);

  const staticPromise = updateOpts(staticOpts, staticResolver);
  const contentPromise = updateOpts(contentOpts, contentResolver);

  const baseTasks = [
    // try to get the raw content from the content repo
    ...fetchrawtasks(infos, params, fetchOpts, contentPromise),
    // then, try to call the action
    ...fetchactiontasks(infos, params, fetchOpts, contentPromise),
    // try to get the raw content from the static repo
    ...fetchfallbacktasks(infos, fetchOpts, contentPromise, staticPromise),
  ];
  return {
    base: baseTasks,
    fetch404: fetch404tasks(infos, fetchOpts, contentPromise, staticPromise, baseTasks.length),
  };
}

module.exports = {
  fetchers,
  defaultResolver,
  errorPageResolver,
  getPathInfos,
};
