# Prisma Migrations Workflow

## Локальная разработка (автогенерация миграций)

1. Измените `prisma/schema.prisma`.
2. Создайте миграцию автоматически:

```bash
npm run prisma:migrate:create -- --name <short_change_name>
```

3. Проверьте SQL в новой папке `prisma/migrations/<timestamp>_<name>/migration.sql`.
4. Примените локально:

```bash
npm run prisma:migrate:dev
```

5. Обновите Prisma Client:

```bash
npm run prisma:generate
```

## Продакшен

Применять только через deploy:

```bash
npm run prisma:migrate:deploy
```

Проверка статуса:

```bash
npm run prisma:migrate:status
```

## Важно

- Не редактировать уже примененные миграции.
- Новые исправления делать только следующей миграцией.
- Для пустой БД `migrate deploy` применит цепочку миграций с нуля.
