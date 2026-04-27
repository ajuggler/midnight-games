import {
  GRID_SIZE,
  MAX_MODIFIED_ARROWS,
  countModifiedArrows,
  type Direction,
  type DirectionsState,
  randomSalt32,
} from "../compass"
import type { PlayerSlot } from "../gameTypes"

export type MerklePathEntry = {
  sibling: Uint8Array
  goesLeft: boolean
}

export type LocalMerklePath = {
  leaf: Uint8Array
  path: MerklePathEntry[]
}

export interface MerkleTreeMirror<TPath> {
  insertHashIndex(hash: Uint8Array, index: bigint): void
  pathForLeaf(index: bigint, leaf: Uint8Array): TPath
  root(): Uint8Array
}

export interface BoardCommitmentRuntime<TPath> {
  commitLeaf(
    index: number,
    direction: Direction,
    salt: Uint8Array
  ): Promise<Uint8Array> | Uint8Array
  createTree(): MerkleTreeMirror<TPath>
}

export type LocalBoardState<TPath> = {
  dirs: Direction[]
  salts: Uint8Array[]
  leaves: Uint8Array[]
  tree: MerkleTreeMirror<TPath>
  root: Uint8Array
}

type StoredLocalBoardState = {
  dirs: Direction[]
  saltsBase64: string[]
  leavesBase64: string[]
  rootBase64: string
}

function toBase64(bytes: Uint8Array): string {
  let value = ""
  for (const item of bytes) {
    value += String.fromCharCode(item)
  }
  return btoa(value)
}

function fromBase64(value: string): Uint8Array {
  const decoded = atob(value)
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0))
}

async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const normalized = Uint8Array.from(input)
  const digest = await crypto.subtle.digest("SHA-256", normalized)
  return new Uint8Array(digest)
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }

  return output
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

class AsyncDevelopmentMerkleTree implements MerkleTreeMirror<LocalMerklePath> {
  private readonly leaves = new Array<Uint8Array>(2 ** 5).fill(new Uint8Array(32))

  insertHashIndex(hash: Uint8Array, index: bigint): void {
    this.leaves[Number(index)] = hash
  }

  pathForLeaf(index: bigint, leaf: Uint8Array): LocalMerklePath {
    const position = Number(index)
    const existing = this.leaves[position]

    if (!existing || !sameBytes(existing, leaf)) {
      throw new Error(`Leaf ${position} does not match the stored commitment`)
    }

    const path: MerklePathEntry[] = []
    let cursor = position
    let level = [...this.leaves]

    while (level.length > 1) {
      const goesLeft = cursor % 2 === 0
      const siblingIndex = goesLeft ? cursor + 1 : cursor - 1
      path.push({
        sibling: level[siblingIndex] ?? new Uint8Array(32),
        goesLeft,
      })

      const nextLevel: Uint8Array[] = []
      for (let pair = 0; pair < level.length; pair += 2) {
        nextLevel.push(hashNodeSync(level[pair] ?? new Uint8Array(32), level[pair + 1] ?? new Uint8Array(32)))
      }

      cursor = Math.floor(cursor / 2)
      level = nextLevel
    }

    return {
      leaf,
      path,
    }
  }

  root(): Uint8Array {
    let level = [...this.leaves]

    while (level.length > 1) {
      const nextLevel: Uint8Array[] = []
      for (let pair = 0; pair < level.length; pair += 2) {
        nextLevel.push(hashNodeSync(level[pair] ?? new Uint8Array(32), level[pair + 1] ?? new Uint8Array(32)))
      }
      level = nextLevel
    }

    return level[0] ?? new Uint8Array(32)
  }
}

function hashNodeSync(left: Uint8Array, right: Uint8Array): Uint8Array {
  const marker = new TextEncoder().encode("counterfeit-compass:merkle:")
  const merged = concatBytes([marker, left, right])
  const digest = new Uint8Array(32)

  for (let index = 0; index < merged.length; index += 1) {
    digest[index % digest.length] ^= merged[index]
    digest[(index * 7) % digest.length] ^= (merged[index] + index) & 0xff
  }

  return digest
}

export function createDevelopmentBoardRuntime(): BoardCommitmentRuntime<LocalMerklePath> {
  return {
    async commitLeaf(index, direction, salt) {
      const header = new TextEncoder().encode("counterfeit-compass:dev-leaf:")
      const payload = concatBytes([
        header,
        Uint8Array.of(index),
        Uint8Array.of(direction),
        salt,
      ])

      return sha256(payload)
    },
    createTree() {
      return new AsyncDevelopmentMerkleTree()
    },
  }
}

export async function leafCommit<TPath>(
  idx: number,
  direction: Direction,
  salt: Uint8Array,
  runtime: BoardCommitmentRuntime<TPath>
): Promise<Uint8Array> {
  return runtime.commitLeaf(idx, direction, salt)
}

export async function buildLocalBoard<TPath>(
  directions: DirectionsState,
  runtime: BoardCommitmentRuntime<TPath>
): Promise<LocalBoardState<TPath>> {
  if (directions.length !== GRID_SIZE * GRID_SIZE) {
    throw new Error("Local board directions must contain exactly 25 cells.")
  }

  if (countModifiedArrows(directions) > MAX_MODIFIED_ARROWS) {
    throw new Error("Boards may modify at most three arrows.")
  }

  const tree = runtime.createTree()
  const salts = directions.map(() => randomSalt32())
  const leaves: Uint8Array[] = []

  for (let index = 0; index < directions.length; index += 1) {
    const commitment = await leafCommit(index, directions[index], salts[index], runtime)
    leaves.push(commitment)
    tree.insertHashIndex(commitment, BigInt(index))
  }

  return {
    dirs: [...directions],
    salts,
    leaves,
    tree,
    root: tree.root(),
  }
}

function localBoardStorageKey(contractAddress: string, playerSlot: PlayerSlot): string {
  return `counterfeit-compass:midnight:board:${contractAddress}:${playerSlot}`
}

export function saveLocalBoard<TPath>(
  contractAddress: string,
  playerSlot: PlayerSlot,
  board: LocalBoardState<TPath>
): void {
  const stored: StoredLocalBoardState = {
    dirs: [...board.dirs],
    saltsBase64: board.salts.map(toBase64),
    leavesBase64: board.leaves.map(toBase64),
    rootBase64: toBase64(board.root),
  }

  window.localStorage.setItem(
    localBoardStorageKey(contractAddress, playerSlot),
    JSON.stringify(stored)
  )
}

export async function loadLocalBoard<TPath>(
  contractAddress: string,
  playerSlot: PlayerSlot,
  runtime: BoardCommitmentRuntime<TPath>
): Promise<LocalBoardState<TPath> | null> {
  const raw = window.localStorage.getItem(localBoardStorageKey(contractAddress, playerSlot))
  if (!raw) {
    return null
  }

  const stored = JSON.parse(raw) as StoredLocalBoardState
  const tree = runtime.createTree()
  const salts = stored.saltsBase64.map(fromBase64)
  const leaves = stored.leavesBase64.map(fromBase64)

  for (let index = 0; index < leaves.length; index += 1) {
    tree.insertHashIndex(leaves[index], BigInt(index))
  }

  return {
    dirs: [...stored.dirs],
    salts,
    leaves,
    tree,
    root: fromBase64(stored.rootBase64),
  }
}

export function clearLocalBoard(contractAddress: string, playerSlot: PlayerSlot): void {
  window.localStorage.removeItem(localBoardStorageKey(contractAddress, playerSlot))
}

export function pathForCell<TPath>(
  board: LocalBoardState<TPath>,
  index: number
): TPath {
  return board.tree.pathForLeaf(BigInt(index), board.leaves[index])
}
