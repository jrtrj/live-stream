# 09: The signed log

**What to build:** Every event is appended to a Matrix room behind the existing store interface, so the receipt becomes a verifiable event id.

**Blocked by:** T8

**Status:** ready-for-agent

- [ ] MatrixStore implements the existing EventStore interface with no change to other modules
- [ ] A second account can read the room in Element
- [ ] The receipt shows the event id
