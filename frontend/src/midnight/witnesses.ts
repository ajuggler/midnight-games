import type { PlayerSlot } from "../gameTypes"
import {
  getCounterfeitCompassAdapter,
  loadLocalIdentity,
} from "./contract"
import {
  loadLocalBoard,
  pathForCell,
  type BoardCommitmentRuntime,
} from "./localBoard"

export type CounterfeitCompassWitnesses<TPath> = {
  localSk(): Uint8Array
  dirAt(idx: bigint): bigint
  saltAt(idx: bigint): Uint8Array
  boardPath(idx: bigint, leaf: Uint8Array): TPath
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

function requireBoardRuntime<TPath>(): BoardCommitmentRuntime<TPath> {
  const adapter = getCounterfeitCompassAdapter()
  if (!adapter.boardRuntime) {
    throw new Error(
      "The Midnight adapter does not expose a board runtime. " +
        "Inject the generated commitment and Merkle helpers before calling witness code."
    )
  }

  return adapter.boardRuntime as BoardCommitmentRuntime<TPath>
}

export async function createWitnesses<TPath>(args: {
  contractAddress: string
  playerSlot: PlayerSlot
}): Promise<CounterfeitCompassWitnesses<TPath>> {
  const identity = loadLocalIdentity(args.contractAddress)
  if (!identity) {
    throw new Error("No local Midnight identity found for this contract.")
  }

  const runtime = requireBoardRuntime<TPath>()
  const board = await loadLocalBoard(args.contractAddress, args.playerSlot, runtime)

  if (!board) {
    throw new Error(
      "No local board state found for this player. The ability to prove moves depends on preserving browser-local board data."
    )
  }

  return {
    localSk() {
      return identity.secretKey
    },
    dirAt(idx) {
      return BigInt(board.dirs[Number(idx)])
    },
    saltAt(idx) {
      return board.salts[Number(idx)]
    },
    boardPath(idx, leaf) {
      const path = pathForCell(board, Number(idx))
      const storedLeaf = board.leaves[Number(idx)]
      if (!sameBytes(storedLeaf, leaf)) {
        throw new Error(`Leaf mismatch for index ${idx.toString()}`)
      }

      return path as TPath
    },
  }
}
