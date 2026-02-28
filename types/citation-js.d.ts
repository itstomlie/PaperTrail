declare module "@citation-js/core" {
  export class Cite {
    constructor(data: string | object);
    format(type: string, options?: Record<string, unknown>): string;
  }
}

declare module "@citation-js/plugin-bibtex" {}
declare module "@citation-js/plugin-csl" {}
