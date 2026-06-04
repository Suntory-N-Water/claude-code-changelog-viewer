export type InferenceResult = {
  readonly before: string;
  readonly after: string;
  readonly benefit: string;
};

/**
 * 利用者メリット推論の3要素が説明として成立する長さか検証する。
 */
export function createInferenceResult(input: InferenceResult): InferenceResult {
  assertMeaningfulText(input.before, 'before');
  assertMeaningfulText(input.after, 'after');
  assertMeaningfulText(input.benefit, 'benefit');

  return input;
}

function assertMeaningfulText(value: string, fieldName: string): void {
  if (value.trim().length < 10) {
    throw new Error(`推論結果の ${fieldName} が短すぎます`);
  }
}
