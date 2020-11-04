import { Request, Response, Fastly, Headers, ResponseInit } from "@fastly/as-compute";
import { URL } from "./url";
import { RefPair } from "./ref-pair";

function main(req: Request): Response {
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
  // + "&rootPath=" + req.http.X-Root-Path;
  let root = url.queryparam("rootPath", "");


  const refpair = RefPair.resolveRefs(contentOwner, contentRepo, contentRef, staticOwner, staticRepo, staticRef);


  return new Response(String.UTF8.encode("This method is not allowed"), {
    status: 405,
  });


}


// Get the request from the client.
let req = Fastly.getClientRequest();

// Pass the request to the main request handler function.
let resp = main(req);

// Send the response back to the client.
Fastly.respondWith(resp);


