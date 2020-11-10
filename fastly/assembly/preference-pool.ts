import { Fastly } from "@fastly/as-compute";
import { Request, Headers } from "@fastly/as-fetch";

export class PreferencePool {
  private pool: Fastly.FetchPool;
  private fufilled: Map<string, Fastly.FufilledRequest>;

  constructor(urls: string[], headers: Headers, backend: string) {
    this.pool = new Fastly.FetchPool();
    this.fufilled = new Map<string, Fastly.FufilledRequest>();

    for (let i = 0; i < urls.length; i++) {
      const req = new Request(urls[i], {
        headers: headers
      });

      this.pool.push(Fastly.fetch(req, {
        backend: backend
      }));
    }
  }

  get(url: string): Fastly.FufilledRequest | null {
    if (this.fufilled.has(url)) {
      return this.fufilled.get(url);
    }
    const reqOrNull = this.pool.any();
    if (reqOrNull == null) {
      return reqOrNull;
    }

    const req: Fastly.FufilledRequest = reqOrNull as Fastly.FufilledRequest;
    this.fufilled.set(req.request.url(), req);

    // try again, maybe this time the pool has the requested url
    return this.get(url);
  }


}