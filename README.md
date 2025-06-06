<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# AutoMagistre CRM

CRM система для управления автосервисами на базе NestJS.

## Описание

Система позволяет управлять:
- Клиентами и их автомобилями
- Заказами на ремонт
- Складским учетом запчастей
- Персоналом и их задачами
- Финансовой отчетностью

## Структура проекта

- `src/` - исходный код приложения
  - `common/` - общие компоненты и утилиты
  - `config/` - конфигурация приложения
  - `entities/` - модели данных
  - `middlewares/` - промежуточное ПО
  - `pipes/` - пайпы для валидации
  - `prisma/` - конфигурация и миграции базы данных
  - `utils/` - вспомогательные функции
  - `schema.gql` - GraphQL схема
  - `app.module.ts` - корневой модуль приложения
  - `main.ts` - точка входа

## Установка

```bash
# Установка зависимостей
$ npm install

# Настройка переменных окружения
$ cp .env.example .env
```

## Запуск приложения

```bash
# Разработка
$ npm run start

# Режим разработки с автоперезагрузкой
$ npm run start:dev

# Продакшн
$ npm run start:prod
```

## Тестирование

```bash
# Модульные тесты
$ npm run test

# E2E тесты
$ npm run test:e2e

# Покрытие тестами
$ npm run test:cov
```

## Документация API

После запуска приложения документация доступна по адресу:
- GraphQL Playground: http://localhost:3000/graphql

## Автор

- Kirill Sidorov - kirillsidorov@gmail.com

## Лицензия

MIT

