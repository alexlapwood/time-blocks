# Agent Workflow Guide

This document guides AI agents contributing to this project.

## Project Structure

- `src/` - Source code (SolidJS + Tailwind)
- `agent.md` - This file

## Workflow

1. **Find a Task**: Check the `TODO.md` (if exists) or ask the user for the next task.
2. **Test-Driven Development (TDD)**:
   - Create or update a test file in `src/` or `tests/`.
   - Run tests to confirm failure: `npm test`.
   - Implement the feature.
   - Run tests to confirm success.
3. **Build Verification**:
   - Run `npm run build` to verify there are no TypeScript errors.
4. **Record Learnings**:
   - If you make a mistake and I have to correct you, figure out why and how to avoid it in the future.
   - Add the learning to the `agent.md` file.
5. **Screen Capture**:
   - If you take a screenshot of the UI and you need to store it use the `.screenshots` directory

## Commands

- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run build` - Build for production

## Style Guide

- Use functional components.
- Use Tailwind classes for styling.
- Prefer small, focused components.

## Theme Extension Guide

Theme-specific component classes are centralized under `src/themes/` using one file per theme (for example `playful.theme.ts`, `cute.theme.ts`, etc.), plus a shared resolver in `src/themes/index.ts`.

### Add Theme Classes for a New Component

1. **Add typed slots in `src/themes/types.ts`**
2. **Add classes in every theme file in `src/themes/`**
3. **Expose the merged slot in `src/themes/index.ts`**
4. **Consume in the component**
   - Import `componentThemeClasses` and append the slot string to the component class list.
   - Example:
     - `componentThemeClasses.calendar.toolbarButton`
5. **Verify**
   - Run relevant tests and `npm run build`.
   - Ensure visual parity for each theme in the UI.
