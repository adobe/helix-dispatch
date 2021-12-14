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
const chai = require('chai');
const chaiHttp = require('chai-http');
const { createTargets } = require('./post-deploy-utils.js');

chai.use(chaiHttp);
const { expect } = chai;

createTargets().forEach((target) => {
  describe(`Post-Deploy Tests (${target.title()}) #online`, () => {
    before(function beforeAll() {
      if (!target.enabled()) {
        this.skip();
      }
    });

    it('Service is reachable', async () => {
      await chai
        .request(target.host())
        .get(`${target.urlPath()}?static.owner=trieloff&static.repo=helix-demo&static.ref=master&path=/index.md&content.owner=trieloff&content.repo=helix-demo&content.ref=master`)
        .set('x-ow-version-lock', target.env())
        .then((response) => {
          expect(response).to.have.status(200);
        })
        .catch((e) => {
          throw e;
        });
    }).timeout(60000);

    it('Returns 404 for path with trailing dot.', async () => {
      await chai
        .request(target.host())
        .get(`${target.urlPath()}?static.owner=trieloff&static.repo=helix-demo&static.ref=master&path=/foo/bar.&content.owner=trieloff&content.repo=helix-demo&content.ref=master`)
        .set('x-ow-version-lock', target.env())
        .then((response) => {
          expect(response).to.have.status(404);
        })
        .catch((e) => {
          throw e;
        });
    }).timeout(60000);

    it('Redirects work', async () => {
      // this is using the spreadsheet from https://adobe.sharepoint.com/:x:/r/sites/TheBlog/_layouts/15/doc2.aspx?sourcedoc=%7Bb20ba4a8-5040-40da-a19c-bad381543fb6%7D&action=editnew&cid=0c46f5e7-178b-4783-96d6-3f49edbe3043
      const url = `${target.urlPath()}?static.owner=trieloff&static.repo=helix-demo&static.ref=master&path=/tag/coronavirus/&content.owner=trieloff&content.repo=helix-demo&content.ref=blog-redirects`;
      // eslint-disable-next-line no-console
      console.log(url);
      await chai
        .request(target.host())
        .get(url)
        .set('x-ow-version-lock', target.env())
        .then((response) => {
          expect(response).to.redirectTo('https://blog.adobe.com/en/topics/covid-19');
        })
        .catch((e) => {
          throw e;
        });
    }).timeout(60000);
  });
});
