# Coding Rules

This document defines coding standards for Ingenya Quote Manager.

## Language

Use English for:

- File names
- Folder names
- Variables
- Functions
- Types
- Interfaces
- Constants
- Commit messages
- Pull request titles

Use Spanish only for user-facing UI text.

## TypeScript Rules

- Prefer explicit domain types for business concepts.
- Use union types when a value has a limited set of valid options.
- Keep shared interfaces in `src/types`.
- Avoid `any` unless there is a strong reason and it is explained in code review.
- Prefer derived values over duplicated state.

## React Rules

- Keep React components focused on presentation and interaction.
- Keep business calculations outside React components.
- Do not put deterministic domain logic directly inside JSX.
- Use pure helper functions for reusable calculations.
- Avoid large components when smaller components would be clearer.

## Data Rules

- Demo or seed data should live in `src/data`.
- Business calculations should live in `src/utils` or a more specific domain folder if the project grows.
- Domain types should live in `src/types`.

## Dependency Rules

Before adding a dependency, explain:

- What problem it solves.
- Why the project needs it now.
- Why existing code or standard APIs are not enough.

Do not add libraries only for small utilities that can be implemented clearly in the project.

## Formatting And Linting

The project uses:

- Prettier for formatting.
- ESLint for code quality.
- TypeScript for static validation.

Required local checks:

```bash
npm run format:check
npm run lint
npm test
npm run build
```
