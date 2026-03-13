---
status: diagnosed
trigger: "Phase 02 UAT: IndexedDB v2 migration empty stores + service worker not responding"
created: 2026-03-13T07:00:00Z
updated: 2026-03-13T07:00:00Z
---

## Current Focus

hypothesis: Both UAT failures are caused by incorrect test commands, not code bugs
test: Analyzed code logic, UMD loading, manifest config, and Chrome extension messaging semantics
expecting: Code is correct; UAT test procedures contain errors
next_action: Return diagnosis

## Symptoms

expected: IndexedDB v2 has submissions/cards/reviewLogs stores; GET_DUE_TODAY returns response
actual: Empty objectStoreNames array; "Receiving end does not exist" error
errors: "Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist."
reproduction: UAT tests 1 and 2 as described in 02-UAT.md
started: First UAT run of phase 02

## Eliminated

- hypothesis: "importScripts fails because ts-fsrs.umd.js missing"
  evidence: File exists at extension/lib/ts-fsrs.umd.js (73405 bytes)
  timestamp: 2026-03-13T07:00:00Z

- hypothesis: "UMD global binding fails in service worker (this === undefined)"
  evidence: UMD wrapper falls through to globalThis path which is valid in service workers; FSRS gets set on globalThis
  timestamp: 2026-03-13T07:00:00Z

- hypothesis: "manifest.json misconfigured for service worker"
  evidence: "background.service_worker" is "background.js", no "type":"module" (so importScripts works)
  timestamp: 2026-03-13T07:00:00Z

- hypothesis: "Service worker crashes on startup"
  evidence: No syntax errors in background.js; importScripts path valid; UMD loads onto globalThis; all destructured names (createEmptyCard, fsrs, Rating, State) are exported by ts-fsrs
  timestamp: 2026-03-13T07:00:00Z

## Evidence

- timestamp: 2026-03-13T07:00:00Z
  checked: Database name in code vs UAT test
  found: Code uses indexedDB.open('leetreminder', 2) (all lowercase). UAT test uses indexedDB.open('leetReminder', 2) (camelCase capital R).
  implication: These are two different IndexedDB databases. The UAT test opens/creates a brand new empty database named 'leetReminder', which has no stores. The actual extension database 'leetreminder' (lowercase) likely has all stores correctly.

- timestamp: 2026-03-13T07:00:00Z
  checked: chrome.runtime.sendMessage semantics when called FROM the service worker console
  found: chrome.runtime.sendMessage sends a message to OTHER extension contexts (popup, content scripts, other pages). The service worker's own onMessage listener does NOT receive messages sent by the service worker itself. Running sendMessage from the SW devtools console is sending a message that no one is listening for (no popup open, no content script matching).
  implication: "Receiving end does not exist" is the expected behavior when calling sendMessage from the SW console with no other extension contexts open. The test command must be run from a content script context or popup, not the SW console.

- timestamp: 2026-03-13T07:00:00Z
  checked: background.js syntax and logic
  found: No syntax errors, valid importScripts call, correct UMD destructuring, proper onupgradeneeded handler with version migration logic, correct message handler patterns with async sendResponse
  implication: The code itself appears correct

## Resolution

root_cause: |
  ISSUE 1 (IndexedDB empty stores): Database name mismatch in UAT test procedure.
  Code opens 'leetreminder' (all lowercase, line 94 of background.js).
  UAT test opens 'leetReminder' (camelCase). IndexedDB names are case-sensitive.
  The test inadvertently creates a brand new empty database.

  ISSUE 2 (Receiving end does not exist): Wrong execution context for test command.
  chrome.runtime.sendMessage() sends to OTHER extension contexts, not to self.
  Running it from the service worker console sends a message that no listener in
  ANY other context is listening for (no popup, no matching content script page).
  The service worker's own onMessage handler never sees messages from itself.

fix: N/A (diagnosis only)
verification: N/A
files_changed: []
