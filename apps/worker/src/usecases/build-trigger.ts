/** サイトのビルド起動を抽象化する port。 */
export type BuildTriggerPort = {
  trigger(): Promise<void>;
};
