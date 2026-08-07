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

      if (node.type === 'mdxjsEsm') {
        parent.children.splice(index, 1);
        return index;
      }

      if (
        node.type === 'mdxFlowExpression' ||
        node.type === 'mdxTextExpression'
      ) {
        parent.children.splice(index, 1);
        return index;
      }

      if (
        node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement'
      ) {
        const tagName = (node as { name?: string | null }).name;

        if (tagName && REMOVE_TAGS.has(tagName)) {
          parent.children.splice(index, 1);
          return index;
        }

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
