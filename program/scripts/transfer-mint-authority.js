/**
 * One-off: transfer USDC mint authority to the program's faucet PDA.
 * Idempotent — skips if already transferred.
 * Usage: node scripts/transfer-mint-authority.js
 */
const path = require("path");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const {
  getMint,
  AuthorityType,
  setAuthority,
  getAssociatedTokenAddressSync,
  getAccount,
} = require("@solana/spl-token");
const IDL = require("../target/idl/roda_vault.json");
const PROGRAM_ID = new PublicKey(IDL.address);
const { mint: MINT } = require("./devnet-state.json");

async function main() {
  const connection = new Connection(
    process.env.CLUSTER_URL || "https://api.devnet.solana.com",
    "confirmed"
  );
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        require("fs").readFileSync(
          path.join(process.env.HOME, ".config/solana/id.json"),
          "utf8"
        )
      )
    )
  );
  const faucetPda = PublicKey.findProgramAddressSync(
    [Buffer.from("roda_faucet")],
    PROGRAM_ID
  )[0];
  const mint = new PublicKey(MINT);

  const info = await getMint(connection, mint);
  const current = info.mintAuthority ? info.mintAuthority.toBase58() : null;
  console.log(`mint:            ${mint.toBase58()}`);
  console.log(`mint authority:  ${current}`);
  console.log(`faucet PDA:      ${faucetPda.toBase58()}`);

  if (current === faucetPda.toBase58()) {
    console.log("already transferred — nothing to do");
  } else {
    await setAuthority(
      connection,
      payer,
      mint,
      payer,
      AuthorityType.MintTokens,
      faucetPda
    );
    const after = await getMint(connection, mint);
    console.log(`mint authority → ${after.mintAuthority.toBase58()}`);
    if (after.mintAuthority.toBase58() !== faucetPda.toBase58())
      throw new Error("transfer failed");
  }

  // Verify faucet actually works for a fresh wallet
  const test = Keypair.generate();
  const testAta = getAssociatedTokenAddressSync(mint, test.publicKey);
  console.log(
    `\nfunding test wallet ${test.publicKey.toBase58()} with SOL for the claim…`
  );
  const anchor = require("@anchor-lang/core");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: "confirmed" }
  );
  const program = new anchor.Program(IDL, provider);
  const {
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
  } = require("@solana/web3.js");
  await provider.sendAndConfirm(
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: test.publicKey,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      })
    )
  );

  const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
  const cfg = pda([Buffer.from("roda_config")]);
  const faucetInfo = pda([
    Buffer.from("roda_faucet_info"),
    test.publicKey.toBuffer(),
  ]);

  await program.methods
    .requestUsdc()
    .accounts({
      config: cfg.toBase58(),
      mint: mint.toBase58(),
      faucetAuthority: faucetPda.toBase58(),
      faucetInfo: faucetInfo.toBase58(),
      userTokenAccount: testAta.toBase58(),
      user: test.publicKey.toBase58(),
    })
    .signers([test])
    .rpc();
  const bal = await getAccount(connection, testAta);
  console.log(`faucet claim OK → ${Number(bal.amount) / 1e6} USDC`);

  const testProgram = new anchor.Program(
    IDL,
    new anchor.AnchorProvider(connection, new anchor.Wallet(test), {
      commitment: "confirmed",
    })
  );
  try {
    await testProgram.methods
      .requestUsdc()
      .accounts({
        config: cfg.toBase58(),
        mint: mint.toBase58(),
        faucetAuthority: faucetPda.toBase58(),
        faucetInfo: faucetInfo.toBase58(),
        userTokenAccount: testAta.toBase58(),
        user: test.publicKey.toBase58(),
      })
      .rpc();
    console.log("second claim unexpectedly succeeded");
    process.exit(1);
  } catch (e) {
    const msg = String(e.errorCode?.code || e.message || e);
    if (msg.includes("FaucetCooldown"))
      console.log("second claim correctly rejected → FaucetCooldown");
    else {
      console.log(`second claim failed with wrong error: ${msg.slice(0, 200)}`);
      process.exit(1);
    }
  }
  console.log("\nFAUCET OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
