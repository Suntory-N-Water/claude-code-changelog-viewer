declare module '@pagefind/default-ui' {
  export class PagefindUI {
    constructor(options: {
      element: string | HTMLElement;
      bundlePath?: string;
      showImages?: boolean;
      resetStyles?: boolean;
      highlightParam?: string;
      ranking?: {
        termSimilarity?: number;
        pageLength?: number;
        termFrequency?: number;
        termSaturation?: number;
      };
    });
  }
}
