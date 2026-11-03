/** CSS の line-clamp は隠した行も描画範囲に残り、下の要素と重なって判定されるため、表示前に文字数で切り詰める */
export function truncateText(text: string, maxLength: number): string {
  // 要約はコード片をバッククォートで含むため、記号ごと残すと途中で切ったときに閉じない
  const plain = text.replaceAll('`', '');
  const chars = [...plain];
  if (chars.length <= maxLength) {
    return plain;
  }
  const head = chars.slice(0, maxLength).join('');
  const clauseEnd = Math.max(head.lastIndexOf('。'), head.lastIndexOf('、'));
  // 句読点が先頭寄りにしかないと文が短くなりすぎるため、半分を超える位置にあるときだけ句読点で切る
  return clauseEnd > maxLength / 2 ? `${head.slice(0, clauseEnd)}…` : `${head.trimEnd()}…`;
}
