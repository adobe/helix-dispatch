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

const race = promises => new Promise((resolve, reject) => {
  const results = new Array(promises.length);
  let resolved = false;
  const unihandler = (idx, val, err) => {
    // if already resolved, ignore further completions.
    if (resolved) {
      return;
    }
    // store the result of the promise
    results[idx] = {
      type: val ? 'value' : 'error',
      payload: val || err,
    };

    // find the first successful result
    for (const r of results) {
      if (r === undefined) {
        return;
      }
      if (r.type === 'value') {
        resolve(r.payload);
        resolved = true;
        return;
      }
    }

    // if all promises were rejected, reject with an array of errors.
    reject(results.map(r => r.payload));
  };

  promises.forEach((p, idx) => {
    p.then(v => unihandler(idx, v, null)).catch(er => unihandler(idx, null, er));
  });
});

module.exports = race;
