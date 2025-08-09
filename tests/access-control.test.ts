import { describe, it, expect, beforeEach } from "vitest";

// Mock contract state and functions
interface AccessControlState {
  admin: string;
  paused: boolean;
  marketplaceContract: string;
  accessPermissions: Map<string, { granted: boolean; timestamp: bigint }>;
  consumerAccess: Map<string, string[]>;
  events: Map<bigint, { action: string; initiator: string; consumer: string; provider: string; timestamp: bigint }>;
  lastEventId: bigint;
}

const mockContract: AccessControlState & {
  isAdmin(caller: string): boolean;
  isMarketplace(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setMarketplaceContract(caller: string, contract: string): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  grantAccess(caller: string, consumer: string, provider: string): { value: boolean } | { error: number };
  revokeAccess(caller: string, consumer: string, provider: string): { value: boolean } | { error: number };
  hasAccess(consumer: string, provider: string): { value: boolean };
  getConsumerAccess(consumer: string): { value: string[] };
  getAdmin(): { value: string };
  isPaused(): { value: boolean };
  getMarketplaceContract(): { value: string };
  getEvent(eventId: bigint): { value: { action: string; initiator: string; consumer: string; provider: string; timestamp: bigint } };
} = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  marketplaceContract: "SP000000000000000000002Q6VF78",
  accessPermissions: new Map(),
  consumerAccess: new Map(),
  events: new Map(),
  lastEventId: 0n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  isMarketplace(caller: string) {
    return caller === this.marketplaceContract;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 400 };
    this.paused = pause;
    this.events.set(++this.lastEventId, { action: pause ? "pause" : "unpause", initiator: caller, consumer: caller, provider: caller, timestamp: 100n });
    return { value: pause };
  },

  setMarketplaceContract(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 400 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 402 };
    this.marketplaceContract = contract;
    this.events.set(++this.lastEventId, { action: "set-marketplace-contract", initiator: caller, consumer: contract, provider: contract, timestamp: 100n });
    return { value: true };
  },

  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 400 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 402 };
    this.admin = newAdmin;
    this.events.set(++this.lastEventId, { action: "transfer-admin", initiator: caller, consumer: newAdmin, provider: newAdmin, timestamp: 100n });
    return { value: true };
  },

  grantAccess(caller: string, consumer: string, provider: string) {
    if (this.paused) return { error: 401 };
    if (!this.isMarketplace(caller)) return { error: 400 };
    if (consumer === "SP000000000000000000002Q6VF78" || provider === "SP000000000000000000002Q6VF78") return { error: 402 };
    const key = `${consumer}:${provider}`;
    if (this.accessPermissions.get(key)?.granted) return { error: 404 };
    this.accessPermissions.set(key, { granted: true, timestamp: 100n });
    const currentAccess = this.consumerAccess.get(consumer) || [];
    this.consumerAccess.set(consumer, [...currentAccess, provider].slice(0, 100));
    this.events.set(++this.lastEventId, { action: "grant-access", initiator: caller, consumer, provider, timestamp: 100n });
    return { value: true };
  },

  revokeAccess(caller: string, consumer: string, provider: string) {
    if (this.paused) return { error: 401 };
    if (!this.isAdmin(caller) && !this.isMarketplace(caller)) return { error: 400 };
    if (consumer === "SP000000000000000000002Q6VF78" || provider === "SP000000000000000000002Q6VF78") return { error: 402 };
    const key = `${consumer}:${provider}`;
    const permission = this.accessPermissions.get(key);
    if (!permission || !permission.granted) return { error: 405 };
    this.accessPermissions.set(key, { granted: false, timestamp: permission.timestamp });
    this.events.set(++this.lastEventId, { action: "revoke-access", initiator: caller, consumer, provider, timestamp: 100n });
    return { value: true };
  },

  hasAccess(consumer: string, provider: string) {
    return { value: this.accessPermissions.get(`${consumer}:${provider}`)?.granted || false };
  },

  getConsumerAccess(consumer: string) {
    return { value: this.consumerAccess.get(consumer) || [] };
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
        consumer: "SP000000000000000000002Q6VF78",
        provider: "SP000000000000000000002Q6VF78",
        timestamp: 0n,
      },
    };
  },
};

describe("Access Control Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.marketplaceContract = "SP000000000000000000002Q6VF78";
    mockContract.accessPermissions = new Map();
    mockContract.consumerAccess = new Map();
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
    expect(result).toEqual({ error: 400 });
  });

  it("should prevent setting zero address as marketplace contract", () => {
    const result = mockContract.setMarketplaceContract(mockContract.admin, "SP000000000000000000002Q6VF78");
    expect(result).toEqual({ error: 402 });
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
    expect(result).toEqual({ error: 400 });
  });

  it("should allow marketplace to grant access", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.accessPermissions.get("ST2CY5...:ST3NB...")?.granted).toBe(true);
    expect(mockContract.consumerAccess.get("ST2CY5...")).toEqual(["ST3NB..."]);
    expect(mockContract.events.get(2n)?.action).toBe("grant-access");
  });

  it("should prevent non-marketplace from granting access", () => {
    const result = mockContract.grantAccess("ST2CY5...", "ST3NB...", "ST4RE...");
    expect(result).toEqual({ error: 400 });
  });

  it("should prevent granting access when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 401 });
  });

  it("should prevent granting access to zero address", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.grantAccess("ST4RE...", "SP000000000000000000002Q6VF78", "ST3NB...");
    expect(result).toEqual({ error: 402 });
  });

  it("should prevent granting already granted access", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    const result = mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 404 });
  });

  it("should allow marketplace to revoke access", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    const result = mockContract.revokeAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.accessPermissions.get("ST2CY5...:ST3NB...")?.granted).toBe(false);
    expect(mockContract.events.get(3n)?.action).toBe("revoke-access");
  });

  it("should allow admin to revoke access", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    const result = mockContract.revokeAccess(mockContract.admin, "ST2CY5...", "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.accessPermissions.get("ST2CY5...:ST3NB...")?.granted).toBe(false);
    expect(mockContract.events.get(3n)?.action).toBe("revoke-access");
  });

  it("should prevent revoking non-existent access", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    const result = mockContract.revokeAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 405 });
  });

  it("should return correct access status", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    const result = mockContract.hasAccess("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ value: true });
  });

  it("should return correct consumer access list", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    const result = mockContract.getConsumerAccess("ST2CY5...");
    expect(result).toEqual({ value: ["ST3NB..."] });
  });

  it("should return correct event data", () => {
    mockContract.setMarketplaceContract(mockContract.admin, "ST4RE...");
    mockContract.grantAccess("ST4RE...", "ST2CY5...", "ST3NB...");
    const event = mockContract.getEvent(2n);
    expect(event.value.action).toBe("grant-access");
    expect(event.value.consumer).toBe("ST2CY5...");
    expect(event.value.provider).toBe("ST3NB...");
  });
});