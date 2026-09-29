import * as anchor from "@anchor-lang/core";
import { Program, Wallet } from "@anchor-lang/core";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";
import type { RodaVault } from "../target/types/roda_vault";

const CONFIG_SEED = Buffer.from("roda_config");
const FAUCET_SEED = Buffer.from("roda_faucet");
const FAUCET_INFO_SEED = Buffer.from("roda_faucet_info");

/** Await a call and assert it failed with the given onchain error code. */
async function expectErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (e: any) {
    const actual = e?.error?.errorCode?.code ?? e?.errorCode?.code ?? e?.code;
    assert.equal(actual, code, `expected ${code}, got ${actual ?? e?.message}`);
    return;
  }
  assert.fail(`expected ${code} but the call succeeded`);
}

describe("roda_vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.roda_vault as Program<RodaVault>;
  const admin = (provider.wallet as Wallet).payer;
  const connection = provider.connection;

  const pda = (seeds: Buffer[]) =>
    PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const configPda = pda([CONFIG_SEED]);
  const faucetAuthorityPda = pda([FAUCET_SEED]);

  /** Fresh 6-decimal mint owned by the admin. */
  const newMint = (decimals = 6) =>
    createMint(connection, admin, admin.publicKey, null, decimals);

  let mintA: PublicKey;
  let mintB: PublicKey;

  before(async () => {
    mintA = await newMint();
    mintB = await newMint();
  });

  it("initializes the config with a 6-decimal mint", async () => {
    await program.methods
      .initializeConfig()
      .accountsPartial({
        config: configPda,
        usdcMint: mintA,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config: any = await program.account.rodaConfig.fetch(configPda);
    assert.equal(config.admin.toBase58(), admin.publicKey.toBase58());
    assert.equal(config.usdcMint.toBase58(), mintA.toBase58());
    assert.equal(config.vaultCount.toNumber(), 0);
    assert.equal(config.circleCount.toNumber(), 0);
  });

  it("rejects set_usdc_mint from a non-admin", async () => {
    const stranger = Keypair.generate();
    const airdrop = await connection.requestAirdrop(
      stranger.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdrop);

    await expectErrorCode(
      program.methods
        .setUsdcMint()
        .accountsPartial({
          config: configPda,
          usdcMint: mintB,
          admin: stranger.publicKey,
        })
        .signers([stranger])
        .rpc(),
      "Unauthorized"
    );

    const config: any = await program.account.rodaConfig.fetch(configPda);
    assert.equal(
      config.usdcMint.toBase58(),
      mintA.toBase58(),
      "config mint must be unchanged"
    );
  });

  it("rejects set_usdc_mint for a mint that is not 6 decimals", async () => {
    const wrongDecimals = await newMint(2);

    await expectErrorCode(
      program.methods
        .setUsdcMint()
        .accountsPartial({
          config: configPda,
          usdcMint: wrongDecimals,
          admin: admin.publicKey,
        })
        .rpc(),
      "InvalidMint"
    );

    const config: any = await program.account.rodaConfig.fetch(configPda);
    assert.equal(
      config.usdcMint.toBase58(),
      mintA.toBase58(),
      "config mint must be unchanged"
    );
  });

  it("lets the admin point the config at a new 6-decimal mint", async () => {
    await program.methods
      .setUsdcMint()
      .accountsPartial({
        config: configPda,
        usdcMint: mintB,
        admin: admin.publicKey,
      })
      .rpc();

    const config: any = await program.account.rodaConfig.fetch(configPda);
    assert.equal(config.usdcMint.toBase58(), mintB.toBase58());
  });

  it("refuses to faucet-mint a mint the faucet does not control", async () => {
    const user = Keypair.generate();
    const airdrop = await connection.requestAirdrop(
      user.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdrop);

    await expectErrorCode(
      program.methods
        .requestUsdc()
        .accountsPartial({
          config: configPda,
          mint: mintB,
          faucetAuthority: faucetAuthorityPda,
          faucetInfo: pda([FAUCET_INFO_SEED, user.publicKey.toBuffer()]),
          userTokenAccount: getAssociatedTokenAddressSync(
            mintB,
            user.publicKey
          ),
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc(),
      "FaucetUnavailable"
    );
  });
});
