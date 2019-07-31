## [1.5.1](https://github.com/adobe/helix-experimental-dispatch/compare/v1.5.0...v1.5.1) (2019-07-31)


### Bug Fixes

* **fetcher:** ensure proper content options for same repository coordinates ([#63](https://github.com/adobe/helix-experimental-dispatch/issues/63)) ([99fa91d](https://github.com/adobe/helix-experimental-dispatch/commit/99fa91d)), closes [#60](https://github.com/adobe/helix-experimental-dispatch/issues/60)

# [1.5.0](https://github.com/adobe/helix-experimental-dispatch/compare/v1.4.3...v1.5.0) (2019-07-30)


### Bug Fixes

* **index:** enable invoker to handle promises ([2b4be48](https://github.com/adobe/helix-experimental-dispatch/commit/2b4be48))


### Features

* **fetchers:** add branch parameter for resolved git refs to enable accurate surrogate-key calculation ([5961332](https://github.com/adobe/helix-experimental-dispatch/commit/5961332))
* **fetchers:** try to resolve git ref prior to fetching ([4711f87](https://github.com/adobe/helix-experimental-dispatch/commit/4711f87)), closes [#3](https://github.com/adobe/helix-experimental-dispatch/issues/3)

## [1.4.3](https://github.com/adobe/helix-experimental-dispatch/compare/v1.4.2...v1.4.3) (2019-07-29)


### Bug Fixes

* **package:** update snyk to version 2.0.0 ([370d899](https://github.com/adobe/helix-experimental-dispatch/commit/370d899))

## [1.4.2](https://github.com/adobe/helix-experimental-dispatch/compare/v1.4.1...v1.4.2) (2019-07-26)


### Bug Fixes

* **package:** update @adobe/helix-pingdom-status to version 3.0.0 ([d8e5fe2](https://github.com/adobe/helix-experimental-dispatch/commit/d8e5fe2))

## [1.4.1](https://github.com/adobe/helix-experimental-dispatch/compare/v1.4.0...v1.4.1) (2019-07-24)


### Bug Fixes

* **package:** update @adobe/helix-pingdom-status to version 2.0.0 ([29adcdc](https://github.com/adobe/helix-experimental-dispatch/commit/29adcdc))

# [1.4.0](https://github.com/adobe/helix-experimental-dispatch/compare/v1.3.7...v1.4.0) (2019-07-18)


### Features

* **cache:** add request header to disable the cache in response ([4373d67](https://github.com/adobe/helix-experimental-dispatch/commit/4373d67))

## [1.3.7](https://github.com/adobe/helix-experimental-dispatch/compare/v1.3.6...v1.3.7) (2019-07-16)


### Bug Fixes

* **fetcher:** ensure __ow_headers are send to action and path is sanitized ([#48](https://github.com/adobe/helix-experimental-dispatch/issues/48)) ([8ff7bad](https://github.com/adobe/helix-experimental-dispatch/commit/8ff7bad)), closes [#46](https://github.com/adobe/helix-experimental-dispatch/issues/46) [#45](https://github.com/adobe/helix-experimental-dispatch/issues/45)

## [1.3.6](https://github.com/adobe/helix-experimental-dispatch/compare/v1.3.5...v1.3.6) (2019-07-16)


### Bug Fixes

* **test:** adjust to new outpu from pingdom-status ([ee5937f](https://github.com/adobe/helix-experimental-dispatch/commit/ee5937f))

## [1.3.5](https://github.com/adobe/helix-experimental-dispatch/compare/v1.3.4...v1.3.5) (2019-07-08)


### Bug Fixes

* **package:** update epsagon to version 1.29.0 ([8c867f2](https://github.com/adobe/helix-experimental-dispatch/commit/8c867f2))

## [1.3.4](https://github.com/adobe/helix-experimental-dispatch/compare/v1.3.3...v1.3.4) (2019-07-04)


### Bug Fixes

* **error:** ensure that 500 is returned when present ([#36](https://github.com/adobe/helix-experimental-dispatch/issues/36)) ([99998b2](https://github.com/adobe/helix-experimental-dispatch/commit/99998b2))

## [1.3.3](https://github.com/adobe/helix-experimental-dispatch/compare/v1.3.2...v1.3.3) (2019-07-04)


### Bug Fixes

* **fetcher:** only try to fetch 404.html for html requests ([#34](https://github.com/adobe/helix-experimental-dispatch/issues/34)) ([c234252](https://github.com/adobe/helix-experimental-dispatch/commit/c234252)), closes [#30](https://github.com/adobe/helix-experimental-dispatch/issues/30)

## [1.3.2](https://github.com/adobe/helix-experimental-dispatch/compare/v1.3.1...v1.3.2) (2019-07-04)


### Bug Fixes

* **dynamic:** handle selector properly when invoking action ([#33](https://github.com/adobe/helix-experimental-dispatch/issues/33)) ([f5c29b8](https://github.com/adobe/helix-experimental-dispatch/commit/f5c29b8)), closes [#31](https://github.com/adobe/helix-experimental-dispatch/issues/31)

## [1.3.1](https://github.com/adobe/helix-experimental-dispatch/compare/v1.3.0...v1.3.1) (2019-07-03)


### Bug Fixes

* **index:** improve error handling ([#27](https://github.com/adobe/helix-experimental-dispatch/issues/27)) ([6f0f949](https://github.com/adobe/helix-experimental-dispatch/commit/6f0f949)), closes [#25](https://github.com/adobe/helix-experimental-dispatch/issues/25)

# [1.3.0](https://github.com/adobe/helix-experimental-dispatch/compare/v1.2.3...v1.3.0) (2019-06-25)


### Features

* **monitoring:** add monitoring with Epsagon ([7e8cabe](https://github.com/adobe/helix-experimental-dispatch/commit/7e8cabe))

## [1.2.3](https://github.com/adobe/helix-experimental-dispatch/compare/v1.2.2...v1.2.3) (2019-06-24)


### Bug Fixes

* **content:** add params support ([5312816](https://github.com/adobe/helix-experimental-dispatch/commit/5312816)), closes [#5](https://github.com/adobe/helix-experimental-dispatch/issues/5)
* **content:** support `content.root` parameter ([a6565fc](https://github.com/adobe/helix-experimental-dispatch/commit/a6565fc)), closes [#7](https://github.com/adobe/helix-experimental-dispatch/issues/7)

## [1.2.2](https://github.com/adobe/helix-experimental-dispatch/compare/v1.2.1...v1.2.2) (2019-06-14)


### Bug Fixes

* **pipeline:** use md when fetching from pipeline ([7be268f](https://github.com/adobe/helix-experimental-dispatch/commit/7be268f))

## [1.2.1](https://github.com/adobe/helix-experimental-dispatch/compare/v1.2.0...v1.2.1) (2019-06-14)


### Bug Fixes

* **static:** use correct parameters for static action ([c2eb2e0](https://github.com/adobe/helix-experimental-dispatch/commit/c2eb2e0))

# [1.2.0](https://github.com/adobe/helix-experimental-dispatch/compare/v1.1.2...v1.2.0) (2019-06-13)


### Features

* **fetchers:** fetch from content, pipeline, static, 404 (content), 404 (static) repositories ([fbc2244](https://github.com/adobe/helix-experimental-dispatch/commit/fbc2244))

## [1.1.2](https://github.com/adobe/helix-experimental-dispatch/compare/v1.1.1...v1.1.2) (2019-06-13)


### Bug Fixes

* **index:** use blocking invocations and wait for the result ([2e1ed68](https://github.com/adobe/helix-experimental-dispatch/commit/2e1ed68))

## [1.1.1](https://github.com/adobe/helix-experimental-dispatch/compare/v1.1.0...v1.1.1) (2019-06-13)


### Bug Fixes

* **index:** delay call of openwhisk constructor, use correct action name ([e4c8e27](https://github.com/adobe/helix-experimental-dispatch/commit/e4c8e27))

# [1.1.0](https://github.com/adobe/helix-experimental-dispatch/compare/v1.0.0...v1.1.0) (2019-06-13)


### Features

* **index:** fetch from static action ([a20b4ed](https://github.com/adobe/helix-experimental-dispatch/commit/a20b4ed))

# 1.0.0 (2019-06-13)


### Bug Fixes

* **build:** add missing build folder ([76ef830](https://github.com/adobe/helix-experimental-dispatch/commit/76ef830))


### Features

* **race:** implement a custom `Promise.race` function ([614f467](https://github.com/adobe/helix-experimental-dispatch/commit/614f467))

# [1.1.0](https://github.com/adobe/helix-service/compare/v1.0.1...v1.1.0) (2019-06-12)


### Features

* **action:** turn action into a web action ([f41f212](https://github.com/adobe/helix-service/commit/f41f212))

## [1.0.1](https://github.com/adobe/helix-service/compare/v1.0.0...v1.0.1) (2019-06-12)


### Bug Fixes

* **build:** add missing dependency ([aa163d7](https://github.com/adobe/helix-service/commit/aa163d7))

# 1.0.0 (2019-06-12)


### Bug Fixes

* **build:** add wsk property for release tracking ([9e36a10](https://github.com/adobe/helix-service/commit/9e36a10))
* **build:** increase version number to get a release ([f04ab95](https://github.com/adobe/helix-service/commit/f04ab95))
