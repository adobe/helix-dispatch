import { Fastly } from "@fastly/as-compute";
import { Request, Headers } from "@fastly/as-fetch";
import { CoralogixLogger } from "./coralogix";
import { Pool } from "./pool";

export class SequencePool implements Pool {
  private fufilled: Map<string, Fastly.FufilledRequest>;
  private logger: CoralogixLogger;
  private urls: string[];
  private backend: string;
  private headers: Headers;

  constructor(urls: string[], headers: Headers, backend: string, logger: CoralogixLogger) {
    this.logger = logger;
    logger.debug("creating sequence list");
    this.fufilled = new Map<string, Fastly.FufilledRequest>();
    this.urls = urls;
    this.backend = backend;
    this.headers = headers;
  }

  get size(): i32 {
    return this.urls.length;
  }

  get(item: i32): Fastly.FufilledRequest | null {
    let url: string = this.urls[item as i32];

    if (this.fufilled.has(url)) {
      return this.fufilled.get(url);
    }

    this.logger.debug("building request[" + item.toString() + "]: " + url);
    const req = new Request(url, {
      headers: this.headers
    });
    this.logger.debug("fetching[" + item.toString() + "]: " + url);
    const response = Fastly.fetch(req, {
      backend: this.backend
    }).wait();
    this.logger.debug("storing[" + item.toString() + "]: " + url);

    const fufilled = new Fastly.FufilledRequest(req, this.backend, response);
    this.fufilled.set(url, fufilled);

    this.logger.debug("returning[" + item.toString() + "]: " + url);

    return fufilled;
  }


}