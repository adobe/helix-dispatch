export class URL {
  protected url: string;
  protected scheme: string;
  protected host: string;
  protected path: string;
  protected qs: string;

  constructor(url:string) {
    const schemepairs = url.split("://");
    this.scheme = schemepairs[0];

    const fragments = schemepairs.pop().split("/");
    this.host = fragments.shift();
    this.url = "/" + fragments.join("/");
    this.path = this.url;

    if (this.url != null && this.url.indexOf("?") > 0) {
      this.qs = this.url.substring(this.url.indexOf("?") + 1);
      this.path = this.url.substring(0, this.url.indexOf("?"));
    } else {
      this.qs = "";
    }
  }

  static decode(encoded:string): string {
    if (encoded.indexOf('%') > 0 && encoded.indexOf('%') + 2 < encoded.length) {
      const before = encoded.substr(0, encoded.indexOf('%'));
      const code = encoded.substr(encoded.indexOf('%') + 1, 2);
      const after = encoded.substr(encoded.indexOf('%') + 3);

      return before + String.fromCharCode(I32.parseInt(code, 16)) + URL.decode(after);
    }
    return encoded;
  }

  static encode(decoded: string): string {
    let encoded = "";
    for (let i = 0; decoded.charCodeAt(i) > -1; i++) {
      const charcode = decoded.charCodeAt(i);
      const character = decoded.charAt(i);
      const pencoded = "%" + charcode.toString(16);
      
      if ((charcode >= 45 && charcode <= 46) || // -.
          (charcode >= 48 && charcode <= 57) || // numbers
          (charcode >= 65 && charcode <= 90) || // uppercase
          (charcode >= 97 && charcode <= 122)   // lowercase
      ) {
        encoded += character;
      } else {
        encoded += pencoded;
      }
      
    }
    return encoded;
  }

  get querystring(): string {
    return this.qs;
  }

  queryparam(param: string, defaultValue: string): string {
    const pairs = this.querystring.split("&");
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].indexOf(param + "=")==0) {
        return URL.decode(pairs[i].substr(param.length + 1));
      }
    }
    return defaultValue;
  }

  append(fragment: string): URL {
    let cleanpath = this.path;
    let cleanfragment = fragment;
    if (this.path.endsWith("/")) {
      cleanpath = this.path.substring(0, this.path.length - 1);
    }
    if (cleanfragment.startsWith("/")) {
      cleanfragment = cleanfragment.substring(1);
    }

    this.path = cleanpath + "/" + cleanfragment;

    if (this.qs != "") {
      this.url = this.path;
    } else {
      this.url = this.path + this.qs;
    }
    return this;
  }

  appendParam(key: string, value: string): URL {
    this.qs = this.qs + "&" + key + "=" + URL.encode(value);

    this.url = this.path + "?" + this.qs;

    return this;
  }

  toString(): string {
    return this.scheme + "://" + this.host + this.url;
  }
}