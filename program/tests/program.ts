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
const CIRCLE_SEED = Buffer.from("roda_circle");
const CIRCLE_AUTHORITY_SEED = Buffer.from("roda_circle_auth");
const MEMBER_SEED = Buffer.from("roda_member");

const u64le = (n: number) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

const BN: any = (anchor as any).default?.BN ?? (anchor as any).BN;

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

  describe("circles", () => {
    const circlePda = (code: number) => pda([CIRCLE_SEED, u64le(code)]);

    const createCircle = async (code: number) => {
      const config: any = await program.account.rodaConfig.fetch(configPda);
      const circle = circlePda(code);
      const authority = pda([CIRCLE_AUTHORITY_SEED, circle.toBuffer()]);
      return program.methods
        .createCircle(
          new BN(code),
          "Test Circle",
          2,
          new BN(1_000_000),
          new BN(600)
        )
        .accountsPartial({
          config: configPda,
          circle,
          creatorMember: pda([
            MEMBER_SEED,
            circle.toBuffer(),
            admin.publicKey.toBuffer(),
          ]),
          circleAuthority: authority,
          tokenMint: config.usdcMint,
          circleTokenAccount: getAssociatedTokenAddressSync(
            config.usdcMint,
            authority,
            true
          ),
          creator: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    };

    it("creates a circle with a 6-digit code as its id", async () => {
      await createCircle(483920);

      const circle: any = await program.account.circle.fetch(circlePda(483920));
      assert.equal(circle.id.toString(), "483920");
      assert.equal(circle.memberCount, 1);

      const config: any = await program.account.rodaConfig.fetch(configPda);
      assert.equal(config.circleCount.toNumber(), 1);
    });

    it("rejects codes outside 100000-999999", async () => {
      await expectErrorCode(createCircle(99_999), "InvalidCircleCode");
      await expectErrorCode(createCircle(1_000_000), "InvalidCircleCode");
    });

    it("never reuses a circle code", async () => {
      let message = "";
      try {
        await createCircle(483920);
      } catch (e: any) {
        message = String(e?.error?.errorCode?.code ?? e?.errorCode?.code ?? e?.errorMessage ?? e?.message ?? e);
      }
      assert.match(message, /already in use|AccountAlreadyInUse/i);
    });
  });
});
