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
const proxyquire = require('proxyquire');
const assert = require('assert');
const { AssertionError } = require('assert');
const {
  defaultResolver, errorPageResolver, getPathInfos,
} = require('../src/fetchers');

const SHAS = {
  adobe: '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
  trieloff: '4e8dec3886cb75bcea6970b4b00783f69cbf487a',
};

const SAMPLE_GITHUB_TOKEN = 'some-github-token-value';

let resolverInvocationCount = 0;

const { fetchers } = proxyquire('../src/fetchers', {
  './openwhisk.js': () => ({
    actions: {
      invoke({ params: { ref, owner } }) {
        resolverInvocationCount += 1;
        if (ref === 'branch') {
          return Promise.reject(new Error('unknown'));
        }
        if (ref === 'notfound') {
          return Promise.resolve({
            statusCode: 404, // not found
            body: 'ref not found',
          });
        }
        if (ref === 'fail') {
          return Promise.resolve({
            statusCode: 503, // service unavailable
            body: 'failed to fetch git repo info.',
          });
        }
        return Promise.resolve({
          body: {
            fqRef: 'refs/heads/master',
            sha: SHAS[owner],
          },
          headers: {
            'Content-Type': 'application/json',
          },
          statusCode: 200,
        });
      },
    },
  }),
});

const opts = {
  'static.owner': 'adobe',
  'static.ref': 'master',
  'content.owner': 'trieloff',
  'content.package': '60ef2a011a6a91647eba00f798e9c16faa9f78ce',
  'content.ref': 'master',
};

function logres(r) {
  Promise.all(r).then((res) => {
    // eslint-disable-next-line no-console
    console.table(res.map((s) => ({
      name: s.name,
      owner: s.params.owner,
      path: s.params.path,
      ref: s.params.ref,
    })));
  // eslint-disable-next-line no-console
  }).catch(console.error);
}

describe('testing fetchers.js', () => {
  it('fetch nothing', async () => {
    const res = fetchers();

    assert.equal(res.length, 5);
    logres(res);
  });

  it('fetch basic HTML', async () => {
    const ric = resolverInvocationCount;
    const res = await Promise.all(fetchers({
      ...opts,
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(res[0].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/hlx--static');
    assert.equal(res[0].params.ref, SHAS.trieloff);
    assert.equal(res[0].params.branch, 'master');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(res[1].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[1].params.ref, SHAS.trieloff);
    assert.equal(res[2].params.ref, SHAS.adobe);
    assert.equal(res[2].params.branch, 'master');
    assert.equal(resolverInvocationCount - ric, 2);
  });

  it('fetch basic HTML invokes resolver only once if same repo', async () => {
    const ric = resolverInvocationCount;
    const res = await Promise.all(fetchers({
      ...opts,
      'content.owner': 'adobe',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(res[0].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/hlx--static');
    assert.equal(res[0].params.ref, SHAS.adobe);
    assert.equal(res[0].params.branch, 'master');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(res[1].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[1].params.ref, SHAS.adobe);
    assert.equal(res[2].params.ref, SHAS.adobe);
    assert.equal(resolverInvocationCount - ric, 1);
  });

  it('fetch basic HTML from sha', async () => {
    const res = await Promise.all(fetchers({
      ...opts,
      'static.ref': '3e8dec3886cb75bcea6970b4b00783f69cbf487a',
      path: '/dir/example.html',
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(res[0].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/hlx--static');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(res[1].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html');
    assert.equal(res[1].params.path, '/dir/example.md');
  });

  it('fetch basic HTML from branch while resolver rejects', async () => {
    const res = await Promise.all(fetchers({
      ...opts,
      'static.ref': 'branch',
      path: '/dir/example.html',
      __ow_logger: console,
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(res[0].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/hlx--static');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(res[1].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[2].params.ref, 'branch');
  });

  it('log info if resolver returns 404', async () => {
    let test;
    await Promise.all(fetchers({
      ...opts,
      'static.ref': 'notfound',
      path: '/dir/example.html',
      __ow_logger: {
        info: (msg) => { test = msg; },
        error: () => {},
      },
    }));
    assert.equal(test, 'Unable to resolve ref notfound: 404 ref not found',
      'expected console.info() to be called');
  });

  it('log error if resolver returns 503', async () => {
    let test;
    await Promise.all(fetchers({
      ...opts,
      'static.ref': 'fail',
      path: '/dir/example.html',
      __ow_logger: {
        info: () => {},
        error: (msg) => { test = msg; },
      },
    }));
    assert.equal(test, 'Unable to resolve ref fail: 503 failed to fetch git repo info.',
      'expected console.error() to be called');
  });

  it('fetch basic HTML from branch while resolver fails', async () => {
    const res = await Promise.all(fetchers({
      ...opts,
      'static.ref': 'fail',
      'content.ref': 'fail',
      path: '/dir/example.html',
      __ow_logger: console,
    }));

    logres(res);
    assert.equal(res.length, 5);
    assert.equal(res[0].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/hlx--static');
    assert.equal(res[0].params.path, '/dir/example.html');
    assert.equal(res[1].name, '60ef2a011a6a91647eba00f798e9c16faa9f78ce/html');
    assert.equal(res[1].params.path, '/dir/example.md');
    assert.equal(res[2].params.ref, 'fail');
  });

  it('fetch HTML with selector', () => {
    const res = fetchers({
      ...opts,
      path: '/dir/example.nav.html',
    });

    assert.equal(res.length, 5);
    logres(res);
  });

  it('fetch directory index', () => {
    const res = fetchers({
      ...opts,
      path: '/example/dir',
    });

    assert.equal(res.length, 8);
    logres(res);
  });

  it('fetch non html', () => {
    const res = fetchers({
      ...opts,
      path: '/style.css',
    });

    assert.equal(res.length, 3);
    logres(res);
  });

  it('Github token provided via parameter is passed to fetchers', async () => {
    const res = await Promise.all(fetchers({
      ...opts,
      GITHUB_TOKEN: SAMPLE_GITHUB_TOKEN,
      path: '/style.css',
    }));

    assert.equal(res.length, 3);
    assert.equal(res[0].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    assert.equal(res[1].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    assert.equal(res[2].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    logres(res);
  });

  it('Github token provided via header is passed to fetchers', async () => {
    const res = await Promise.all(fetchers({
      ...opts,
      __ow_headers: { 'x-github-token': SAMPLE_GITHUB_TOKEN },
      path: '/style.css',
    }));

    assert.equal(res.length, 3);
    assert.equal(res[0].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    assert.equal(res[1].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    assert.equal(res[2].params.GITHUB_TOKEN, SAMPLE_GITHUB_TOKEN);
    logres(res);
  });

  it('test if headers are passed to all fetchers', async () => {
    const res = await Promise.all(fetchers({
      ...opts,
      path: '/dir/example.html',
      __ow_headers: {
        'a-header': 'its-value',
      },
    }));

    logres(res);
    assert.equal(res.length, 5);
    // all fetchers should propagate the headers
    res.forEach((r) => {
      assert.ok(r.params.__ow_headers);
      assert.equal(r.params.__ow_headers['a-header'], 'its-value');
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
      await Promise.resolve({
        statusCode: 400,
        actionOptions: {
          params: {
            owner: 'adobe',
            repo: 'helix-statix',
            ref: 'master',
            path: '/index.html',
          },
        },
      }).then(defaultResolver);
      assert.fail('this should never happen');
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e;
      }
      assert.equal(e.message, 'Error invoking undefined(adobe/helix-statix/master/index.html): 400');
    }
  });
});

describe('testing error page promise resolver', () => {
  it('error page promise resolver accepts status 200', async () => {
    const res = await Promise.resolve({
      statusCode: 200,
    }).then(errorPageResolver);
    assert.equal(res.statusCode, 404);
    assert.ok(res);
  });

  it('error page promise resolver throws on status 400', async () => {
    try {
      await Promise.resolve({
        statusCode: 400,
        actionOptions: {
          params: {
            owner: 'adobe',
            repo: 'helix-statix',
            ref: 'master',
            path: '/index.html',
          },
        },
      }).then(errorPageResolver);
      assert.fail('this should never happen');
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e;
      }
      assert.equal(e.message, 'Error invoking undefined(adobe/helix-statix/master/index.html): 400');
    }
  });
});

describe('testing path info resolution', () => {
  const tests = [
    {
      url: '/hä',
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
      }, {
        path: '/hä.html',
        name: 'hä',
        selector: '',
        ext: 'html',
        relPath: '/hä',
      }],
    },
    {
      url: '/foo',
      indices: ['index.html'],
      mount: '',
      expected: [{
        path: '/foo/index.html',
        name: 'index',
        selector: '',
        ext: 'html',
        relPath: '/foo/index',
      }, {
        path: '/foo.html',
        name: 'foo',
        selector: '',
        ext: 'html',
        relPath: '/foo',
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
      url: '/foo/hello.info.html',
      indices: ['index.html'],
      mount: '/foo',
      expected: [{
        path: '/hello.info.html',
        name: 'hello',
        selector: 'info',
        ext: 'html',
        relPath: '/hello',
      }],
    },
    {
      url: '/foo/hello.info.html',
      indices: ['index.html'],
      mount: '/foot',
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
      getPathInfos('/foo', '', ['invalid']);
      assert.fail('should fail');
    } catch (e) {
      assert.equal(e.message, 'directory index must have an extension.');
    }
  });
});
