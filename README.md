# BandShare

A blockchain-powered decentralized bandwidth sharing network that enables peer-to-peer internet access, allowing users with surplus bandwidth to share it with those in need, incentivized by BandTokens and managed transparently on-chain.

---

## Overview

BandShare is a Web3 platform that addresses the lack of reliable and affordable internet access in underserved areas by creating a decentralized marketplace for bandwidth sharing. Providers offer their unused bandwidth (e.g., Wi-Fi hotspots), and Consumers pay in BandTokens to access it. The platform leverages five smart contracts built with Clarity to ensure secure, transparent, and automated bandwidth allocation, payments, reputation management, access control, and dispute resolution.

The smart contracts are:
1. **BandToken Contract** – Issues and manages BandTokens for payments and incentives.
2. **Bandwidth Marketplace Contract** – Facilitates bandwidth offers and consumption with token payments.
3. **Reputation System Contract** – Tracks reliability scores for Providers and Consumers.
4. **Access Control Contract** – Manages network access permissions for Consumers.
5. **Dispute Resolution Contract** – Handles disputes between Providers and Consumers.

---

## Features

- **Tokenized Bandwidth Sharing**: Providers earn BandTokens by sharing unused bandwidth.
- **Decentralized Marketplace**: Consumers browse and connect to nearby Providers’ networks.
- **Reputation System**: Ensures trust through transparent Provider and Consumer ratings.
- **Automated Access Control**: Smart contracts grant or revoke network access based on payments.
- **Dispute Resolution**: Transparent mechanism for resolving bandwidth quality issues.
- **Scalable and Low-Cost**: Deployed on Stacks (using Clarity) for efficient transactions.
- **Privacy-Focused**: Decentralized model reduces reliance on centralized ISPs.
- **Incentivized Participation**: BandTokens reward reliable Providers and responsible Consumers.

---

## Smart Contracts

### BandToken Contract
- Mints and manages BandTokens (fungible tokens on Stacks).
- Handles token transfers for bandwidth payments.
- Allows token minting for ecosystem bootstrapping (admin-controlled).

### Bandwidth Marketplace Contract
- Registers Providers’ available bandwidth (in MB).
- Enables Consumers to pay for and consume bandwidth.
- Automates BandToken transfers from Consumers to Providers.

### Reputation併

System: Reputation System Contract
- Tracks reliability scores for Providers and Consumers.
- Updates scores based on successful transactions.
- Provides transparent reputation data for trust-building.

### Access Control Contract
- Grants network access to Consumers upon payment.
- Allows Providers to revoke access for misuse.
- Integrates with Bandwidth Marketplace for seamless operation.

### Dispute Resolution Contract
- Allows Consumers to raise disputes over bandwidth quality.
- Admin resolves disputes with refund or dismissal outcomes.
- Transparent dispute logs for accountability.

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started):
   ```bash
   npm install -g @hirosystems/clarinet
   ```
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/bandshare.git
   ```
3. Navigate to the project directory:
   ```bash
   cd bandshare
   ```
4. Run tests:
   ```bash
   clarinet test
   ```
5. Deploy contracts to the Stacks blockchain:
   ```bash
   clarinet deploy
   ```

## Usage

Each smart contract is designed to work independently but integrates to form the BandShare ecosystem. To interact with the platform:
- **Providers**: Register bandwidth via the Bandwidth Marketplace Contract.
- **Consumers**: Browse available bandwidth and pay with BandTokens.
- **Reputation**: Check scores to select reliable Providers or Consumers.
- **Access**: Automatically granted/revoked via the Access Control Contract.
- **Disputes**: Raise issues through the Dispute Resolution Contract.

Refer to individual contract documentation in the `/contracts` folder for detailed function calls and parameters.

## Requirements

- **Stacks Blockchain**: Contracts are written in Clarity for deployment on Stacks.
- **Node.js**: For running tests and deploying contracts.
- **Clarinet**: For local development and testing.
- **Wallet**: A Stacks-compatible wallet (e.g., Hiro Wallet) for interacting with the platform.

## Development

- **Language**: Clarity (Stacks’ smart contract language).
- **Testing**: Use Clarinet for local testing and simulation.
- **Deployment**: Deploy to Stacks mainnet or testnet via Clarinet.
- **Frontend**: Integrate with a web app (e.g., React) for user interaction.
- **Off-Chain**: Implement a lightweight protocol (e.g., VPN or mesh network) for bandwidth sharing.

## License

MIT License

---

## Contributing

Contributions are welcome! Please submit a pull request or open an issue on the [GitHub repository](https://github.com/yourusername/bandshare).

