import { Fastly } from "@fastly/as-compute";
import { Request, Headers } from "@fastly/as-fetch";
import { CoralogixLogger } from "./coralogix";
import { Pool } from "./pool";

export class SequencePool implements Pool {
  private pool: Fastly.FetchPool;
  private fufilled: Map<string, Fastly.FufilledRequest>;
  private logger: CoralogixLogger;
  private urls: string[];
  private backend: string;

  constructor(urls: string[], headers: Headers, backend: string, logger: CoralogixLogger) {
    this.logger = logger;
    logger.debug("creating sequence list");
    this.fufilled = new Map<string, Fastly.FufilledRequest>();
    this.urls = urls;
    this.backend = backend;

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

    if (this.fufilled.has(url)) {
      return this.fufilled.get(url);
    }

    this.logger.debug("building request: " + url);
    const req = new Request(urls[i], {
      headers: headers
    });
    this.logger.debug("fetching: " + url);
    const response = Fastly.fetch(req, {
      backend: this.backend
    }).wait();
    this.logger.debug("storing: " + url);

    const fufilled = new Fastly.FufilledRequest(req, this.backend, response);
    this.fufilled.set(url, fufilled);

    return fufilled;
  }


}