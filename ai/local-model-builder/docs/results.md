# Results

## 2026-11-02 — shelf, qwen35-9b on the 3080, thinking off, 3 attempts, oracle on

**Run 1: 8/16.** Tasks 01–08 passed (05 at attempt 2, 08 at 3); 09 failed; 10–16 all failed because 04's
`create_item` committed the item and then wrote the tags without committing. Inside one connection the repo tests
passed; the web app opens a connection per request, so every tag was lost from task 10 on, even with the reference
filled in. A gap in the tests (04 checked the item reached a second connection, not its tags), so the planner's
tests decide what gets through. Two harness gaps as well: task 14 returned only one of its three files, and retries
wrote prose reasoning into `plan` until the 8,192-token cap (35k characters on 11 attempt 2).

Fixed before run 2: tests 04/06 check a second connection; `plan` capped at 600 characters; a reply that leaves out a
file that doesn't exist yet is sent back; when the reference can't repair a task because earlier model work broke
it, everything so far is reset to the reference.

**Run 2: 14/16, built app passes all 60 tests** (with the reference filled in for the two failures). 5.5 minutes of
model time for 28 attempts, 220–1,900 output tokens each.

| task | outcome | why it failed |
|---|---|---|
| 01–03, 05–07, 15, 16 | pass@1 | |
| 09, 10, 11, 12 | pass@2 | fixed from the pytest output |
| 08, 13 | pass@3 | |
| 04 | failed | the same commit bug; the feedback (`[] == ['x', 'y']`) was misread as "wrong connection" and the identical code came back three times |
| 14 | failed | returned only `base.html` (220 tokens) three times, even when told `list.html` was missing |

Findings:
- Feedback works: 6 of the 14 passes needed it.
- **Greedy decoding makes retries repeat themselves.** 04 and 14 sent the same answer three times. Retries need
  sampling, a different model, or a different prompt.
- **One file per task.** The 9B ended its file list after the first file every time on the one task with three
  new files.
- The tests are the spec. A missing assertion let a bug through that sank half of run 1.
