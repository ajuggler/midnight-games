# Counterfeit Compass Contract

This workspace houses the Compact contract that replaces the trusted backend referee.

The source of truth is [`src/counterfeit_compass.compact`](./src/counterfeit_compass.compact). The surrounding build configuration is intentionally lightweight until the Midnight scaffold and generated TypeScript bindings are added to the repository.

When wiring this up to the real toolchain, the next steps are:

1. Add the Midnight-generated project files for compilation and binding generation.
2. Point the frontend adapter in `frontend/src/midnight/contract.ts` at the generated client.
3. Replace the placeholder build scripts in `package.json` with the actual Compact compile and binding generation commands.
