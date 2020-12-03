# Helix Dispatch

> A Helix microservice that retrieves content from multiple sources and delivers the best match

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-dispatch.svg)](https://codecov.io/gh/adobe/helix-dispatch)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/helix-dispatch.svg)](https://circleci.com/gh/adobe/helix-dispatch)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-dispatch.svg)](https://github.com/adobe/helix-dispatch/blob/main/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/helix-dispatch.svg)](https://github.com/adobe/helix-dispatch/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/helix-dispatch.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/helix-dispatch)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release) 

## Installation

Not needed, the service is pre-installed as soon as you run `hlx deploy`.

## Usage

Invoke the action using `wsk`

```bash
wsk action invoke helix-services/dispatch@v2 --result --blocking \
  -p static.owner trieloff \
  -p static.repo helix-demo \
  -p static.ref master \
  -p static.root htdocs \
  -p content.owner trieloff \
  -p content.repo helix-demo \
  -p content.ref master \
  -p content.package b7aa8a6351215b7e12b6d3be242c622410c1eb28 \
  -p path /index.html
```

Use the web action (replace `trieloff` with your GitHub user name)

```bash
curl "https://adobeioruntime.net/api/v1/web/trieloff/helix-services/dispatch%40v2?static.owner=trieloff&static.repo=trieloff&static.ref=master&static.root=htdocs&content.owner=trieloff&content.repo=helix-demo&content.ref=master&content.package=b7aa8a6351215b7e12b6d3be242c622410c1eb28&path=/index.html"
```

For a detailed list of all possible request parameters, check out the [reference documentation](docs/API.md).

## Development

### Deploying Helix Static

Deploying Helix Service requires the `wsk` command line client, authenticated to a namespace of your choice. For Project Helix, we use the `helix` namespace.

All commits to main that pass the testing will be deployed automatically. All commits to branches that will pass the testing will get commited as `/helix-services/service@ci<num>` and tagged with the CI build number.
