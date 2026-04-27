import type { Direction } from "../compass"
import type { PlayerSlot } from "../gameTypes"
import type { BoardCommitmentRuntime, LocalBoardState } from "./localBoard"

export type MidnightPhase =
  | "OPEN"
  | "WAITING_FOR_SECOND_PLAYER"
  | "WAITING_FOR_BOARDS"
  | "IN_PROGRESS"
  | "FINISHED"
  | "PAID"

export type MidnightLedgerSnapshot = {
  contractAddress: string
  phase: MidnightPhase
  winner: PlayerSlot | null
  playerAKey?: string | null
  playerBKey?: string | null
  rowA?: number
  colA?: number
  rowB?: number
  colB?: number
  chargeA?: number
  chargeB?: number
  readingA?: number
  readingB?: number
  hasReadingA: boolean
  hasReadingB: boolean
  turnPlayer?: PlayerSlot | null
  challenged: boolean
}

export type MidnightIdentity = {
  nickname: string
  playerSlot?: PlayerSlot
  secretKey: Uint8Array
}

export type JoinCircuitArgs = {
  nickname: string
  stake: bigint
  payoutAddress: string
  localSecretKey: Uint8Array
}

export type JoinCircuitResult = {
  slot: PlayerSlot
  phase: MidnightPhase
}

export type CounterfeitCompassContractAdapter = {
  readonly contractAddress: string
  readonly boardRuntime?: BoardCommitmentRuntime<unknown>
  getLedgerState(): Promise<MidnightLedgerSnapshot>
  joinGame(args: JoinCircuitArgs): Promise<JoinCircuitResult>
  commitMyNextBoardCell(args: {
    index: number
    board: LocalBoardState<unknown>
  }): Promise<void>
  finalizeMyBoard(): Promise<void>
  play(args: {
    reading: Direction
  }): Promise<void>
  challenge(): Promise<void>
  proveMyReading(): Promise<void>
  claimPot(): Promise<void>
}

let contractAdapter: CounterfeitCompassContractAdapter | null = null

export function setCounterfeitCompassAdapter(
  adapter: CounterfeitCompassContractAdapter
): void {
  contractAdapter = adapter
}

export function getCounterfeitCompassAdapter(): CounterfeitCompassContractAdapter {
  if (contractAdapter) {
    return contractAdapter
  }

  throw new Error(
    "Midnight mode is enabled but no Counterfeit Compass adapter is configured. " +
      "Wire the generated Midnight client bindings into frontend/src/midnight/contract.ts."
  )
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim()
  if (normalized.length % 2 !== 0) {
    throw new Error("Invalid hex string length")
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function storageKey(contractAddress: string): string {
  return `counterfeit-compass:midnight:identity:${contractAddress}`
}

function randomBytes32(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

export function loadLocalIdentity(contractAddress: string): MidnightIdentity | null {
  const raw = window.localStorage.getItem(storageKey(contractAddress))
  if (!raw) {
    return null
  }

  const parsed = JSON.parse(raw) as {
    nickname: string
    playerSlot?: PlayerSlot
    secretKeyHex: string
  }

  return {
    nickname: parsed.nickname,
    playerSlot: parsed.playerSlot,
    secretKey: hexToBytes(parsed.secretKeyHex),
  }
}

export function saveLocalIdentity(
  contractAddress: string,
  identity: MidnightIdentity
): void {
  window.localStorage.setItem(
    storageKey(contractAddress),
    JSON.stringify({
      nickname: identity.nickname,
      playerSlot: identity.playerSlot,
      secretKeyHex: bytesToHex(identity.secretKey),
    })
  )
}

export function loadOrCreateLocalIdentity(
  contractAddress: string,
  nickname: string
): MidnightIdentity {
  const existing = loadLocalIdentity(contractAddress)
  if (existing) {
    if (existing.nickname !== nickname) {
      saveLocalIdentity(contractAddress, {
        ...existing,
        nickname,
      })
      return {
        ...existing,
        nickname,
      }
    }

    return existing
  }

  const identity: MidnightIdentity = {
    nickname,
    secretKey: randomBytes32(),
  }

  saveLocalIdentity(contractAddress, identity)
  return identity
}

export function clearLocalIdentity(contractAddress: string): void {
  window.localStorage.removeItem(storageKey(contractAddress))
}

export function getConfiguredMidnightStake(): bigint {
  const raw = import.meta.env.VITE_MIDNIGHT_STAKE
  if (!raw) {
    throw new Error(
      "Set VITE_MIDNIGHT_STAKE before using Midnight mode so join transactions can escrow a fixed stake."
    )
  }

  try {
    return BigInt(raw)
  } catch {
    throw new Error("VITE_MIDNIGHT_STAKE must be a whole-number token amount.")
  }
}

export function getConfiguredPayoutAddress(): string {
  const payoutAddress = import.meta.env.VITE_MIDNIGHT_PAYOUT_ADDRESS
  if (!payoutAddress) {
    throw new Error(
      "Set VITE_MIDNIGHT_PAYOUT_ADDRESS before using Midnight mode so winnings have a destination."
    )
  }

  return payoutAddress
}
