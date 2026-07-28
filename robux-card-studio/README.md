# Robux Card Studio

MVP для оцифровки товарных карточек: анализ → маски → clean background → шаблон → серия номиналов без повторного AI.

## Локальный запуск (рекомендуется)

Нужны: Node 20+, npm, ваша Postgres `robux_market_admin` на порту **5440**.

```bash
# 1) Клонировать репозиторий и ветку
git clone https://github.com/iiphonesss/streamprocweb.git
cd streamprocweb
git checkout cursor/robux-card-studio-mvp-bce0
cd robux-card-studio

# 2) Env
cp .env.example .env.local
```

В `.env.local` укажите:

```env
DATABASE_URL="file:./data/card-studio.db"
MARKET_DATABASE_URL=postgresql://postgres:postgres@localhost:5440/robux_market_admin
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
CARD_STUDIO_AI_MODE=mock
CARD_STUDIO_MAX_AI_REQUESTS_PER_SESSION=20
```

`CARD_STUDIO_AI_MODE=real` — только когда вставите настоящий `OPENAI_API_KEY`.

```bash
# 3) Убедитесь, что Postgres слушает 5440
# 4) Установка и запуск
npm install
npx prisma migrate dev
npm run dev
```

Откройте: **http://localhost:3000/catalog**

Нажмите **«Загрузить из market DB»** — карточки подтянутся **только на чтение** из вашей БД в локальный SQLite Card Studio. Market DB не изменяется.

Дальше: товар → **Оцифровать карточку** → шаги масок / clean BG / шаблон / номиналы.

## Структура страниц

| Маршрут | Назначение |
|---------|------------|
| `/catalog` | Импорт JSON или sync из market DB |
| `/digitize/[sku]` | Пошаговая оцифровка |
| `/templates` | Сохранённые шаблоны |
| `/cards` | Готовые WebP draft |

## Каталог без market DB

Кнопка **Импортировать catalog.json** (тестовые RM063 / RM011 / RM030).

## Env

Только в `.env.local` (не коммитится):

```
DATABASE_URL="file:./data/card-studio.db"
MARKET_DATABASE_URL=postgresql://postgres:postgres@localhost:5440/robux_market_admin
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2
CARD_STUDIO_AI_MODE=mock
CARD_STUDIO_MAX_AI_REQUESTS_PER_SESSION=20
```

Опционально свой SELECT (только SELECT):

```
MARKET_PRODUCTS_SQL=SELECT sku, name, ... FROM "Product" LIMIT 5000
```

## Локальные директории

`data/ uploads/ originals/ masks/ cleaned/ frames/ templates/ results/ exports/`

Медиа: `/api/media/...`

## Безопасность

- OpenAI key только server-side
- Market DB: только SELECT → запись в локальный SQLite
- Нет автопубликации; Robux Market Admin не меняем

## Ограничения MVP

- Mock AI = эвристики + blur, не настоящий image edit
- Градиент как editable слой — опционально, не обязателен
- Не Photoshop: фон/персонажи не дробятся на десятки слоёв

## Cloud Agent

В облаке `localhost:5440` — это не ваш ПК. Для работы с вашей БД используйте **локальный** запуск выше.
