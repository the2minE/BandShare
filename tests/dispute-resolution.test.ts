import { describe, it, expect, beforeEach } from "vitest";

// Mock contract state and functions
interface DisputeResolutionState {
  admin: string;
  paused: boolean;
  marketplaceContract: string;
  tokenContract: string;
  disputes: Map<bigint, { consumer: string; provider: string; description: string; createdAt: bigint; resolved: boolean; resolution: string | null; votesForConsumer: bigint; votesForProvider: bigint }>;
  votes: Map<string, { votedForConsumer: boolean }>;
  disputeCounter: bigint;
  events: Map<bigint, { action: string; initiator: string; disputeId: bigint; consumer: string; provider: string; timestamp: bigint }>;
  lastEventId: bigint;
  VOTING_PERIOD: bigint;
  MIN_VOTES: bigint;
}

const mockContract: DisputeResolutionState & {
  isAdmin(caller: string): boolean;
  isMarketplace(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setMarketplaceContract(caller: string, contract: string): { value: boolean } | { error: number };
  setTokenContract(caller: string, contract: string): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  createDispute(caller: string, provider: string, description: string, currentBlock: bigint): { value: bigint } | { error: number };
  voteDispute(caller: string, disputeId: bigint, voteForConsumer: boolean, mockStakedBalance: (voter: string) => { value: bigint } | { error: number }, currentBlock: bigint): { value: boolean } | { error: number };
  resolveDispute(caller: string, disputeId: bigint, resolution: string): { value: boolean } | { error: number };
  getDispute(disputeId: bigint): { value: { consumer: string; provider: string; description: string; createdAt: bigint; resolved: boolean; resolution: string | null; votesForConsumer: bigint; votesForProvider: bigint } };
  getVote(disputeId: bigint, voter: string): { value: { votedForConsumer: boolean } };
  getAdmin(): { value: string };
  isPaused(): { value: boolean };
  getMarketplaceContract(): { value: string };
  getTokenContract(): { value: string };
  getEvent(eventId: bigint): { value: { action: string; initiator: string; disputeId: bigint; consumer: string; provider: string; timestamp: bigint } };
} = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  marketplaceContract: "SP000000000000000000002Q6VF78",
  tokenContract: "SP000000000000000000002Q6VF78",
  disputes: new Map(),
  votes: new Map(),
  disputeCounter: 0n,
  events: new Map(),
  lastEventId: 0n,
  VOTING_PERIOD: 1440n,
  MIN_VOTES: 3n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  isMarketplace(caller: string) {
    return caller === this.marketplaceContract;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 500 };
    this.paused = pause;
    this.events.set(++this.lastEventId, { action: pause ? "pause" : "unpause", initiator: caller, disputeId: 0n, consumer: caller, provider: caller, timestamp: 100n });
    return { value: pause };
  },

  setMarketplaceContract(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 500 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 502 };
    this.marketplaceContract = contract;
    this.events.set(++this.lastEventId, { action: "set-marketplace-contract", initiator: caller, disputeId: 0n, consumer: contract, provider: contract, timestamp: 100n });
    return { value: true };
  },

  setTokenContract(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 500 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 502 };
    this.tokenContract = contract;
    this.events.set(++this.lastEventId, { action: "set-token-contract", initiator: caller, disputeId: 0n, consumer: contract, provider: contract, timestamp: 100n });
    return { value: true };
  },

  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 500 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 502 };
    this.admin = newAdmin;
    this.events.set(++this.lastEventId, { action: "transfer-admin", initiator: caller, disputeId: 0n, consumer: newAdmin, provider: newAdmin, timestamp: 100n });
    return { value: true };
  },

  createDispute(caller: string, provider: string, description: string, currentBlock: bigint) {
    if (this.paused) return { error: 501 };
    if (!this.isMarketplace(caller)) return { error: 500 };
    if (provider === "SP000000000000000000002Q6VF78" || caller === "SP000000000000000000002Q6VF78") return { error: 502 };
    if (description.length === 0) return { error: 504 };
    const disputeId = ++this.disputeCounter;
    this.disputes.set(disputeId, { consumer: caller, provider, description, createdAt: currentBlock, resolved: false, resolution: null, votesForConsumer: 0n, votesForProvider: 0n });
    this.events.set(++this.lastEventId, { action: "create-dispute", initiator: caller, disputeId, consumer: caller, provider, timestamp: currentBlock });
    return { value: disputeId };
  },

  voteDispute(caller: string, disputeId: bigint, voteForConsumer: boolean, mockStakedBalance: (voter: string) => { value: bigint } | { error: number }, currentBlock: bigint) {
    if (this.paused) return { error: 501 };
    if (this.tokenContract === "SP000000000000000000002Q6VF78") return { error: 503 };
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { error: 504 };
    if (dispute.resolved) return { error: 506 };
    if (currentBlock >= dispute.createdAt + this.VOTING_PERIOD) return { error: 507 };
    const voteKey = `${disputeId}:${caller}`;
    if (this.votes.has(voteKey)) return { error: 505 };
    if ("error" in mockStakedBalance(caller)) return { error: 500 };
    this.votes.set(voteKey, { votedForConsumer: voteForConsumer });
    this.disputes.set(disputeId, {
      ...dispute,
      votesForConsumer: voteForConsumer ? dispute.votesForConsumer + 1n : dispute.votesForConsumer,
      votesForProvider: voteForConsumer ? dispute.votesForProvider : dispute.votesForProvider + 1n,
    });
    this.events.set(++this.lastEventId, { action: "vote-dispute", initiator: caller, disputeId, consumer: dispute.consumer, provider: dispute.provider, timestamp: currentBlock });
    return { value: true };
  },

  resolveDispute(caller: string, disputeId: bigint, resolution: string) {
    if (this.paused) return { error: 501 };
    if (!this.isAdmin(caller)) return { error: 500 };
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { error: 504 };
    if (dispute.resolved) return { error: 506 };
    if (dispute.votesForConsumer < this.MIN_VOTES && dispute.votesForProvider < this.MIN_VOTES) return { error: 504 };
    this.disputes.set(disputeId, { ...dispute, resolved: true, resolution });
    this.events.set(++this.lastEventId, { action: "resolve-dispute", initiator: caller, disputeId, consumer: dispute.consumer, provider: dispute.provider, timestamp: 100n });
    return { value: true };
  },

  getDispute(disputeId: bigint) {
    return {
      value: this.disputes.get(disputeId) || {
        consumer: "SP000000000000000000002Q6VF78",
        provider: "SP000000000000000000002Q6VF78",
        description: "",
        createdAt: 0n,
        resolved: false,
        resolution: null,
        votesForConsumer: 0n,
        votesForProvider: 0n,
      },
    };
  },

  getVote(disputeId: bigint, voter: string) {
    return { value: this.votes.get(`${disputeId}:${voter}`) || { votedForConsumer: false } };
  },

  getAdmin() {
    return { value: this.admin };
  },

  isPaused() {
    return { value: this.paused };
  },

  getMarketplaceContract() {
    return { value: this.marketplaceContract };
  },

  getTokenContract() {
    return { value: this.tokenContract };
  },

  getEvent(eventId: bigint) {
    return {
      value: this.events.get(eventId) || {
        action: "",
        initiator: "SP000000000000000000002Q6VF78",
        disputeId: 0n,
        consumer: "SP000000000000000000002Q6VF78",
        provider: "SP000000000000000000002Q6VF78",
        timestamp: 0n,
      },
    };
  },
};

describe("Dispute Resolution Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.marketplaceContract = "SP000000000000000000002Q6VF78";
    mockContract.tokenContract = "SP000000000000000000002Q6VF78";
    mockContract.disputes = new Map();
    mockContract.votes = new Map();
    mockContract.disputeCounter = 0n;
    mockContract.events = new Map();
    mockContract.lastEventId = 0n;
  });

  const mockStakedBalance = (voter: string) => ({ value: 100n });

  it("should allow admin to set marketplace contract", () => {
    const result = mockContract.setMarketplaceContract(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.marketplaceContract).toBe("ST2CY5...");
    expect(mockContract.events.get(1n)?.action).toBe("set-marketplace-contract");
  });

  it("should prevent non-admin from setting marketplace contract", () => {
    const result = mockContract.setMarketplaceContract("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 500 });
  });

  it("should allow admin to set token contract", () => {
    const result = mockContract.setTokenContract(mockContract.admin, "ST5TOKEN...");
    expect(result).toEqual({ value: true });
    expect(mockContract.tokenContract).toBe("ST5TOKEN...");
    expect(mockContract.events.get(1n)?.action).toBe("set-token-contract");
  });

  it("should allow admin to transfer admin rights", () => {
    const result = mockContract.transferAdmin(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.admin).toBe("ST3NB...");
    expect(mockContract.events.get(1n)?.action).toBe("transfer-admin");
  });

  it("should allow admin to pause contract", () => {
    const result = mockContract.setPaused(mockContract.admin, true);
    expect(result).toEqual({ value: true });
    expect(mockContract.paused).toBe(true);
    expect(mockContract.events.get(1n)?.action).toBe("pause");
  });

  it("should allow marketplace to create dispute", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.createDispute("ST4RE...", "ST2CY5...", "Bandwidth not delivered", 100n);
    expect(result).toEqual({ value: 1n });
    expect(mockContract.disputes.get(1n)?.description).toBe("Bandwidth not delivered");
    expect(mockContract.events.get(2n)?.action).toBe("create-dispute");
  });

  it("should prevent non-marketplace from creating dispute", () => {
    const result = mockContract.createDispute("ST2CY5...", "ST3NB...", "Invalid", 100n);
    expect(result).toEqual({ error: 500 });
  });

  it("should prevent creating dispute with empty description", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.createDispute("ST4RE...", "ST2CY5...", "", 100n);
    expect(result).toEqual({ error: 504 });
  });

  it("should prevent voting when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.setTokenContract(mockContract.admin, "ST5TOKEN...");
    mockContract.createDispute("ST4RE...", "ST2CY5...", "Bandwidth issue", 100n);
    const result = mockContract.voteDispute("ST3NB...", 1n, true, mockStakedBalance, 200n);
    expect(result).toEqual({ error: 501 });
  });

  it("should prevent voting with unset token contract", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.createDispute("ST4RE...", "ST2CY5...", "Bandwidth issue", 100n);
    const result = mockContract.voteDispute("ST3NB...", 1n, true, mockStakedBalance, 200n);
    expect(result).toEqual({ error: 503 });
  });

  it("should prevent voting on resolved dispute", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.setTokenContract(mockContract.admin, "ST5TOKEN...");
    mockContract.createDispute("ST4RE...", "ST2CY5...", "Bandwidth issue", 100n);
    mockContract.voteDispute("ST3NB...", 1n, true, mockStakedBalance, 200n);
    mockContract.voteDispute("ST5PQ...", 1n, true, mockStakedBalance, 200n);
    mockContract.voteDispute("ST6PQ...", 1n, true, mockStakedBalance, 200n);
    mockContract.resolveDispute(mockContract.admin, 1n, "Resolved in favor of consumer");
    const result = mockContract.voteDispute("ST7PQ...", 1n, true, mockStakedBalance, 200n);
    expect(result).toEqual({ error: 506 });
  });

  it("should prevent resolving dispute with insufficient votes", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.setTokenContract(mockContract.admin, "ST5TOKEN...");
    mockContract.createDispute("ST4RE...", "ST2CY5...", "Bandwidth issue", 100n);
    mockContract.voteDispute("ST3NB...", 1n, true, mockStakedBalance, 200n);
    const result = mockContract.resolveDispute(mockContract.admin, 1n, "Resolved in favor of consumer");
    expect(result).toEqual({ error: 504 });
  });

  it("should return correct dispute data", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.createDispute("ST4RE...", "ST2CY5...", "Bandwidth issue", 100n);
    const result = mockContract.getDispute(1n);
    expect(result.value.description).toBe("Bandwidth issue");
    expect(result.value.consumer).toBe("ST4RE...");
    expect(result.value.provider).toBe("ST2CY5...");
  });

  it("should return correct vote data", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.setTokenContract(mockContract.admin, "ST5TOKEN...");
    mockContract.createDispute("ST4RE...", "ST2CY5...", "Bandwidth issue", 100n);
    mockContract.voteDispute("ST3NB...", 1n, true, mockStakedBalance, 200n);
    const result = mockContract.getVote(1n, "ST3NB...");
    expect(result.value.votedForConsumer).toBe(true);
  });

  it("should return correct event data", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.createDispute("ST4RE...", "ST2CY5...", "Bandwidth issue", 100n);
    const event = mockContract.getEvent(2n);
    expect(event.value.action).toBe("create-dispute");
    expect(event.value.disputeId).toBe(1n);
  });
});