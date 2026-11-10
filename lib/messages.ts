/** Popup → worker: convert this page and save the file. */
export interface ClipRequest {
  tabId: number;
  pageUrl: string;
  filename: string;
  text: string;
  /** Set when the local extractors found the recipe. */
  extracted?: { name: string; metadata: string };
}

export type Message =
  | { type: "clip"; request: ClipRequest }
  | { type: "download"; cooklang: string; filename: string }
  /** Is a clip for this tab still running in the worker? Answered with a boolean. */
  | { type: "status"; tabId: number };
