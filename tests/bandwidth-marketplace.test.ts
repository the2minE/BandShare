import { describe, it, expect, beforeEach } from "vitest";

// Mock contract state and functions
interface BandwidthMarketplaceState {
  admin: string;
  paused: boolean;
  tokenContract: string;
  accessControlContract: string;
  offers: Map<string, { amount: bigint; active: boolean }>;
  providerOffers: Map<string, bigint[]>;
  consumptions: Map<string, { amount: bigint; timestamp: bigint }>;
  events: Map<bigint, { action: string; initiator: string; provider: string; offerId: bigint; amount: bigint; timestamp: bigint }>;
  lastEventId: bigint;
  RATE_PER_MB: bigint;
  MIN_BANDWIDTH: bigint;
}

const mockContract: BandwidthMarketplaceState & {
  isAdmin(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setTokenContract(caller: string, contract: string): { value: boolean } | { error: number };
  setAccessControlContract(caller: string, contract: string): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  offerBandwidth(caller: string, amount: bigint, offerId: bigint): { value: boolean } | { error: number };
  cancelOffer(caller: string, offerId: bigint): { value: boolean } | { error: number };
  consumeBandwidth(caller: string, provider: string, offerId: bigint, amount: bigint, mockTokenTransfer: (from: string, to: string, amount: bigint) => { value: boolean } | { error: number }, mockGrantAccess: (consumer: string, provider: string) => { value: boolean } | { error: number }): { value: boolean } | { error: number };
  getOffer(provider: string, offerId: bigint): { value: { amount: bigint; active: boolean } };
  getProviderOffers(provider: string): { value: bigint[] };
  getConsumption(consumer: string, provider: string, offerId: bigint): { value: { amount: bigint; timestamp: bigint } };
  getAdmin(): { value: string };
  isPaused(): { value: boolean };
  getTokenContract(): { value: string };
  getAccessControlContract(): { value: string };
  getEvent(eventId: bigint): { value: { action: string; initiator: string; provider: string; offerId: bigint; amount: bigint; timestamp: bigint } };
} = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  tokenContract: "SP000000000000000000002Q6VF78",
  accessControlContract: "SP000000000000000000002Q6VF78",
  offers: new Map(),
  providerOffers: new Map(),
  consumptions: new Map(),
  events: new Map(),
  lastEventId: 0n,
  RATE_PER_MB: 1000000n,
  MIN_BANDWIDTH: 100n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 200 };
    this.paused = pause;
    this.events.set(++this.lastEventId, { action: pause ? "pause" : "unpause", initiator: caller, provider: caller, offerId: 0n, amount: 0n, timestamp: 100n });
    return { value: pause };
  },

  setTokenContract(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 200 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 204 };
    this.tokenContract = contract;
    this.events.set(++this.lastEventId, { action: "set-token-contract", initiator: caller, provider: contract, offerId: 0n, amount: 0n, timestamp: 100n });
    return { value: true };
  },

  setAccessControlContract(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 200 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 204 };
    this.accessControlContract = contract;
    this.events.set(++this.lastEventId, { action: "set-access-control", initiator: caller, provider: contract, offerId: 0n, amount: 0n, timestamp: 100n });
    return { value: true };
  },

  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 200 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 204 };
    this.admin = newAdmin;
    this.events.set(++this.lastEventId, { action: "transfer-admin", initiator: caller, provider: newAdmin, offerId: 0n, amount: 0n, timestamp: 100n });
    return { value: true };
  },

  offerBandwidth(caller: string, amount: bigint, offerId: bigint) {
    if (this.paused) return { error: 203 };
    if (amount <= this.MIN_BANDWIDTH) return { error: 202 };
    const key = `${caller}:${offerId}`;
    if (this.offers.has(key)) return { error: 206 };
    this.offers.set(key, { amount, active: true });
    const currentOffers = this.providerOffers.get(caller) || [];
    this.providerOffers.set(caller, [...currentOffers, offerId].slice(0, 100));
    this.events.set(++this.lastEventId, { action: "offer-bandwidth", initiator: caller, provider: caller, offerId, amount, timestamp: 100n });
    return { value: true };
  },

  cancelOffer(caller: string, offerId: bigint) {
    if (this.paused) return { error: 203 };
    const key = `${caller}:${offerId}`;
    const offer = this.offers.get(key);
    if (!offer || !offer.active) return { error: 207 };
    this.offers.set(key, { amount: offer.amount, active: false });
    this.events.set(++this.lastEventId, { action: "cancel-offer", initiator: caller, provider: caller, offerId, amount: offer.amount, timestamp: 100n });
    return { value: true };
  },

  consumeBandwidth(caller: string, provider: string, offerId: bigint, amount: bigint, mockTokenTransfer: (from: string, to: string, amount: bigint) => { value: boolean } | { error: number }, mockGrantAccess: (consumer: string, provider: string) => { value: boolean } | { error: number }) {
    if (this.paused) return { error: 203 };
    if (provider === "SP000000000000000000002Q6VF78") return { error: 204 };
    if (amount <= 0n) return { error: 202 };
    if (this.tokenContract === "SP000000000000000000002Q6VF78") return { error: 205 };
    if (this.accessControlContract === "SP000000000000000000002Q6VF78") return { error: 205 };
    const key = `${provider}:${offerId}`;
    const offer = this.offers.get(key);
    if (!offer || !offer.active) return { error: 207 };
    if (offer.amount < amount) return { error: 201 };
    const cost = amount * this.RATE_PER_MB;
    const tokenResult = mockTokenTransfer(caller, provider, cost);
    if ("error" in tokenResult) return tokenResult;
    const accessResult = mockGrantAccess(caller, provider);
    if ("error" in accessResult) return accessResult;
    this.offers.set(key, { amount: offer.amount - amount, active: true });
    this.consumptions.set(`${caller}:${provider}:${offerId}`, { amount, timestamp: 100n });
    this.events.set(++this.lastEventId, { action: "consume-bandwidth", initiator: caller, provider, offerId, amount, timestamp: 100n });
    return { value: true };
  },

  getOffer(provider: string, offerId: bigint) {
    return { value: this.offers.get(`${provider}:${offerId}`) || { amount: 0n, active: false } };
  },

  getProviderOffers(provider: string) {
    return { value: this.providerOffers.get(provider) || [] };
  },

  getConsumption(consumer: string, provider: string, offerId: bigint) {
    return { value: this.consumptions.get(`${consumer}:${provider}:${offerId}`) || { amount: 0n, timestamp: 0n } };
  },

  getAdmin() {
    return { value: this.admin };
  },

  isPaused() {
    return { value: this.paused };
  },

  getTokenContract() {
    return { value: this.tokenContract };
  },

  getAccessControlContract() {
    return { value: this.accessControlContract };
  },

  getEvent(eventId: bigint) {
    return {
      value: this.events.get(eventId) || {
        action: "",
        initiator: "SP000000000000000000002Q6VF78",
        provider: "SP000000000000000000002Q6VF78",
        offerId: 0n,
        amount: 0n,
        timestamp: 0n,
      },
    };
  },
};

describe("Bandwidth Marketplace Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.tokenContract = "SP000000000000000000002Q6VF78";
    mockContract.accessControlContract = "SP000000000000000000002Q6VF78";
    mockContract.offers = new Map();
    mockContract.providerOffers = new Map();
    mockContract.consumptions = new Map();
    mockContract.events = new Map();
    mockContract.lastEventId = 0n;
  });

  const mockTokenTransfer = (from: string, to: string, amount: bigint) => ({ value: true });
  const mockGrantAccess = (consumer: string, provider: string) => ({ value: true });

  it("should allow admin to set token contract", () => {
    const result = mockContract.setTokenContract(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.tokenContract).toBe("ST2CY5...");
    expect(mockContract.events.get(1n)?.action).toBe("set-token-contract");
  });

  it("should prevent non-admin from setting token contract", () => {
    const result = mockContract.setTokenContract("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 200 });
  });

  it("should prevent setting zero address as token contract", () => {
    const result = mockContract.setTokenContract(mockContract.admin, "SP000000000000000000002Q6VF78");
    expect(result).toEqual({ error: 204 });
  });

  it("should allow admin to set access control contract", () => {
    const result = mockContract.setAccessControlContract(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.accessControlContract).toBe("ST3NB...");
    expect(mockContract.events.get(1n)?.action).toBe("set-access-control");
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
    expect(result).toEqual({ error: 200 });
  });

  it("should allow offering bandwidth", () => {
    const result = mockContract.offerBandwidth("ST2CY5...", 1000n, 1n);
    expect(result).toEqual({ value: true });
    expect(mockContract.offers.get("ST2CY5...:1")?.amount).toBe(1000n);
    expect(mockContract.offers.get("ST2CY5...:1")?.active).toBe(true);
    expect(mockContract.providerOffers.get("ST2CY5...")).toEqual([1n]);
    expect(mockContract.events.get(1n)?.action).toBe("offer-bandwidth");
  });

  it("should prevent offering bandwidth below minimum", () => {
    const result = mockContract.offerBandwidth("ST2CY5...", 50n, 1n);
    expect(result).toEqual({ error: 202 });
  });

  it("should prevent offering duplicate offer ID", () => {
    mockContract.offerBandwidth("ST2CY5...", 1000n, 1n);
    const result = mockContract.offerBandwidth("ST2CY5...", 2000n, 1n);
    expect(result).toEqual({ error: 206 });
  });

  it("should allow canceling an offer", () => {
    mockContract.offerBandwidth("ST2CY5...", 1000n, 1n);
    const result = mockContract.cancelOffer("ST2CY5...", 1n);
    expect(result).toEqual({ value: true });
    expect(mockContract.offers.get("ST2CY5...:1")?.active).toBe(false);
    expect(mockContract.events.get(2n)?.action).toBe("cancel-offer");
  });

  it("should prevent canceling non-existent offer", () => {
    const result = mockContract.cancelOffer("ST2CY5...", 1n);
    expect(result).toEqual({ error: 207 });
  });

  it("should prevent consuming bandwidth when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const result = mockContract.consumeBandwidth("ST3NB...", "ST2CY5...", 1n, 500n, mockTokenTransfer, mockGrantAccess);
    expect(result).toEqual({ error: 203 });
  });

  it("should prevent consuming with zero amount", () => {
    mockContract.setTokenContract(mockContract.admin, "ST5TOKEN...");
    mockContract.setAccessControlContract(mockContract.admin, "ST6ACCESS...");
    const result = mockContract.consumeBandwidth("ST3NB...", "ST2CY5...", 1n, 0n, mockTokenTransfer, mockGrantAccess);
    expect(result).toEqual({ error: 202 });
  });

  it("should prevent consuming with unset token contract", () => {
    mockContract.offerBandwidth("ST2CY5...", 1000n, 1n);
    const result = mockContract.consumeBandwidth("ST3NB...", "ST2CY5...", 1n, 500n, mockTokenTransfer, mockGrantAccess);
    expect(result).toEqual({ error: 205 });
  });

  it("should return correct offer data", () => {
    mockContract.offerBandwidth("ST2CY5...", 1000n, 1n);
    const result = mockContract.getOffer("ST2CY5...", 1n);
    expect(result).toEqual({ value: { amount: 1000n, active: true } });
  });

  it("should return correct provider offers", () => {
    mockContract.offerBandwidth("ST2CY5...", 1000n, 1n);
    const result = mockContract.getProviderOffers("ST2CY5...");
    expect(result).toEqual({ value: [1n] });
  });

  it("should return correct consumption data", () => {
    mockContract.setTokenContract(mockContract.admin, "ST5TOKEN...");
    mockContract.setAccessControlContract(mockContract.admin, "ST6ACCESS...");
    mockContract.offerBandwidth("ST2CY5...", 1000n, 1n);
    mockContract.consumeBandwidth("ST3NB...", "ST2CY5...", 1n, 500n, mockTokenTransfer, mockGrantAccess);
    const result = mockContract.getConsumption("ST3NB...", "ST2CY5...", 1n);
    expect(result).toEqual({ value: { amount: 500n, timestamp: 100n } });
  });

  it("should return correct event data", () => {
    mockContract.offerBandwidth("ST2CY5...", 1000n, 1n);
    const event = mockContract.getEvent(1n);
    expect(event.value.action).toBe("offer-bandwidth");
    expect(event.value.amount).toBe(1000n);
  });
});