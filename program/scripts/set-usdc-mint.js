/**
 * Point RodaConfig at Circle's official devnet USDC mint (admin only).
 *
 * Prerequisite: the upgraded binary (with set_usdc_mint) must be live —
 * run `anchor deploy --provider.cluster devnet` first.
 *
 * Usage: node scripts/set-usdc-mint.js
 * Env:   CLUSTER_URL (default https://api.devnet.solana.com)
 *        USDC_MINT   (override target mint)
 */
const path = require("path");
const fs = require("fs");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const anchor = require("@anchor-lang/core");

const CIRCLE_USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const IDL = require("../target/idl/roda_vault.json");
const PROGRAM_ID = new PublicKey(IDL.address);

function loadKeypair() {
  const p =
    process.env.ANCHOR_WALLET ||
    path.join(process.env.HOME, ".config/solana/id.json");
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")))
  );
}

async function main() {
  const connection = new Connection(
    process.env.CLUSTER_URL || "https://api.devnet.solana.com",
    "confirmed"
  );
  const payer = loadKeypair();
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: "confirmed" }
  );
  const program = new anchor.Program(IDL, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("roda_config")],
    PROGRAM_ID
  );
  const usdcMint = new PublicKey(process.env.USDC_MINT || CIRCLE_USDC_DEVNET);

  const before = await program.account.rodaConfig.fetch(configPda);
  console.log(
    `admin:      ${before.admin.toBase58()} (signer: ${payer.publicKey.toBase58()})`
  );
  console.log(`old mint:   ${before.usdcMint.toBase58()}`);

  if (before.admin.toBase58() !== payer.publicKey.toBase58()) {
    throw new Error("signer is not the config admin");
  }
  if (before.usdcMint.toBase58() === usdcMint.toBase58()) {
    console.log("already on the target mint — nothing to do");
    return;
  }

  const tx = await program.methods
    .setUsdcMint()
    .accountsPartial({
      config: configPda,
      usdcMint,
      admin: payer.publicKey,
    })
    .rpc();

  const after = await program.account.rodaConfig.fetch(configPda);
  console.log(`new mint:   ${after.usdcMint.toBase58()}`);
  console.log(`set_usdc_mint tx: ${tx}`);
  console.log(
    "NOTE: existing circles/vaults hold the old mint and are not migrated (devnet reset)."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
