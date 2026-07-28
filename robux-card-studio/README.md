# Robux Card Studio

MVP для оцифровки товарных карточек: анализ → маски → clean background → шаблон → серия номиналов без повторного AI.

## Запуск

```bash
cd robux-card-studio
cp .env.example .env.local
# Вставьте OPENAI_API_KEY в .env.local (только server-side)
# CARD_STUDIO_AI_MODE=mock — без платных вызовов
# CARD_STUDIO_AI_MODE=real — реальный OpenAI

npm install
npx prisma migrate dev
npm run dev
```

Откройте http://localhost:3000/catalog

## Структура страниц

| Маршрут | Назначение |
|---------|------------|
| `/catalog` | Импорт catalog.json, поиск, статусы |
| `/digitize/[sku]` | Пошаговая оцифровка |
| `/templates` | Сохранённые шаблоны |
| `/cards` | Готовые WebP draft |

## Каталог

Положите `data/catalog.json` и нажмите **Импортировать catalog.json**.

Тестовые SKU: `RM063`, `RM011`, `RM030`.

## Env

Только в `.env.local` (не коммитится):

```
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
CARD_STUDIO_AI_MODE=real
CARD_STUDIO_MAX_AI_REQUESTS_PER_SESSION=20
DATABASE_URL="file:./data/card-studio.db"
```

## Локальные директории

`data/ uploads/ originals/ masks/ cleaned/ frames/ templates/ results/ exports/`

Медиа отдаётся через `/api/media/...`.

## Безопасность

- OpenAI key только server-side
- Secure image fetch: HTTPS only, no localhost/private IP/metadata, size/MIME/Sharp checks
- Нет автопубликации, production DB/каталог не трогаются
- Перед платными AI-вызовами UI показывает подтверждение

## Ограничения MVP

- Градиент → editable опционален и не обязателен
- Автоопределение «идеального» шрифта не делается — 3 кандидата
- Mock-режим эмулирует inpaint blur вместо реального image edit
- Не Photoshop: фон/персонажи не раскладываются на десятки слоёв
