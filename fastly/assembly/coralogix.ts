import { JSONEncoder } from "assemblyscript-json";
import  { Date } from "as-wasi";
import  { Request, Fastly } from "@fastly/as-compute";

export class CoralogixLogger {
  private subsystemName: string;
  private start: f64;
  private req: Request;
  private logger: Fastly.LogEndpoint;

  constructor(app: string, req: Request) {
    this.subsystemName = app;
    this.start = Date.now();
    this.req = req;
    this.logger = Fastly.getLogEndpoint("Coralogix");

    this.debug("logger initialized");
  }

  public format(level: u8, message: string): string {
    let encoder = new JSONEncoder();
    let now = Date.now();

    encoder.pushObject("");
      encoder.setInteger("timestamp", Math.floor(now));
      encoder.setString("applicationName", "fastly-edgecompute");
      encoder.setString("subsystemName", this.subsystemName);
      encoder.setInteger("severity", level);
      encoder.pushObject("json");
        encoder.setString("message", message);

        // json.cdn
        encoder.pushObject("cdn");
          encoder.setString("url", this.req.url());

          // json.cdn.time
          encoder.pushObject("time");
            encoder.setInteger("start_msec", Math.floor(this.start));
            encoder.setInteger("elapsed", now - Math.floor(this.start));
          encoder.popObject();

          // json.cdn.request
          encoder.pushObject("request");
            encoder.setString("method", this.req.method());
            if (this.req.headers().has("User-Agent")) {
              encoder.setString("user_agent", this.req.headers().get("User-Agent") as string);
            }
          encoder.popObject();

        encoder.popObject();

      encoder.popObject();
    encoder.popObject();

    return encoder.toString();
  }

  public debug(message: string): void {
    this.logger.log(this.format(1, message));
  }

  public log(message: string): void {
    this.logger.log(this.format(2, message));
  }

  public info(message: string): void {
    this.logger.log(this.format(3, message));
  }

  public warn(message: string): void {
    this.logger.log(this.format(4, message));
  }

  public error(message: string): void {
    this.logger.log(this.format(5, message));
  }

}