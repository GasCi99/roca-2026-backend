# Firestore Security Specification - ROCA 2026

## 1. Data Invariants
- A `Vote` must belong to a valid `Match`.
- A `Match` must have valid players from the `players` collection.
- `Settings` (pozo, potm) are only modifiable by administrators.
- Players cannot vote for themselves (enforced client-side, but rules should restrict write to the correct voter's document).

## 2. The "Dirty Dozen" Payloads (Red Team)
1. **Identity Spoofing**: Attempt to create a vote document for another player (`matches/match1/votes/other_player`).
2. **State Shortcutting**: Attempt to update a match's `votingClosed` status directly.
3. **Resource Poisoning**: Attempt to write a 1MB string into a player's `name`.
4. **Orphaned Vote**: Attempt to create a vote for a match ID that doesn't exist.
5. **Unauthorized Settings Update**: Attempt to update the `pozo` amount without admin credentials.
6. **Privilege Escalation**: Attempt to mark oneself as an admin in a hypothetical `admins` collection.
7. **Negative Score**: Attempt to save a match with negative scores.
8. **Invalid ID**: Attempt to write to a path with a 2KB long junk string as document ID.
9. **Future Match**: Attempt to save a match with a date in the year 2099.
10. **Data Type Mismatch**: Write a string into the `pozo` amount field (should be number).
11. **Shadow Fields**: Add a `isVerified: true` field to a Player document.
12. **Self-Voting**: Write a vote where `voterName == votedFor`.

## 3. Test Runner (Mock)
`firestore.rules.test.ts` would verify these payloads return `PERMISSION_DENIED`.
