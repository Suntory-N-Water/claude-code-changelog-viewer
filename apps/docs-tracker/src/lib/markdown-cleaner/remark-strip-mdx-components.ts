import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

// 削除対象のタグ名(子要素ごと削除)
const REMOVE_TAGS = new Set(['img', 'style']);

export function remarkStripMdxComponents() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined) {
        return;
      }

      // import/export 文を削除
      if (node.type === 'mdxjsEsm') {
        parent.children.splice(index, 1);
        return index;
      }

      // JSX 式(コメント、空白式等)を削除
      if (
        node.type === 'mdxFlowExpression' ||
        node.type === 'mdxTextExpression'
      ) {
        parent.children.splice(index, 1);
        return index;
      }

      // JSX 要素の処理
      if (
        node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement'
      ) {
        const tagName = (node as { name?: string | null }).name;

        // img, style は完全削除
        if (tagName && REMOVE_TAGS.has(tagName)) {
          parent.children.splice(index, 1);
          return index;
        }

        // 子なし自己閉じ要素は削除
        if (!node.children || node.children.length === 0) {
          parent.children.splice(index, 1);
          return index;
        }

        // その他は unwrap(子要素を昇格)
        parent.children.splice(
          index,
          1,
          ...(node.children as (typeof parent.children)[number][]),
        );
        return index;
      }

      return;
    });
  };
}
