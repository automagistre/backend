import { registerEnumType } from '@nestjs/graphql';

export enum NoteType {
  SUCCESS = 1,
  INFO = 2,
  WARNING = 3,
  DANGER = 4,
}

registerEnumType(NoteType, {
  name: 'NoteType',
  description: 'Тип заметки',
  valuesMap: {
    SUCCESS: { description: 'Успех' },
    INFO: { description: 'Информация' },
    WARNING: { description: 'Предупреждение' },
    DANGER: { description: 'Опасность' },
  },
});
