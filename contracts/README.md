# HSCS contracts — production reference

These three Solidity contracts are the **production deployment target** (World B in
the technical roadmap) for the attester-bond / loan-record / slashing mechanism:

| Contract | Responsibility |
|----------|----------------|
| `AttesterRegistry.sol` | Locked attester bonds, accreditation, cooldown withdrawals, resolver-only slashing. |
| `LoanRegistry.sol` | Off-chain fiat loan records + the `reliedOn` HCS sequence numbers that join to World A. `principal` is data, never value. |
| `DisputeResolver.sol` | Post-default fraud challenges; arbiter ruling; uphold ⇒ slash (the incentive-compatibility hinge). |

## PoC status

Per roadmap §13 (**build vs simulate**), the PoC **runtime** implements this exact
logic in TypeScript at [`lib/contracts.ts`](../lib/contracts.ts), persisted in the
JSON store — so the whole system runs on the existing Node/Next.js stack without a
deployed EVM. These `.sol` files mirror that runtime one-to-one and are **not
compiled in the PoC session**.

## Going live (production path)

1. `npm i -D hardhat @openzeppelin/contracts @nomicfoundation/hardhat-toolbox`
2. Point Hardhat at Hedera's JSON-RPC relay (testnet) — lets you reuse the standard
   Solidity/Hardhat/OpenZeppelin workflow.
3. Deploy in order: `AttesterRegistry` → `LoanRegistry` → `DisputeResolver`
   (constructor takes the registry + loan-registry addresses), then
   `registry.grantRole(RESOLVER_ROLE, disputeResolver)`.
4. Swap `lib/contracts.ts` calls for `ethers`/SDK `ContractExecuteTransaction`
   calls to the deployed addresses. The join to World A stays identical: pass HCS
   attestation **sequence numbers** into `issueLoan(...reliedOn)`.

## The two-world rule

A contract **cannot read HCS during execution**. The worlds are joined only by
(a) the attestation sequence numbers written into loan records as data, and
(b) the attester's shared identity across both. The backend is the glue.
