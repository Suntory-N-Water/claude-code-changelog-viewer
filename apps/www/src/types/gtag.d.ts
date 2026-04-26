// biome-ignore lint/style/useConsistentTypeDefinitions: Window拡張にはinterfaceによるdeclaration mergingが必要
interface Window {
  gtag: (
    command: string,
    action: string,
    params?: Record<string, unknown>,
  ) => void;
}
