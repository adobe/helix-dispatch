import { Request, Response, Fastly } from "@fastly/as-compute";
// import { FastlyPendingUpstreamRequest } from "../../node_modules/@fastly/as-compute/assembly/fastly/fastly-upstream/fastly-pending-upstream-request"
// import { FastlyPendingUpstreamRequest } from "~lib/@fastly/as-compute/assembly/fastly/fastly-upstream/fastly-pending-upstream-request"
import { URL } from "./url";
import { RefPair } from "./ref-pair";
import { PathInfo } from "./path-info";
import { URLBuilder } from "./url-builder";
import { PreferencePool } from "./preference-pool";
import { CoralogixLogger } from "./coralogix";

function main(req: Request, redirects: u8, redirectTo: string): Response {
  const logger = new CoralogixLogger("helix-dispatch", req);
  let url = new URL(req.url());

  // // fallback repo
  // + "?static.owner=" + req.http.X-Github-Static-Owner
  let staticOwner = url.queryparam("static.owner", "");
  // + "&static.repo=" + req.http.X-Github-Static-Repo
  let staticRepo = url.queryparam("static.repo", "");
  // + "&static.ref=" + req.http.X-Github-Static-Ref
  let staticRef = url.queryparam("static.ref", "");
  // + "&static.root=" + req.http.X-Github-Static-Root
  let staticRoot = url.queryparam("static.root", "");
  // // content repo
  // + "&content.owner=" + req.http.X-Owner
  let contentOwner = url.queryparam("content.owner", "");
  // + "&content.repo=" + req.http.X-Repo
  let contentRepo = url.queryparam("content.repo", "");
  // + "&content.ref=" + req.http.X-Ref
  let contentRef = url.queryparam("content.ref", "");
  // + "&content.root=" + req.http.X-Repo-Root-Path
  let contentRoot = url.queryparam("content.root", "");
  // + "&content.package=" + var.package
  let contentPackage = url.queryparam("content.package", "");
  // + "&content.index=" + req.http.X-Index
  let contentIndex = url.queryparam("content.index", "").split(",");
  // + "&path=" + req.url.path
  let path = url.queryparam("path", "");

  let namespace = url.queryparam("namespace", "namespace");

  logger.debug("Request received: " + [staticOwner, staticRepo, contentOwner, contentRepo, path, namespace].join(", "));

  if (redirectTo != "") {
    path = redirectTo;
  }

  // + "&rootPath=" + req.http.X-Root-Path;
  let root = url.queryparam("rootPath", "");


  const refpair = RefPair.resolveRefs(contentOwner, contentRepo, contentRef, staticOwner, staticRepo, staticRef);

  logger.debug("refpair received " + refpair.contentRef + "/" + refpair.staticRef);

  let contentOpts = new Map<string, string>();
  contentOpts.set("owner", contentOwner);
  contentOpts.set("repo", contentRepo);
  contentOpts.set("ref", refpair.contentRef);
  contentOpts.set("root", contentRoot);

  let staticOpts = new Map<string, string>();
  staticOpts.set("owner", staticOwner);
  staticOpts.set("repo", staticRepo);
  staticOpts.set("ref", refpair.staticRef);
  staticOpts.set("root", staticRoot);

  // list of path names to try
  let pathinfos = PathInfo.buildPathInfos(path, root, contentIndex);

  logger.debug("pathinfos constructed: " + pathinfos[0].path);

  const builder = new URLBuilder(contentOpts, staticOpts, root, contentPackage)
    .withNamespace(namespace);

  // first batch: action and fallback
  
  logger.debug("urlbuilder initialized");
  
  const rawURLs = builder.buildRawURLs(pathinfos);
  logger.debug("raw urls:" + rawURLs.length);
  const actionURLs = builder.buildActionURLs(pathinfos);
  logger.debug("action urls:" + actionURLs.length);
  const fallbackURLs = builder.buildFallbackURLs(pathinfos);
  logger.debug("fallback urls:" + fallbackURLs.length);
  const firstBatchURLs = rawURLs.concat(actionURLs).concat(fallbackURLs);
  
  let firstBatch = new PreferencePool(
    firstBatchURLs, 
    req.headers(), 
    "AdobeRuntime");

  for (let i = 0; i < firstBatchURLs.length; i++) {
    const fulfilled = firstBatch.get(firstBatchURLs[i]);
    if (fulfilled !== null) {
      const response: Response = (fulfilled as Fastly.FufilledRequest).response;
      if (response.ok()) {
        // response is ok, return to client
        return response;
      }
      if (response.status() > 500) {
        // TODO differentiate
        return new Response(String.UTF8.encode("Bad Gateway"), {
          status: 502,
        });
      }
    }
    // else wait for next candidate
  }

  const redirectURLs = builder.buildRedirectURLs(path);
  const error404URLs = builder.build404URLs(pathinfos);
  const secondBatchURLs = redirectURLs.concat(error404URLs);

  // second batch: 404 and redirects
  let secondBatch = new PreferencePool(
    secondBatchURLs,
    req.headers(),
    "AdobeRuntime");

  for (let i = 0; i < secondBatchURLs.length; i++) {
    const fulfilled = secondBatch.get(secondBatchURLs[i]);
    if (fulfilled !== null) {
      const response: Response = (fulfilled as Fastly.FufilledRequest).response;
      
      if (response.status() == 200) {
      // the 404 handler responded, use the response body and headers, but overwrite
      // the status code
        return new Response(String.UTF8.encode(response.text()), {
          headers: response.headers(),
          status: 404,
        });
      } else if (response.status() == 204) {
      // no redirect
      } else if (response.status() == 301 || response.status() == 302) {
      // regular redirect
        return response;
      } else if (response.status() == 307) {
      // internal redirect
        if (redirects > 2) {
          return new Response(String.UTF8.encode("Too many internal redirects"), {
            status: 508,
          });
        }

        let target = "";
        if (response.headers().has("Location")) {
          target = response.headers().get("Location") as string;
          // restart from top
          return main(req, redirects + 1, target);
        }
      } else if (response.status() > 500) {
      // TODO differentiate
        return new Response(String.UTF8.encode("Bad Gateway"), {
          status: 502,
        });
      }
    }

    // else wait for next candidate
  }


  return new Response(String.UTF8.encode("There is nothing to satisfy this request"), {
    status: 404,
  });


}


// Get the request from the client.
let req = Fastly.getClientRequest();

// Pass the request to the main request handler function.
let resp = main(req, (0 as u8), "");

// Send the response back to the client.
Fastly.respondWith(resp);


