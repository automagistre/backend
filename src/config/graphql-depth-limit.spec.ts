import { buildSchema, parse, validate } from 'graphql';
import { depthLimit } from './graphql-depth-limit';

const schema = buildSchema(`
  type Node { id: ID!, child: Node }
  type Query { node: Node }
`);

function errors(query: string, max: number) {
  return validate(schema, parse(query), [depthLimit(max)]);
}

describe('depthLimit', () => {
  it('пропускает запрос в пределах лимита', () => {
    expect(errors('{ node { child { id } } }', 3)).toHaveLength(0);
  });

  it('отклоняет слишком глубокий запрос', () => {
    expect(errors('{ node { child { child { id } } } }', 3)).toHaveLength(1);
  });

  it('разворачивает фрагменты', () => {
    const query = `
      fragment Deep on Node { child { child { id } } }
      { node { ...Deep } }
    `;
    expect(errors(query, 3)).toHaveLength(1);
  });

  it('не считает поля introspection', () => {
    const query =
      '{ __schema { types { fields { type { ofType { ofType { name } } } } } } }';
    expect(errors(query, 2)).toHaveLength(0);
  });
});
