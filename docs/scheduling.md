# Adaptive Weekly Plan Scheduling

The weekly plan system uses a deterministic, greedy slot-filling algorithm to distribute learning resource sections across a user's availability slots. No AI is involved — plans are generated purely from schedule data, resource structure, and completion state.

## How It Works

```mermaid
graph TD
    A[User sets availability] --> B[Schedule saved with weekly slots]
    B --> C{Plan exists for current week?}
    C -->|No| D[Generate new week plan]
    C -->|Yes| E[Sync with updated schedule]

    D --> F[Carry over incomplete sessions from previous week]
    F --> G[Fill remaining slots with next sections in order]

    E --> H[Remove pending sessions for deleted slots]
    H --> I[Keep completed sessions]
    I --> J[Generate sessions for new slots, resuming from where user left off]

    G --> K[Weekly plan with sessions]
    J --> K
```

## Key Properties

- **Deterministic** — same inputs always produce the same plan
- **Order-preserving** — sections are always assigned in `orderIndex` order, maintaining course progression
- **Incremental** — schedule changes only affect the current week; past weeks remain intact
- **Completion-aware** — completed work is never lost or reassigned
