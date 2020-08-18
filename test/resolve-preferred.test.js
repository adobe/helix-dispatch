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
const resolvePreferred = require('../src/resolve-preferred');

function timeout(duration, succeed, value) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (succeed) {
        resolve(value || 'ok');
      } else {
        reject(new Error(value || 'fail'));
      }
    }, duration);
  });
}

describe('Test custom Promise.race', () => {
  it('race returns a promise', () => {
    const p = resolvePreferred([]);
    assert.ok(p.then);
    assert.ok(p.catch);
  });

  it('race rejects empty tasks', async () => {
    await assert.rejects(resolvePreferred([]), new Error('unable to resolve preferred from empty array.'));
  });

  it('race resolves if only one promise succeeds', async () => {
    const p = await resolvePreferred([timeout(0, true)]);
    assert.equal(p, 'ok');
  });

  it('race throws if the only promise fails', async () => {
    try {
      await resolvePreferred([timeout(0, false)]);
    } catch (e) {
      assert.equal(e[0].message, 'fail');
    }
  });

  it('race returns the first, not the fastest successful promise', async () => {
    const p = await resolvePreferred([
      timeout(100, true, 'first'),
      timeout(10, true, 'second'),
      timeout(1, true, 'third'),
    ]);
    assert.equal(p, 'first');
  });

  it('race does not wait for slow promises', async () => {
    const p = await resolvePreferred([
      timeout(1, true, 'first'),
      timeout(10, true, 'second'),
      timeout(100, true, 'third'),
    ]);
    assert.equal(p, 'first');
  }).timeout(5);

  it('race does not wait for failures promises', async () => {
    const p = await resolvePreferred([
      timeout(1, false, 'first'),
      timeout(10, true, 'second'),
      timeout(100, false, 'third'),
    ]);
    assert.equal(p, 'second');
  }).timeout(50);
});
