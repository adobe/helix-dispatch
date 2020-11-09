import { PathInfo } from "./path-info";
import { URL } from "./url";

export class URLBuilder {
  protected baseURL: string = "https://adobeioruntime.net/api/v1/web/";
  protected namespace: string = "helix";
  protected staticAction: string = "helix-services/static@v1";
  protected redirectAction: string = "helix-services/redirect@v1";
  protected contentOpts: Map<string, string>;
  protected staticOpts: Map<string, string>;
  protected rootPath: string = "";
  protected pack: string = "default";

  constructor(contentOpts: Map<string, string>, staticOpts: Map<string, string>, root: string, pack: string) {
    this.contentOpts = contentOpts;
    this.staticOpts = staticOpts;
    this.rootPath = root;
    this.pack = pack;
  }

  withNamespace(namespace: string): URLBuilder {
    this.namespace = namespace;
    return this;
  }

  build404URLs(infos: PathInfo[]): Set<string> {
    const urls = new Set<string>();

    if (infos.length > 0 && infos[0].extension == "html") {
      urls.add(new URL(this.baseURL)
        .append(this.namespace)
        .append(this.staticAction)
        .appendParam("path", "/404.html")
        .appendParam("esi", "false")
        .appendParam("plain", "true")
        .appendParams(this.contentOpts)
        .toString());
    }

    urls.add(new URL(this.baseURL)
      .append(this.namespace)
      .append(this.staticAction)
      .appendParam("path", "/404.html")
      .appendParam("esi", "false")
      .appendParam("plain", "true")
      .appendParams(this.staticOpts)
      .toString());

    return urls;
  }

  buildFallbackURLs(infos: PathInfo[]): Set<string> {
    const urls = new Set<string>();
    for (let i = 0; i < infos.length; i++) {
      urls.add(new URL(this.baseURL)
        .append(this.namespace)
        .append(this.staticAction)
        .appendParam("path", infos[i].path)
        .appendParam("esi", "false")
        .appendParam("plain", "true")
        .appendParams(this.staticOpts)
        .toString());
    }
    return urls;
  }

  buildActionURLs(infos: PathInfo[]): Set<string> {
    const urls = new Set<string>();
    for (let i = 0; i < infos.length; i++) {
      let actionname = infos[i].extension;
      if (infos[i].selector != "") {
        actionname = infos[i].selector + "_" + infos[i].extension;
      }

      urls.add(new URL(this.baseURL)
        .append(this.namespace)
        .append(this.pack)
        .append(actionname)
        .appendParam("path", infos[i].relativePath + ".md")
        .appendParam("rootPath", this.rootPath)
        .appendParams(this.contentOpts)
        .toString());
    }
    return urls;
  }

  buildRawURLs(infos: PathInfo[]): Set<string> {
    const urls = new Set<string>();
    for (let i = 0; i < infos.length; i++) {
      urls.add(new URL(this.baseURL)
        .append(this.namespace)
        .append(this.staticAction)
        .appendParam("path", infos[i].path)
        .appendParam("esi", "false")
        .appendParam("plain", "true")
        .appendParam("root", this.rootPath)
        .appendParams(this.contentOpts)
        .toString());
    }
    return urls;
  }

  buildRedirectURLs(path: string): Set<string> {
    const urls = new Set<string>();
    urls.add(new URL(this.baseURL)
      .append(this.namespace)
      .append(this.redirectAction)
      .appendParam("path", path)
      .appendParams(this.contentOpts)
      .toString());
    return urls;
  }
}