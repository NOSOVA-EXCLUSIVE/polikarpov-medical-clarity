# Approved Public Snapshot

Дата фиксации: `2026-04-11`

Это локальный snapshot утверждённого публичного контура сайта.

## Что зафиксировано

- Главная страница
- Страница врача
- Страница форматов помощи
- Public shell
- Header / Footer
- Нужные глобальные стили для approved-вида

## Файлы восстановления

- `src/app/(public)/page.tsx`
- `src/app/(public)/doctor/page.tsx`
- `src/app/(public)/services/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/components/public/shell.tsx`
- `src/app/globals.css`
- `src/app/inline-global-styles.ts`

## Папка snapshot

`project-docs/approved-snapshots/public-approved-2026-04-11/`

Внутри лежат копии файлов в той же структуре путей.

## Как восстанавливать

Если public pages сломались:

1. Взять файлы из этой папки snapshot.
2. Вернуть их поверх рабочих файлов проекта.
3. Ничего не redesign-ить и не reinterpret-ить.
4. Не трогать questionnaire, booking, admin, portal.

## Что считается source of truth

Source of truth для approved public version:

- композиция главной
- approved hero главной
- approved doctor page
- approved services grid
- approved footer/header
- approved calm premium medical tone

## Важная оговорка

Если когда-либо будет утверждена новая версия public pages, нужно создать новый snapshot в отдельной папке с новой датой, а этот оставить как архив approved-state.
