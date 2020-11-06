import { Request, Response, Fastly } from "@fastly/as-compute";
import { FastlyPendingUpstreamRequest } from "@fastly/as-compute/fastly-upstream/fastly-pending-upstream-request";
import { URL } from "./url";
import { RefPair } from "./ref-pair";
import { PathInfo } from "./path-info";
import { URLBuilder } from "./url-builder";
import { redirect } from "../../src/redirects";

function main(req: Request, redirects: U8, redirectTo: string): Response {
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
  if (redirectTo != "") {
    path = redirectTo;
  }

  // + "&rootPath=" + req.http.X-Root-Path;
  let root = url.queryparam("rootPath", "");


  const refpair = RefPair.resolveRefs(contentOwner, contentRepo, contentRef, staticOwner, staticRepo, staticRef);
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

  const builder = new URLBuilder(contentOpts, staticOpts, root, contentPackage)
    .withNamespace(namespace);

  // first batch: action and fallback
  let firstBatch = new Array<FastlyPendingUpstreamRequest>();
  
  const rawURLs = builder.buildRawURLs(pathinfos).values();
  for (let i = 0; i < rawURLs.length; i++) {
    const beReq = new Request(rawURLs[i], {
      headers: req.headers()
    });
    firstBatch.push(Fastly.fetch(beReq, {
      backend: "AdobeRuntime"
    }));
  }

  const actionURLs = builder.buildRawURLs(pathinfos).values();
  for (let i = 0; i < actionURLs.length; i++) {
    const beReq = new Request(actionURLs[i], {
      headers: req.headers()
    });
    firstBatch.push(Fastly.fetch(beReq, {
      backend: "AdobeRuntime"
    }));
  }

  const fallbackURLs = builder.buildFallbackURLs(pathinfos).values();
  for (let i = 0; i < fallbackURLs.length; i++) {
    const beReq = new Request(fallbackURLs[i], {
      headers: req.headers()
    });
    firstBatch.push(Fastly.fetch(beReq, {
      backend: "AdobeRuntime"
    }));
  }

  for (let i = 0; i < firstBatch.length; i++) {
    const response: Response = firstBatch[i].wait();

    if (response.ok()) {
      // response is ok, return to client
      return response;
    }
    if (response.status > 500) {
      // TODO differentiate
      return new Response(String.UTF8.encode("Bad Gateway"), {
        status: 502,
      });
    }
    // else wait for next candidate
  }


  // second batch: 404 and redirects
  let secondBatch = new Array<FastlyPendingUpstreamRequest>();

  const redirectURLs = builder.buildRedirectURLs(path).values();
  for (let i = 0; i < redirectURLs.length; i++) {
    const beReq = new Request(redirectURLs[i], {
      headers: req.headers()
    });
    secondBatch.push(Fastly.fetch(beReq, {
      backend: "AdobeRuntime"
    }));
  }

  const error404URLs = builder.build404URLs(pathinfos).values();
  for (let i = 0; i < error404URLs.length; i++) {
    const beReq = new Request(error404URLs[i], {
      headers: req.headers()
    });
    secondBatch.push(Fastly.fetch(beReq, {
      backend: "AdobeRuntime"
    }));
  }

  for (let i = 0; i < secondBatch.length; i++) {
    const response: Response = secondBatch[i].wait();

    if (response.status == 200) {
      // the 404 handler responded, use the response body and headers, but overwrite
      // the status code
      return new Response(response, {
        headers: response.headers(),
        status: 404,
      });
    } else if (response.status == 204) {
      // no redirect
    } else if (response.status == 301 || response.status == 302) {
      // regular redirect
      return redirect;
    } else if (response.status == 307) {
      // internal redirect
      if (redirects > 2) {
        return new Response(String.UTF8.encode("Too many internal redirects"), {
          status: 508,
        });
      }

      let target = "";
      if (response.headers().has("Location")) {
        target = response.headers().get("Location");
        // restart from top
        return main(req, redirects + 1, target);
      }
    } else if (response.status > 500) {
      // TODO differentiate
      return new Response(String.UTF8.encode("Bad Gateway"), {
        status: 502,
      });
    }
    // else wait for next candidate
  }


  return new Response(String.UTF8.encode("This method is not allowed"), {
    status: 405,
  });


}


// Get the request from the client.
let req = Fastly.getClientRequest();

// Pass the request to the main request handler function.
let resp = main(req, 0, "");

// Send the response back to the client.
Fastly.respondWith(resp);


