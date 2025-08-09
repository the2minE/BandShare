import { describe, it, expect, beforeEach } from "vitest";

// Mock contract state and functions
interface ReputationSystemState {
  admin: string;
  paused: boolean;
  marketplaceContract: string;
  lastDecayBlock: bigint;
  providerReputation: Map<string, { score: bigint; lastUpdated: bigint }>;
  consumerReputation: Map<string, { score: bigint; lastUpdated: bigint }>;
  events: Map<bigint, { action: string; initiator: string; user: string; score: bigint; timestamp: bigint }>;
  lastEventId: bigint;
  MAX_SCORE: bigint;
  MIN_SCORE: bigint;
  DECAY_RATE: bigint;
  DECAY_PERIOD: bigint;
}

const mockContract: ReputationSystemState & {
  isAdmin(caller: string): boolean;
  isMarketplace(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setMarketplaceContract(caller: string, contract: string): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  updateProviderReputation(caller: string, provider: string, score: bigint): { value: boolean } | { error: number };
  updateConsumerReputation(caller: string, consumer: string, score: bigint): { value: boolean } | { error: number };
  triggerDecay(caller: string, currentBlock: bigint): { value: boolean } | { error: number };
  getProviderReputation(provider: string, currentBlock: bigint): { value: { score: bigint; lastUpdated: bigint } };
  getConsumerReputation(consumer: string, currentBlock: bigint): { value: { score: bigint; lastUpdated: bigint } };
  getAdmin(): { value: string };
  isPaused(): { value: boolean };
  getMarketplaceContract(): { value: string };
  getEvent(eventId: bigint): { value: { action: string; initiator: string; user: string; score: bigint; timestamp: bigint } };
} = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  marketplaceContract: "SP000000000000000000002Q6VF78",
  lastDecayBlock: 0n,
  providerReputation: new Map(),
  consumerReputation: new Map(),
  events: new Map(),
  lastEventId: 0n,
  MAX_SCORE: 100n,
  MIN_SCORE: 0n,
  DECAY_RATE: 5n,
  DECAY_PERIOD: 1000n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  isMarketplace(caller: string) {
    return caller === this.marketplaceContract;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 300 };
    this.paused = pause;
    this.events.set(++this.lastEventId, { action: pause ? "pause" : "unpause", initiator: caller, user: caller, score: 0n, timestamp: 100n });
    return { value: pause };
  },

  setMarketplaceContract(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 300 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 303 };
    this.marketplaceContract = contract;
    this.events.set(++this.lastEventId, { action: "set-marketplace-contract", initiator: caller, user: contract, score: 0n, timestamp: 100n });
    return { value: true };
  },

  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 300 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 303 };
    this.admin = newAdmin;
    this.events.set(++this.lastEventId, { action: "transfer-admin", initiator: caller, user: newAdmin, score: 0n, timestamp: 100n });
    return { value: true };
  },

  updateProviderReputation(caller: string, provider: string, score: bigint) {
    if (this.paused) return { error: 302 };
    if (!this.isMarketplace(caller)) return { error: 300 };
    if (provider === "SP000000000000000000002Q6VF78") return { error: 303 };
    if (score < this.MIN_SCORE || score > this.MAX_SCORE) return { error: 301 };
    const currentRep = this.providerReputation.get(provider) || { score: 50n, lastUpdated: 0n };
    const blocksPassed = 100n - currentRep.lastUpdated;
    const decayCycles = blocksPassed / this.DECAY_PERIOD;
    const decayedScore = decayCycles > 0n ? (currentRep.score <= decayCycles * this.DECAY_RATE ? this.MIN_SCORE : currentRep.score - decayCycles * this.DECAY_RATE) : currentRep.score;
    const newScore = (decayedScore + score) / 2n;
    this.providerReputation.set(provider, { score: newScore, lastUpdated: 100n });
    this.events.set(++this.lastEventId, { action: "update-provider-reputation", initiator: caller, user: provider, score, timestamp: 100n });
    return { value: true };
  },

  updateConsumerReputation(caller: string, consumer: string, score: bigint) {
    if (this.paused) return { error: 302 };
    if (!this.isMarketplace(caller)) return { error: 300 };
    if (consumer === "SP000000000000000000002Q6VF78") return { error: 303 };
    if (score < this.MIN_SCORE || score > this.MAX_SCORE) return { error: 301 };
    const currentRep = this.consumerReputation.get(consumer) || { score: 50n, lastUpdated: 0n };
    const blocksPassed = 100n - currentRep.lastUpdated;
    const decayCycles = blocksPassed / this.DECAY_PERIOD;
    const decayedScore = decayCycles > 0n ? (currentRep.score <= decayCycles * this.DECAY_RATE ? this.MIN_SCORE : currentRep.score - decayCycles * this.DECAY_RATE) : currentRep.score;
    const newScore = (decayedScore + score) / 2n;
    this.consumerReputation.set(consumer, { score: newScore, lastUpdated: 100n });
    this.events.set(++this.lastEventId, { action: "update-consumer-reputation", initiator: caller, user: consumer, score, timestamp: 100n });
    return { value: true };
  },

  triggerDecay(caller: string, currentBlock: bigint) {
    if (currentBlock <= this.lastDecayBlock + this.DECAY_PERIOD) return { error: 300 };
    this.lastDecayBlock = currentBlock;
    this.events.set(++this.lastEventId, { action: "trigger-decay", initiator: caller, user: caller, score: 0n, timestamp: currentBlock });
    return { value: true };
  },

  getProviderReputation(provider: string, currentBlock: bigint) {
    const rep = this.providerReputation.get(provider) || { score: 50n, lastUpdated: 0n };
    const blocksPassed = currentBlock - rep.lastUpdated;
    const decayCycles = blocksPassed / this.DECAY_PERIOD;
    const score = decayCycles > 0n ? (rep.score <= decayCycles * this.DECAY_RATE ? this.MIN_SCORE : rep.score - decayCycles * this.DECAY_RATE) : rep.score;
    return { value: { score, lastUpdated: rep.lastUpdated } };
  },

  getConsumerReputation(consumer: string, currentBlock: bigint) {
    const rep = this.consumerReputation.get(consumer) || { score: 50n, lastUpdated: 0n };
    const blocksPassed = currentBlock - rep.lastUpdated;
    const decayCycles = blocksPassed / this.DECAY_PERIOD;
    const score = decayCycles > 0n ? (rep.score <= decayCycles * this.DECAY_RATE ? this.MIN_SCORE : rep.score - decayCycles * this.DECAY_RATE) : rep.score;
    return { value: { score, lastUpdated: rep.lastUpdated } };
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

  getEvent(eventId: bigint) {
    return {
      value: this.events.get(eventId) || {
        action: "",
        initiator: "SP000000000000000000002Q6VF78",
        user: "SP000000000000000000002Q6VF78",
        score: 0n,
        timestamp: 0n,
      },
    };
  },
};

describe("Reputation System Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.marketplaceContract = "SP000000000000000000002Q6VF78";
    mockContract.lastDecayBlock = 0n;
    mockContract.providerReputation = new Map();
    mockContract.consumerReputation = new Map();
    mockContract.events = new Map();
    mockContract.lastEventId = 0n;
  });

  it("should allow admin to set marketplace contract", () => {
    const result = mockContract.setMarketplaceContract(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.marketplaceContract).toBe("ST2CY5...");
    expect(mockContract.events.get(1n)?.action).toBe("set-marketplace-contract");
  });

  it("should prevent non-admin from setting marketplace contract", () => {
    const result = mockContract.setMarketplaceContract("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 300 });
  });

  it("should prevent setting zero address as marketplace contract", () => {
    const result = mockContract.setMarketplaceContract(mockContract.admin, "SP000000000000000000002Q6VF78");
    expect(result).toEqual({ error: 303 });
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

  it("should prevent non-admin from pausing", () => {
    const result = mockContract.setPaused("ST2CY5...", true);
    expect(result).toEqual({ error: 300 });
  });

  it("should allow marketplace to update provider reputation", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.updateProviderReputation("ST4RE...", "ST2CY5...", 80n);
    expect(result).toEqual({ value: true });
    expect(mockContract.providerReputation.get("ST2CY5...")?.score).toBe(65n); // (50 + 80) / 2
    expect(mockContract.events.get(2n)?.action).toBe("update-provider-reputation");
  });

  it("should prevent non-marketplace from updating provider reputation", () => {
    const result = mockContract.updateProviderReputation("ST2CY5...", "ST3NB...", 80n);
    expect(result).toEqual({ error: 300 });
  });

  it("should prevent updating provider reputation with invalid score", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.updateProviderReputation("ST4RE...", "ST2CY5...", 101n);
    expect(result).toEqual({ error: 301 });
  });

  it("should allow marketplace to update consumer reputation", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.updateConsumerReputation("ST4RE...", "ST3NB...", 90n);
    expect(result).toEqual({ value: true });
    expect(mockContract.consumerReputation.get("ST3NB...")?.score).toBe(70n); // (50 + 90) / 2
    expect(mockContract.events.get(2n)?.action).toBe("update-consumer-reputation");
  });

  it("should prevent updating consumer reputation when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.updateConsumerReputation("ST4RE...", "ST3NB...", 90n);
    expect(result).toEqual({ error: 302 });
  });

  it("should allow triggering decay after period", () => {
    const result = mockContract.triggerDecay("ST2CY5...", 1001n);
    expect(result).toEqual({ value: true });
    expect(mockContract.lastDecayBlock).toBe(1001n);
    expect(mockContract.events.get(1n)?.action).toBe("trigger-decay");
  });

  it("should prevent triggering decay before period", () => {
    mockContract.triggerDecay("ST2CY5...", 1001n);
    const result = mockContract.triggerDecay("ST2CY5...", 1500n);
    expect(result).toEqual({ error: 300 });
  });

  it("should return provider reputation with decay", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.updateProviderReputation("ST4RE...", "ST2CY5...", 80n);
    const result = mockContract.getProviderReputation("ST2CY5...", 1100n);
    expect(result.value.score).toBe(60n); // 65 - 5 (1 decay cycle)
    expect(result.value.lastUpdated).toBe(100n);
  });

  it("should return consumer reputation with decay", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.updateConsumerReputation("ST4RE...", "ST3NB...", 90n);
    const result = mockContract.getConsumerReputation("ST3NB...", 2100n);
    expect(result.value.score).toBe(60n); // 70 - 10 (2 decay cycles)
    expect(result.value.lastUpdated).toBe(100n);
  });

  it("should return correct event data", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.updateProviderReputation("ST4RE...", "ST2CY5...", 80n);
    const event = mockContract.getEvent(2n);
    expect(event.value.action).toBe("update-provider-reputation");
    expect(event.value.score).toBe(80n);
  });
});