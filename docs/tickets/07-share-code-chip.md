# T7 - SHARE copies a code

**Status:** complete
**Started:** 2026-10-06 21:20 IST
**Completed:** 2026-10-06 21:20 IST
**Ticket:** `.scratch/voxaction/issues/07-share-code-chip.md` - GitHub #7

## What was built

Tapping the card puts the reference code on the clipboard, and says so.

- **`src/core/share.ts`** - `isValidCode` and the SHARE handler.
- **`CodeChip`** in `src/ui/App.tsx` - the tap, the copy, and the confirmation.
- Registered with one line: `dispatcher.register('SHARE', shareHandler)`.

## The split, which is the interesting part

The handler decides **whether the code is worth copying**. The component performs the copy. The
clipboard belongs to the browser, so keeping it in the handler would mean the pure logic could only
be tested by a browser.

Both halves are therefore tested where they belong: the rule by ordinary unit tests, the tap by a
real click with the clipboard read back.

## The rule

A code must be **3 to 16 characters**, made of **letters, digits and dashes**, and must contain
**at least one digit**.

The digit is the load-bearing part: without it there is nothing to distinguish a code from ordinary
speech, and "the reference is brochure" would put a word on the clipboard. A code that fails the
check is refused visibly, because copying the wrong string is worse than copying nothing.

## Two decisions

- **The handler never alters the code.** The verbatim gate already proved the code was said, so
  normalising the case here would put something on the clipboard that nobody agreed to. The passthrough
  is tested: `kx-4471` comes back as `kx-4471`.
- **A failed copy is visible.** `navigator.clipboard` can refuse, and a silent failure would leave the
  user believing they had the code when they did not. The chip shows `copy failed` in that case.

## Nothing in the contract changed

`ActionEvent` already carried `kind: 'code'` and `SharePayload` already existed. T7 needed no edit to
`src/contract/events.ts`, which is the frozen contract from T1 doing its job.

## Evidence

```
npm test        10 files, 88 tests passed   (8 new)
npx tsc --noEmit   clean
```

In the browser, the scripted call renders:

```
SEND  | brochure | "send me the brochure"     | failed - no handler registered for SEND
SHARE | KX-4471  | "my reference is KX-4471"  | fired | KX-4471 · tap to copy
```

The tap was then performed and the clipboard **read back from the operating system**:

```
clipboard before the tap : ""
clipboard after the tap  : "KX-4471"
chip state               : chip-btn copied
```

That is the acceptance criterion: a tap copies the code and shows confirmation.

## Not verified

- The `copy failed` branch has no automated test. It needs the permission actively denied, which the
  harness grants. The refusal path in the **handler** is covered by unit tests.

## Deferred

- Nothing is sent anywhere. SHARE is local, which is what the verb means: a code is read off one
  screen and typed into another.
