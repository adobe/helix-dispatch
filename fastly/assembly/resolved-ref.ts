import { JSON } from "assemblyscript-json";

export class ResolvedRef {
  protected json: JSON.Obj;

  constructor(json: string) {
    this.json = <JSON.Obj>JSON.parse(json);
  }

  get fqRef(): string {
    if (this.json.get("fqRef")==null) {
      return "";
    }
    return (this.json.get("fqRef") as JSON.Str)._str;
  }

  get sha(): string {
    if (this.json.get("sha")==null) {
      return "";
    }
    return (this.json.get("sha") as JSON.Str)._str;
  }

  get ref(): string {
    return this.fqRef.split("/").pop();
  }
}