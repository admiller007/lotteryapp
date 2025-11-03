# Real-time behaviour and scalability

## Real-time updates
- The client subscribes to Firestore `prizes`, `prizeTiers`, and `winners` collections. Any change is streamed down and compared locally before state is updated, so the UI reflects updates almost immediately while avoiding redundant renders.
- User allocations are still persisted via Firebase functions, and the `winners` listener keeps non-admin clients in sync once drawings happen.

## Handling 500 concurrent users
- Firestore real-time listeners fan out from the managed backend, so 500 concurrent clients reuse the same subscription pattern without a custom WebSocket server.
- The context reducer only applies state updates when snapshots materially change, lowering the amount of React work every client has to do and keeping re-render costs stable.
- Ticket allocation actions only write the delta to Firestore, so concurrent allocations scale with Firestore's documented limits (tens of thousands of writes per minute). For larger loads you can shard lotteries by ID or promote Cloud Functions to validate quotas server-side.
- Static assets continue to be served via Next.js edge caching/CDN which keeps initial load times predictable even under traffic spikes.

## Further considerations
- If you expect >500 active allocators, enable Firebase's [App Check](https://firebase.google.com/docs/app-check) and rate limiting rules to protect from abuse.
- Monitoring Firestore usage (read/write costs) helps size indexes and catch any hot documents (e.g., a single prize). Splitting prize entry documents per user can increase parallel throughput if needed.
