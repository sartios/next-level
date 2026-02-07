import subprocess
import sys
from pathlib import Path

OPTIMIZERS = [
    "meta_optimizers/user_skill_agent.py",
    "meta_optimizers/skill_resource_retriever.py",
    "meta_optimizers/challenge_generator.py",
]


def main():
    root = Path(__file__).parent
    failed = []

    for script in OPTIMIZERS:
        path = root / script
        print(f"\n{'=' * 60}")
        print(f"Running: {script}")
        print(f"{'=' * 60}\n")

        result = subprocess.run(
            [sys.executable, str(path)],
            cwd=str(root),
        )

        if result.returncode != 0:
            failed.append(script)
            print(f"\nFAILED: {script} (exit code {result.returncode})")

    print(f"\n{'=' * 60}")
    print("ALL OPTIMIZERS COMPLETE")
    print(f"{'=' * 60}")
    print(
        f"Total: {len(OPTIMIZERS)}, Passed: {len(OPTIMIZERS) - len(failed)}, Failed: {len(failed)}"
    )

    if failed:
        print("\nFailed optimizers:")
        for f in failed:
            print(f"  - {f}")
        sys.exit(1)


if __name__ == "__main__":
    main()
