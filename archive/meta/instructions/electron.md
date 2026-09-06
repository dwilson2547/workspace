# Electron Project Agent Instructions

Purpose: prevent agents from declaring Electron projects complete when only backend and frontend are working in isolation.

## Core Rule

An Electron task is not done until Electron main, preload, renderer, and backend integration are all tested together in a real Electron run.

## Non-Negotiable Workflow

Follow these phases in order. Do not skip phases.

### Phase 1: Project Wiring Audit (before coding)

Verify and report all of the following:

1. Build orchestration
	- Check package scripts for dev, build, start/preview.
	- Confirm Electron actually launches from those scripts.

2. Electron Vite config
	- Validate electron.vite.config.ts inputs are not starter placeholders.
	- Confirm main, preload, and renderer entry points match project structure.

3. Electron main process
	- Confirm BrowserWindow loads renderer URL in dev and file in production/preview.
	- Confirm webPreferences settings are intentional (contextIsolation, sandbox, preload).

4. Preload bridge
	- Confirm required APIs are exposed via preload and consumed in renderer.
	- Verify no renderer dependency on direct Node APIs when sandboxed.

5. Backend process strategy
	- Confirm how backend is started in dev and packaged modes.
	- Confirm renderer API base URL points at the actual backend endpoint.

If any item is missing, fix wiring before implementing feature logic.

### Phase 2: Vertical Slice First

Before broad feature work, implement and verify one end-to-end slice:

- Renderer action triggers preload/electron/backend path.
- Backend responds.
- UI updates in Electron window.

Use this slice to prove integration is alive.

### Phase 3: Incremental Development with Integration Checks

After each meaningful feature change, run an integration checkpoint in Electron (not browser-only):

- Start app with the project Electron dev command.
- Trigger the changed flow in the Electron window.
- Check Electron DevTools console for CSP/CORS/IPC/runtime errors.
- Check terminal logs for main/preload/backend errors.
- Fix integration issues immediately before continuing.

Do not batch many unverified changes.

## Required Integration Test Matrix

Agents must validate all rows relevant to the task:

1. Renderer to backend HTTP
	- API calls succeed from Electron-rendered UI.
	- No CSP or CORS failures.

2. Renderer WebSocket/Event streams (if used)
	- WS connects and receives messages.
	- CSP connect-src permits ws/wss endpoints.

3. Renderer to preload to main IPC
	- Exposed preload APIs execute successfully.
	- Error paths are handled and surfaced.

4. Dev and production-like path
	- Validate in dev.
	- Validate at least one production-like run path (preview/build artifact) when task touches config, CSP, startup, or routing.

5. Startup lifecycle
	- App startup succeeds.
	- Backend startup timing/health handled (no silent race/fail).

## CSP and Security Guardrails

When network features are involved:

1. Confirm effective CSP source(s):
	- Meta CSP in renderer HTML.
	- Response-header CSP from Electron session/webRequest handlers.
	- Treat multiple CSP policies as cumulative.

2. Validate directives explicitly:
	- connect-src includes required http/https/ws/wss origins.
	- script-src policy matches dev/prod runtime requirements.

3. Prefer environment-aware policies:
	- Dev may allow what tooling requires.
	- Production remains as strict as possible.

## Definition of Done (Hard Gate)

Do not report completion until all are true:

1. Electron process launches and renderer loads.
2. Changed feature works inside Electron window.
3. No blocking console errors in Electron DevTools for changed flow.
4. No blocking main/preload/backend runtime errors.
5. Electron-specific config touched and validated when relevant:
	- electron.vite.config.ts
	- electron/main/*
	- electron/preload/*
	- renderer HTML CSP and runtime URL wiring
6. Final report includes explicit evidence of integration checks performed.

## Required Final Report Format

Every agent completion message must include:

1. What changed
	- Files changed and why.

2. Integration checks run
	- Exact commands run.
	- Exact Electron flow exercised.

3. Results
	- Pass/fail per integration matrix item touched.

4. Remaining risks
	- Any unverified areas and why they were not tested.

## Anti-Patterns (Forbidden)

1. Declaring done after only API unit checks.
2. Declaring done after browser-only renderer verification.
3. Leaving starter Electron config untouched when project structure changed.
4. Assuming CSP/CORS is correct without runtime validation in Electron.
5. Deferring Electron integration to later without explicit user approval.

## Quick Execution Checklist

Use this list every session:

- Audit wiring (main/preload/renderer/backend).
- Confirm Electron Vite entries are real, not starter defaults.
- Build one vertical slice and run it in Electron.
- Iterate feature plus Electron integration check.
- Validate CSP/CORS/IPC/runtime logs.
- Run production-like validation when config/security/startup changed.
- Report with evidence.
