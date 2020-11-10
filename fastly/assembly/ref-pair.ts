import { Request, Response, Fastly } from "@fastly/as-compute";
import { ResolvedRef } from "./resolved-ref";

export class RefPair {
  contentRef: string;
  staticRef: string;

  constructor(cont: string, stat: string) {
    this.contentRef = cont;
    this.staticRef = stat;
  }
  
  static resolveRefs(contentOwner: string, contentRepo: string, contentRef: string, staticOwner: string, staticRepo: string, staticRef: string): RefPair {
    let cacheOverride = new Fastly.CacheOverride();
    cacheOverride.setTTL(30);

    const resolveContentRefReq: Request = new Request("https://helix-resolve-git-ref-as.edgecompute.app/?owner=" + contentOwner + "&repo=" + contentRepo + "&ref=" + contentRef, {});

    const resolveContentRefResPending = Fastly.fetch(resolveContentRefReq, {
      backend: "Fastly",
      cacheOverride,
    });

    let resolveStaticRefRes: Response;
    let resolveContentRefRes: Response;

    if (false && contentOwner == staticOwner && contentRepo == staticRepo && contentRef == staticRef) {
      resolveContentRefRes = resolveContentRefResPending.wait();
      resolveStaticRefRes = resolveContentRefRes;
    } else {
      const resolveStaticRefReq = new Request("https://helix-resolve-git-ref-as.edgecompute.app/?owner=" + staticOwner + "&repo=" + staticRepo + "&ref=" + staticRef, {});

      resolveStaticRefRes = Fastly.fetch(resolveStaticRefReq, {
        backend: "Fastly",
        cacheOverride,
      }).wait();

      resolveContentRefRes = resolveContentRefResPending.wait();
    }

    contentRef = new ResolvedRef(resolveContentRefRes.text()).sha;
    staticRef = new ResolvedRef(resolveStaticRefRes.text()).sha;
    return new RefPair(contentRef, staticRef);
  }

}