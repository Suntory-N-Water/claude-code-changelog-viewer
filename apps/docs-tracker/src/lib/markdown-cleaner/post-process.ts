// 3行以上の連続空行を2行に正規化
export function postProcess(input: string): string {
  return input.replace(/\n{3,}/g, '\n\n');
}
