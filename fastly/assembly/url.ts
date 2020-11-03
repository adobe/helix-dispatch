export class URL {
  protected url: string | null;

  constructor(url:string) {
    this.url = url;
  }

  static decode(encoded:string): string {
    if (encoded.indexOf('%') > 0 && encoded.indexOf('%') + 2 < encoded.length) {
      const before = encoded.substr(0, encoded.indexOf('%'));
      const code = encoded.substr(encoded.indexOf('%') + 1, 2);
      const after = encoded.substr(encoded.indexOf('%') + 3);

      return before + String.fromCharCode(Number.parseInt(code, 16)) + URL.decode(after);
    }
    return encoded;
  }

  querystring():string {
    if (this.url != null && this.url.indexOf("?") > 0) {
      return this.url.substring(this.url.indexOf("?") + 1);
    }
    return "";
  }

  queryparam(param: string, defaultValue: string): string {
    const pairs = this.querystring().split("&");
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].indexOf(param + "=")==0) {
        return URL.decode(pairs[i].substr(param.length + 1));
      }
    }
    return defaultValue;
  }
}