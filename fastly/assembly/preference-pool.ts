import { Fastly } from "@fastly/as-compute";
import { Request, Headers } from "@fastly/as-fetch";
import { CoralogixLogger } from "./coralogix";
import { Pool } from "./pool";

export class PreferencePool implements Pool {
  private pool: Fastly.FetchPool;
  private fufilled: Map<string, Fastly.FufilledRequest>;
  private logger: CoralogixLogger;
  private urls: string[];

  constructor(urls: string[], headers: Headers, backend: string, logger: CoralogixLogger) {
    this.logger = logger;
    logger.debug("creating fetch pool");
    this.pool = new Fastly.FetchPool();
    logger.debug("fetch pool created");
    this.fufilled = new Map<string, Fastly.FufilledRequest>();
    this.urls = urls;

    for (let i = 0; i < urls.length; i++) {
      const req = new Request(urls[i], {
        headers: headers
      });
      logger.debug("running fetch: " + urls[i]);
      const pending = Fastly.fetch(req, {
        backend: backend
      });
      logger.debug("adding url to pool: " + urls[i]);
      this.pool.push(pending);
      logger.debug("done.");
    }
  }

  get size(): i32 {
    return this.urls.length;
  }

  get(item: i32): Fastly.FufilledRequest | null {
    let url: string = this.urls[item as i32];

    this.logger.debug("getting url from pool: " + url);
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
    return this.get(item);
  }


}