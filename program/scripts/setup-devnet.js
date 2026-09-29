/**
 * Idempotent devnet setup:
 *   1. Creates (or reuses) the Roda USDC mint (6 decimals).
 *   2. Initializes the global RodaConfig PDA with that mint.
 *   3. Mints test USDC to the deployer wallet.
 *
 * Usage: node scripts/setup-devnet.js
 */
const fs = require("fs");
const path = require("path");
const {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require("@solana/spl-token");
const anchor = require("@anchor-lang/core");

const IDL = require("../target/idl/roda_vault.json");
const PROGRAM_ID = new PublicKey(IDL.address);
const STATE_FILE = path.join(__dirname, "devnet-state.json");
const DECIMALS = 6;

function loadKeypair() {
  const p =
    process.env.ANCHOR_WALLET ||
    path.join(process.env.HOME, ".config/solana/id.json");
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")))
  );
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const cluster = process.env.CLUSTER_URL || "https://api.devnet.solana.com";
  const connection = new Connection(cluster, "confirmed");
  const payer = loadKeypair();
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL, provider);

  const balance = await connection.getBalance(payer.publicKey);
  console.log(
    `payer: ${payer.publicKey.toBase58()} (${(
      balance / LAMPORTS_PER_SOL
    ).toFixed(4)} SOL)`
  );

  // ── 1. USDC mint ────────────────────────────────────────────────────────────
  let state = loadState();
  let mint = state.mint ? new PublicKey(state.mint) : null;
  if (mint) {
    const info = await connection.getAccountInfo(mint);
    if (!info) {
      console.log(`stale mint ${mint.toBase58()} — recreating`);
      mint = null;
    }
  }
  if (!mint) {
    console.log("creating USDC mint…");
    mint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
    state.mint = mint.toBase58();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`mint: ${mint.toBase58()}`);
  } else {
    console.log(`reusing mint: ${mint.toBase58()}`);
  }

  // ── 2. RodaConfig PDA ───────────────────────────────────────────────────────
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("roda_config")],
    PROGRAM_ID
  );
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    console.log("initializing RodaConfig…");
    const tx = await program.methods
      .initializeConfig()
      .accounts({
        usdcMint: mint.toBase58(),
        admin: payer.publicKey.toBase58(),
      })
      .rpc();
    console.log(`initialize_config: ${tx}`);
  } else {
    console.log(`RodaConfig already initialized: ${configPda.toBase58()}`);
  }

  // ── 3. Test USDC to deployer ────────────────────────────────────────────────
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  const before = Number(
    await connection
      .getTokenAccountBalance(ata.address)
      .then((b) => b.value.amount)
  );
  if (before < 1_000 * 10 ** DECIMALS) {
    const amount = 100_000n * BigInt(10 ** DECIMALS);
    await mintTo(connection, payer, mint, ata.address, payer, amount);
    const after = await connection.getTokenAccountBalance(ata.address);
    console.log(
      `minted USDC → ${ata.address.toBase58()} (balance: ${
        after.value.uiAmountString
      })`
    );
  } else {
    console.log(
      `deployer USDC balance: ${(before / 10 ** DECIMALS).toFixed(2)}`
    );
  }

  console.log("\nSETUP OK");
  console.log(
    JSON.stringify(
      {
        ...state,
        config: configPda.toBase58(),
        program: PROGRAM_ID.toBase58(),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
