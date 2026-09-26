import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type SelectionSetNode,
  type ValidationContext,
} from 'graphql';

/**
 * Запрещает операции глубже `maxDepth` (защита от вложенных запросов,
 * кладущих БД). Фрагменты разворачиваются, поля introspection (`__*`)
 * не считаются.
 */
export function depthLimit(maxDepth: number) {
  return (context: ValidationContext): ASTVisitor => {
    const measure = (
      selectionSet: SelectionSetNode,
      visited: Set<string>,
    ): number => {
      let max = 0;
      for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
          if (selection.name.value.startsWith('__')) continue;
          const nested = selection.selectionSet
            ? 1 + measure(selection.selectionSet, visited)
            : 1;
          max = Math.max(max, nested);
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          max = Math.max(max, measure(selection.selectionSet, visited));
        } else {
          const name = selection.name.value;
          const fragment = context.getFragment(name);
          if (!fragment || visited.has(name)) continue;
          max = Math.max(
            max,
            measure(fragment.selectionSet, new Set(visited).add(name)),
          );
        }
      }
      return max;
    };

    return {
      OperationDefinition(node) {
        const depth = measure(node.selectionSet, new Set());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `Глубина запроса ${depth} превышает допустимую ${maxDepth}`,
              { nodes: [node] },
            ),
          );
        }
      },
    };
  };
}
