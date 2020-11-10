import { FetchPool, FufilledRequest, Fastly } from "@fastly/as-compute";
import { Request, Headers } from "@fastly/as-fetch";

export class PreferencePool {
  private pool: FetchPool;
  private fufilled: Map<string, FufilledRequest>;

  constructor(urls: string[], headers: Headers, backend: string) {
    this.pool = new FetchPool();
    this.fufilled = new Map<string, FufilledRequest>();

    for (let i = 0; i < urls.length; i++) {
      const req = new Request(urls[i], {
        headers: headers
      });

      this.pool.push(Fastly.fetch(req, {
        backend: backend
      }));
    }
  }

  get(url: string): FufilledRequest | null {
    if (this.fufilled.has(url)) {
      return this.fufilled.get(url);
    }
    const reqOrNull = this.pool.any();
    if (reqOrNull == null) {
      return reqOrNull;
    }

    const req: FufilledRequest = reqOrNull as FufilledRequest;
    this.fufilled.set(req.request.url(), req);

    // try again, maybe this time the pool has the requested url
    return this.get(url);
  }


}