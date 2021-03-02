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

process.env.HELIX_FETCH_FORCE_HTTP1 = true;

const assert = require('assert');
const { Request, Response } = require('@adobe/helix-fetch');
const { AssertionError } = require('assert');
const {
  defaultResolver, errorPageResolver, getPathInfos, fetchers: originalFetchers,
} = require('../src/fetchers');

const SAMPLE_GITHUB_TOKEN = 'some-github-token-value';

/**
 * Returns the combined fetcher array, including the base and the 404 tasks.
 */
const fetchers = (...args) => {
  const { base, fetch404 } = originalFetchers(...args);
  return [
    ...base,
    ...fetch404,
  ];
};

const DEFAULT_PARAMS = {
  'static.owner': 'adobe',
  'static.repo': 'helix-pages',
  'static.ref': 'master',
  'content.owner': 'trieloff',
  'content.repo': 'soupdemo',
  'content.package': '60ef2a011a6a91647eba00f798e9c16faa9f78ce',
  'content.ref': 'master',
};

function actionName({ package, name, version } = {}) {
  return `${package}/${name}@${version}`;
}

function logres(r) {
  Promise.all(r).then((res) => {
    // eslint-disable-next-line no-console
    console.table(res.map((s) => ({
      action: actionName(s.action),
      owner: s.params.owner,
      path: s.params.path,
      ref: s.params.ref,
    })));
  // eslint-disable-next-line no-console
  }).catch(console.error);
}

function createRequest(headers = {}) {
  return new Request('https://html.action.com', {
    headers,
  });
}

function createContext(opts) {
  return {
    log: console,
    resolver: {
      createURL({ package, name, version }) {
        return new URL(`https://adobeioruntime.net/api/v1/web/helix/${package}/${name}@${version}`);
      },
    },
    ...opts,
  };
}

describe('testing fetchers.js', () => {
  it('fetch nothing', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {}));
    assert.equal(res.length, 5);
    logres(res);
  });

  it('fetch basic HTML', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[0].action), 'helix-services/static@v1');
    assert.equal(res[0].params.ref, 'master');
    assert.equal(res[0].params.branch, 'master');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html@');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[1].params.ref, 'master');
    assert.equal(res[2].params.ref, 'master');
    assert.equal(res[2].params.branch, 'master');
  });

  it('fetch basic HTML invokes resolver only once if same repo', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      'content.owner': 'adobe',
      'content.repo': 'helix-pages',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[0].action), 'helix-services/static@v1');
    assert.equal(res[0].params.ref, 'master');
    assert.equal(res[0].params.branch, 'master');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html@');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[1].params.ref, 'master');
    assert.equal(res[2].params.ref, 'master');
  });

  it('fetch basic HTML from sha', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[0].action), 'helix-services/static@v1');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html@');
    assert.equal(res[1].params.path, '/dir/example.md');
  });

  it('fetch basic HTML from branch while resolver rejects', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      'static.ref': 'branch',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[0].action), 'helix-services/static@v1');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html@');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[2].params.ref, 'branch');
  });

  it('fetch basic HTML from branch while resolver fails', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      'static.ref': 'fail',
      'content.ref': 'fail',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[0].action), 'helix-services/static@v1');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html@');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[2].params.ref, 'fail');
  });

  it('fetch basic HTML from branch while resolver returns garbage', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      'static.ref': 'garbage',
      'content.ref': 'garbage',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[0].action), 'helix-services/static@v1');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html@');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[2].params.ref, 'garbage');
  });

  it('fetch basic HTML from branch while resolver returns incomplete json', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      'static.ref': 'incomplete',
      'content.ref': 'incomplete',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[0].action), 'helix-services/static@v1');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html@');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[2].params.ref, 'incomplete');
  });

  it('fetch basic HTML from branch while resolver errors', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      'static.ref': 'fail',
      'content.ref': 'fail',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[0].action), 'helix-services/static@v1');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html@');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[2].params.ref, 'fail');
  });

  it('fetch HTML with selector', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      path: '/dir/example.nav.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/nav_html@');
  });

  it('fetch HTML with selector for malformed extension', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      path: '/dir/example.navä.ht=%ml',
    }));

    logres(res);
    assert.equal(res.length, 3);
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/nav_html@');
  });

  it('fetch directory index', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      path: '/example/dir',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(res[0].params.path, '/example/dir.html');
    assert.equal(res[1].params.path, '/example/dir.md');
  });

  it('fetch non html', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      path: '/style.css',
    }));

    logres(res);
    assert.equal(res.length, 3);
    assert.equal(res[0].params.path, '/style.css');
    assert.equal(actionName(res[1].action), '60ef2a011a6a91647eba00f798e9c16faa9f78ce/css@');
  });

  it('Github token provided via parameter is passed to fetchers', async () => {
    const res = await Promise.all(fetchers(createRequest(), createContext(), {
      ...DEFAULT_PARAMS,
      GITHUB_TOKEN: SAMPLE_GITHUB_TOKEN,
      path: '/style.css',
    }));

    logres(res);
    assert.equal(res.length, 3);
    assert.equal(res[0].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    assert.equal(res[1].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    assert.equal(res[2].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
  });

  it('Github token provided via header is passed to fetchers', async () => {
    const res = await Promise.all(fetchers(createRequest({
      'x-github-token': SAMPLE_GITHUB_TOKEN,
    }), createContext(), {
      ...DEFAULT_PARAMS,
      path: '/style.css',
    }));

    logres(res);
    assert.equal(res.length, 3);
    assert.equal(res[0].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    assert.equal(res[1].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    assert.equal(res[2].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
  });

  it('test if headers are passed to all fetchers', async () => {
    const res = await Promise.all(fetchers(createRequest({
      'a-header': 'its-value',
    }), createContext(), {
      ...DEFAULT_PARAMS,
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    // all fetchers should propagate the headers
    res.forEach((r) => {
      assert.ok(r.fetchOpts);
      assert.equal(r.fetchOpts.headers['a-header'], 'its-value');
    });
  });
});

describe('testing default promise resolver', () => {
  it('default promise resolver accepts status 200', async () => {
    const res = await Promise.resolve({
      statusCode: 200,
    }).then(defaultResolver);
    assert.ok(res);
  });

  it('default promise resolver throws on status 400', async () => {
    try {
      const resp = new Response('error', {
        status: 400,
      });
      resp.invokeInfo = {
        idx: 1,
        params: {
          owner: 'adobe',
          repo: 'helix-statix',
          ref: 'master',
          path: '/index.html',
        },
      };
      await Promise.resolve(resp).then(defaultResolver);
      assert.fail('this should never happen');
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e;
      }
      assert.equal(e.message, '[1] Error invoking undefined(adobe/helix-statix/master/index.html): 400 error');
    }
  });
});

describe('testing error page promise resolver', () => {
  it('error page promise resolver accepts status 200', async () => {
    const res = await Promise.resolve(new Response('404 page')).then(errorPageResolver);
    assert.equal(res.status, 404);
  });

  it('error page promise resolver throws on status 400', async () => {
    try {
      const resp = new Response('error', {
        status: 400,
      });
      resp.invokeInfo = {
        idx: 1,
        params: {
          owner: 'adobe',
          repo: 'helix-statix',
          ref: 'master',
          path: '/index.html',
        },
      };
      await Promise.resolve(resp).then(errorPageResolver);
      assert.fail('this should never happen');
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e;
      }
      assert.equal(e.message, '[1] Error invoking undefined(adobe/helix-statix/master/index.html): 400 error');
    }
  });
});

describe('testing path info resolution', () => {
  const tests = [
    {
      url: '/hä/',
      indices: ['index.html', 'readme.html'],
      mount: '',
      expected: [{
        path: '/hä/index.html',
        name: 'index',
        selector: '',
        ext: 'html',
        relPath: '/hä/index',
      }, {
        path: '/hä/readme.html',
        name: 'readme',
        selector: '',
        ext: 'html',
        relPath: '/hä/readme',
      }],
    },
    {
      url: '/hä',
      indices: ['index.html', 'readme.html'],
      mount: '',
      expected: [{
        path: '/hä.html',
        name: 'hä',
        selector: '',
        ext: 'html',
        relPath: '/hä',
      }],
    },
    {
      url: '/my.directory/foo/',
      indices: ['index.html'],
      mount: '',
      expected: [{
        path: '/my.directory/foo/index.html',
        name: 'index',
        selector: '',
        ext: 'html',
        relPath: '/my.directory/foo/index',
      }],
    },
    {
      url: '',
      indices: ['index.html'],
      mount: '',
      expected: [{
        path: '/index.html',
        name: 'index',
        selector: '',
        ext: 'html',
        relPath: '/index',
      }],
    },
    {
      url: '/foo/hello.html',
      indices: ['index.html'],
      mount: '',
      expected: [{
        path: '/foo/hello.html',
        name: 'hello',
        selector: '',
        ext: 'html',
        relPath: '/foo/hello',
      }],
    },
    {
      url: '/foo/hello.info.html',
      indices: ['index.html'],
      mount: '',
      expected: [{
        path: '/foo/hello.info.html',
        name: 'hello',
        selector: 'info',
        ext: 'html',
        relPath: '/foo/hello',
      }],
    },
    {
      url: '/foo/hello.test.info.html',
      indices: ['index.html'],
      mount: '/foo',
      expected: [{
        path: '/hello.test.info.html',
        name: 'hello.test',
        selector: 'info',
        ext: 'html',
        relPath: '/hello.test',
      }],
    },
    {
      url: '//index.html',
      indices: ['index.html'],
      mount: '',
      expected: [{
        path: '/index.html',
        name: 'index',
        selector: '',
        ext: 'html',
        relPath: '/index',
      }],
    },
    {
      url: '/default.html',
      indices: ['index.html'],
      mount: '',
      expected: [{
        path: '/default.html',
        name: 'default',
        selector: '',
        ext: 'html',
        relPath: '/default',
      }],
    },
  ];

  tests.forEach((test, idx) => {
    it(`[${idx + 1}] resolver works correctly for ${test.url}`, () => {
      const resultwithdefault = getPathInfos(test.url, test.mount, test.indices);
      assert.deepStrictEqual(resultwithdefault, test.expected);
    });
  });

  it('fails to resolve a path info, if the index has no extension', () => {
    try {
      getPathInfos('/foo/', '', ['invalid']);
      assert.fail('should fail');
    } catch (e) {
      assert.equal(e.message, 'directory index must have an extension.');
    }
  });
});
