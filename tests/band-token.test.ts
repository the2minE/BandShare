import { describe, it, expect, beforeEach } from "vitest";

// Mock contract state and functions
interface BandTokenState {
  admin: string;
  paused: boolean;
  totalSupply: bigint;
  balances: Map<string, bigint>;
  staked: Map<string, bigint>;
  allowances: Map<string, bigint>;
  events: Map<bigint, { action: string; initiator: string; recipient: string; amount: bigint; timestamp: bigint }>;
  lastEventId: bigint;
  MAX_SUPPLY: bigint;
}

const mockContract: BandTokenState & {
  isAdmin(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  mint(caller: string, recipient: string, amount: bigint): { value: boolean } | { error: number };
  burn(caller: string, amount: bigint): { value: boolean } | { error: number };
  transfer(caller: string, recipient: string, amount: bigint): { value: boolean } | { error: number };
  approve(caller: string, spender: string, amount: bigint): { value: boolean } | { error: number };
  transferFrom(caller: string, owner: string, recipient: string, amount: bigint): { value: boolean } | { error: number };
  stake(caller: string, amount: bigint): { value: boolean } | { error: number };
  unstake(caller: string, amount: bigint): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  getBalance(account: string): { value: bigint };
  getStakedBalance(account: string): { value: bigint };
  getAllowance(owner: string, spender: string): { value: bigint };
  getTotalSupply(): { value: bigint };
  getAdmin(): { value: string };
  isPaused(): { value: boolean };
  getTokenMetadata(): { value: { name: string; symbol: string; decimals: number; maxSupply: bigint } };
  getEvent(eventId: bigint): { value: { action: string; initiator: string; recipient: string; amount: bigint; timestamp: bigint } };
} = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  totalSupply: 0n,
  balances: new Map(),
  staked: new Map(),
  allowances: new Map(),
  events: new Map(),
  lastEventId: 0n,
  MAX_SUPPLY: 1000000000n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    this.events.set(++this.lastEventId, { action: pause ? "pause" : "unpause", initiator: caller, recipient: caller, amount: 0n, timestamp: 100n });
    return { value: pause };
  },

  mint(caller: string, recipient: string, amount: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 107 };
    if (this.totalSupply + amount > this.MAX_SUPPLY) return { error: 103 };
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    this.totalSupply += amount;
    this.events.set(++this.lastEventId, { action: "mint", initiator: caller, recipient, amount, timestamp: 100n });
    return { value: true };
  },

  burn(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount <= 0n) return { error: 107 };
    const balance = this.balances.get(caller) || 0n;
    if (balance < amount) return { error: 101 };
    this.balances.set(caller, balance - amount);
    this.totalSupply -= amount;
    this.events.set(++this.lastEventId, { action: "burn", initiator: caller, recipient: caller, amount, timestamp: 100n });
    return { value: true };
  },

  transfer(caller: string, recipient: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 107 };
    const balance = this.balances.get(caller) || 0n;
    if (balance < amount) return { error: 101 };
    this.balances.set(caller, balance - amount);
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    this.events.set(++this.lastEventId, { action: "transfer", initiator: caller, recipient, amount, timestamp: 100n });
    return { value: true };
  },

  approve(caller: string, spender: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (spender === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 107 };
    this.allowances.set(`${caller}:${spender}`, amount);
    this.events.set(++this.lastEventId, { action: "approve", initiator: caller, recipient: spender, amount, timestamp: 100n });
    return { value: true };
  },

  transferFrom(caller: string, owner: string, recipient: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 107 };
    const allowance = this.allowances.get(`${owner}:${caller}`) || 0n;
    const ownerBalance = this.balances.get(owner) || 0n;
    if (allowance < amount) return { error: 106 };
    if (ownerBalance < amount) return { error: 101 };
    this.allowances.set(`${owner}:${caller}`, allowance - amount);
    this.balances.set(owner, ownerBalance - amount);
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    this.events.set(++this.lastEventId, { action: "transfer-from", initiator: caller, recipient, amount, timestamp: 100n });
    return { value: true };
  },

  stake(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount <= 0n) return { error: 107 };
    const balance = this.balances.get(caller) || 0n;
    if (balance < amount) return { error: 101 };
    this.balances.set(caller, balance - amount);
    this.staked.set(caller, (this.staked.get(caller) || 0n) + amount);
    this.events.set(++this.lastEventId, { action: "stake", initiator: caller, recipient: caller, amount, timestamp: 100n });
    return { value: true };
  },

  unstake(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount <= 0n) return { error: 107 };
    const stakeBalance = this.staked.get(caller) || 0n;
    if (stakeBalance < amount) return { error: 102 };
    this.staked.set(caller, stakeBalance - amount);
    this.balances.set(caller, (this.balances.get(caller) || 0n) + amount);
    this.events.set(++this.lastEventId, { action: "unstake", initiator: caller, recipient: caller, amount, timestamp: 100n });
    return { value: true };
  },

  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.admin = newAdmin;
    this.events.set(++this.lastEventId, { action: "transfer-admin", initiator: caller, recipient: newAdmin, amount: 0n, timestamp: 100n });
    return { value: true };
  },

  getBalance(account: string) {
    return { value: this.balances.get(account) || 0n };
  },

  getStakedBalance(account: string) {
    return { value: this.staked.get(account) || 0n };
  },

  getAllowance(owner: string, spender: string) {
    return { value: this.allowances.get(`${owner}:${spender}`) || 0n };
  },

  getTotalSupply() {
    return { value: this.totalSupply };
  },

  getAdmin() {
    return { value: this.admin };
  },

  isPaused() {
    return { value: this.paused };
  },

  getTokenMetadata() {
    return {
      value: { name: "BandToken", symbol: "BAND", decimals: 6, maxSupply: this.MAX_SUPPLY },
    };
  },

  getEvent(eventId: bigint) {
    return {
      value: this.events.get(eventId) || {
        action: "",
        initiator: "SP000000000000000000002Q6VF78",
        recipient: "SP000000000000000000002Q6VF78",
        amount: 0n,
        timestamp: 0n,
      },
    };
  },
};

describe("BandToken Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.totalSupply = 0n;
    mockContract.balances = new Map();
    mockContract.staked = new Map();
    mockContract.allowances = new Map();
    mockContract.events = new Map();
    mockContract.lastEventId = 0n;
  });

  it("should allow admin to mint tokens", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", 1000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(1000n);
    expect(mockContract.totalSupply).toBe(1000n);
    expect(mockContract.events.get(1n)?.action).toBe("mint");
  });

  it("should prevent non-admin from minting", () => {
    const result = mockContract.mint("ST2CY5...", "ST3NB...", 1000n);
    expect(result).toEqual({ error: 100 });
  });

  it("should prevent minting over max supply", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", 2000000000n);
    expect(result).toEqual({ error: 103 });
  });

  it("should prevent minting to zero address", () => {
    const result = mockContract.mint(mockContract.admin, "SP000000000000000000002Q6VF78", 1000n);
    expect(result).toEqual({ error: 105 });
  });

  it("should prevent minting zero amount", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", 0n);
    expect(result).toEqual({ error: 107 });
  });

  it("should allow token transfers", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 500n);
    const result = mockContract.transfer("ST2CY5...", "ST3NB...", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(300n);
    expect(mockContract.balances.get("ST3NB...")).toBe(200n);
    expect(mockContract.events.get(2n)?.action).toBe("transfer");
  });

  it("should prevent transfers when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const result = mockContract.transfer("ST2CY5...", "ST3NB...", 10n);
    expect(result).toEqual({ error: 104 });
  });

  it("should prevent transfers with insufficient balance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 100n);
    const result = mockContract.transfer("ST2CY5...", "ST3NB...", 200n);
    expect(result).toEqual({ error: 101 });
  });

  it("should prevent transfers to zero address", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 100n);
    const result = mockContract.transfer("ST2CY5...", "SP000000000000000000002Q6VF78", 50n);
    expect(result).toEqual({ error: 105 });
  });

  it("should allow approving allowance", () => {
    const result = mockContract.approve("ST2CY5...", "ST3NB...", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.allowances.get("ST2CY5...:ST3NB...")).toBe(200n);
    expect(mockContract.events.get(1n)?.action).toBe("approve");
  });

  it("should prevent transfer-from with insufficient allowance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 500n);
    mockContract.approve("ST2CY5...", "ST3NB...", 50n);
    const result = mockContract.transferFrom("ST3NB...", "ST2CY5...", "ST4RE...", 100n);
    expect(result).toEqual({ error: 106 });
  });

  it("should allow staking tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 500n);
    const result = mockContract.stake("ST2CY5...", 200n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(300n);
    expect(mockContract.staked.get("ST2CY5...")).toBe(200n);
    expect(mockContract.events.get(2n)?.action).toBe("stake");
  });

  it("should prevent staking with insufficient balance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 100n);
    const result = mockContract.stake("ST2CY5...", 200n);
    expect(result).toEqual({ error: 101 });
  });

  it("should allow unstaking tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 500n);
    mockContract.stake("ST2CY5...", 200n);
    const result = mockContract.unstake("ST2CY5...", 100n);
    expect(result).toEqual({ value: true });
    expect(mockContract.staked.get("ST2CY5...")).toBe(100n);
    expect(mockContract.balances.get("ST2CY5...")).toBe(400n);
    expect(mockContract.events.get(3n)?.action).toBe("unstake");
  });

  it("should prevent unstaking with insufficient stake", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 500n);
    mockContract.stake("ST2CY5...", 100n);
    const result = mockContract.unstake("ST2CY5...", 200n);
    expect(result).toEqual({ error: 102 });
  });

  it("should allow admin to pause contract", () => {
    const result = mockContract.setPaused(mockContract.admin, true);
    expect(result).toEqual({ value: true });
    expect(mockContract.paused).toBe(true);
    expect(mockContract.events.get(1n)?.action).toBe("pause");
  });

  it("should prevent non-admin from pausing", () => {
    const result = mockContract.setPaused("ST2CY5...", true);
    expect(result).toEqual({ error: 100 });
  });

  it("should allow admin to transfer admin rights", () => {
    const result = mockContract.transferAdmin(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.admin).toBe("ST3NB...");
    expect(mockContract.events.get(1n)?.action).toBe("transfer-admin");
  });

  it("should return correct token metadata", () => {
    const result = mockContract.getTokenMetadata();
    expect(result).toEqual({
      value: { name: "BandToken", symbol: "BAND", decimals: 6, maxSupply: 1000000000n },
    });
  });

  it("should return event data", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 1000n);
    const event = mockContract.getEvent(1n);
    expect(event.value.action).toBe("mint");
    expect(event.value.amount).toBe(1000n);
  });
});