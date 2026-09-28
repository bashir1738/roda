/**
 * Full-flow smoke test against devnet: vaults, circles, usernames.
 * Usage: node scripts/smoke-devnet.js
 */
const path = require("path");
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  transfer: tokenTransfer,
} = require("@solana/spl-token");
const anchor = require("@anchor-lang/core");

const IDL = require("../target/idl/roda_vault.json");
const PROGRAM_ID = new PublicKey(IDL.address);
const { mint: MINT } = require("./devnet-state.json");

const USDC = (n) => n * 10 ** 6;
const pda = (seeds) =>
  PublicKey.findProgramAddressSync(seeds.map((s) => (Buffer.isBuffer(s) ? s : Buffer.from(s))), PROGRAM_ID)[0];
const ata = (mint, owner) => getAssociatedTokenAddressSync(mint, owner, true);

let passed = 0;
let failed = 0;
function check(label, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
}
async function expectError(label, promise, needle) {
  try {
    await promise;
    failed++;
    console.log(`  ✗ ${label} — expected error containing "${needle}", but succeeded`);
  } catch (e) {
    const msg = String(e.errorCode?.code || e.message || e);
    if (msg.includes(needle)) {
      passed++;
      console.log(`  ✓ ${label} — ${needle}`);
    } else {
      failed++;
      console.log(`  ✗ ${label} — wrong error: ${msg.slice(0, 160)}`);
    }
  }
}

async function main() {
  const connection = new Connection(process.env.CLUSTER_URL || "https://api.devnet.solana.com", "confirmed");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(require("fs").readFileSync(path.join(process.env.HOME, ".config/solana/id.json"), "utf8")))
  );
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), { commitment: "confirmed" });
  const program = new anchor.Program(IDL, provider);
  const mint = new PublicKey(MINT);
  const myAta = ata(mint, payer.publicKey);
  const cfg = pda([Buffer.from("roda_config")]);

  const friend = Keypair.generate();
  // fund friend: SOL for fees + USDC for contributions
  const solTx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: friend.publicKey, lamports: 0.02 * LAMPORTS_PER_SOL })
  );
  await provider.sendAndConfirm(solTx);
  const friendAta = (await getOrCreateAssociatedTokenAccount(connection, payer, mint, friend.publicKey)).address;
  await tokenTransfer(connection, payer, myAta, friendAta, payer, BigInt(USDC(30)));
  const friendProgram = new anchor.Program(IDL, new anchor.AnchorProvider(connection, new anchor.Wallet(friend), { commitment: "confirmed" }));
  console.log(`payer:  ${payer.publicKey.toBase58()}`);
  console.log(`friend: ${friend.publicKey.toBase58()}\n`);

  // ── VAULTS ─────────────────────────────────────────────────────────────────
  console.log("VAULTS");
  const flexVault = pda([Buffer.from("roda_vault"), payer.publicKey.toBuffer(), Buffer.from([0,0,0,0,0,0,0,0])]);
  await program.methods
    .createVault({ flex: {} })
    .accounts({
      config: cfg.toBase58(),
      vault: flexVault.toBase58(),
      tokenMint: mint.toBase58(),
      vaultAuthority: pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()]).toBase58(),
      vaultTokenAccount: ata(mint, pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()])).toBase58(),
      owner: payer.publicKey.toBase58(),
    })
    .rpc();
  let v = await program.account.userVault.fetch(flexVault);
  check("create_vault(Flex) → vault_id 0", v.vaultId.toString() === "0" && v.active);

  await program.methods
    .deposit(new anchor.BN(USDC(25)))
    .accounts({
      config: cfg.toBase58(),
      vault: flexVault.toBase58(),
      vaultAuthority: pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()]).toBase58(),
      tokenMint: mint.toBase58(),
      userTokenAccount: myAta.toBase58(),
      vaultTokenAccount: ata(mint, pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()])).toBase58(),
      owner: payer.publicKey.toBase58(),
    })
    .rpc();
  v = await program.account.userVault.fetch(flexVault);
  check("deposit 25 USDC → balance tracked", v.balance.toString() === String(USDC(25)));

  await program.methods
    .withdraw(new anchor.BN(USDC(10)))
    .accounts({
      config: cfg.toBase58(),
      vault: flexVault.toBase58(),
      vaultAuthority: pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()]).toBase58(),
      tokenMint: mint.toBase58(),
      userTokenAccount: myAta.toBase58(),
      vaultTokenAccount: ata(mint, pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()])).toBase58(),
      owner: payer.publicKey.toBase58(),
    })
    .rpc();
  v = await program.account.userVault.fetch(flexVault);
  check("withdraw 10 USDC → balance 15", v.balance.toString() === String(USDC(15)));

  // second vault — proves vault_count increments (old bug: stuck at 0)
  const weeklyVault = pda([Buffer.from("roda_vault"), payer.publicKey.toBuffer(), Buffer.from([1,0,0,0,0,0,0,0])]);
  await program.methods
    .createVault({ weekly: {} })
    .accounts({
      config: cfg.toBase58(),
      vault: weeklyVault.toBase58(),
      tokenMint: mint.toBase58(),
      vaultAuthority: pda([Buffer.from("roda_vault_auth"), weeklyVault.toBuffer()]).toBase58(),
      vaultTokenAccount: ata(mint, pda([Buffer.from("roda_vault_auth"), weeklyVault.toBuffer()])).toBase58(),
      owner: payer.publicKey.toBase58(),
    })
    .rpc();
  v = await program.account.userVault.fetch(weeklyVault);
  check("create_vault(Weekly) → vault_id 1 (counter works)", v.vaultId.toString() === "1");

  const weeklyDeposit = async () =>
    program.methods
      .deposit(new anchor.BN(USDC(10)))
      .accounts({
        config: cfg.toBase58(),
        vault: weeklyVault.toBase58(),
        vaultAuthority: pda([Buffer.from("roda_vault_auth"), weeklyVault.toBuffer()]).toBase58(),
        tokenMint: mint.toBase58(),
        userTokenAccount: myAta.toBase58(),
        vaultTokenAccount: ata(mint, pda([Buffer.from("roda_vault_auth"), weeklyVault.toBuffer()])).toBase58(),
        owner: payer.publicKey.toBase58(),
      })
      .rpc();
  await weeklyDeposit();
  v = await program.account.userVault.fetch(weeklyVault);
  check("weekly deposit → maturity_ts set", Number(v.maturityTs) > 0);

  await expectError(
    "withdraw before maturity rejected",
    program.methods
      .withdraw(new anchor.BN(USDC(5)))
      .accounts({
        config: cfg.toBase58(),
        vault: weeklyVault.toBase58(),
        vaultAuthority: pda([Buffer.from("roda_vault_auth"), weeklyVault.toBuffer()]).toBase58(),
        tokenMint: mint.toBase58(),
        userTokenAccount: myAta.toBase58(),
        vaultTokenAccount: ata(mint, pda([Buffer.from("roda_vault_auth"), weeklyVault.toBuffer()])).toBase58(),
        owner: payer.publicKey.toBase58(),
      })
      .rpc(),
    "VaultNotMatured"
  );

  // drain + close flex vault
  await program.methods
    .withdraw(new anchor.BN(USDC(15)))
    .accounts({
      config: cfg.toBase58(),
      vault: flexVault.toBase58(),
      vaultAuthority: pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()]).toBase58(),
      tokenMint: mint.toBase58(),
      userTokenAccount: myAta.toBase58(),
      vaultTokenAccount: ata(mint, pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()])).toBase58(),
      owner: payer.publicKey.toBase58(),
    })
    .rpc();
  await program.methods
    .closeVault()
    .accounts({
      config: cfg.toBase58(),
      vault: flexVault.toBase58(),
      vaultAuthority: pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()]).toBase58(),
      vaultTokenAccount: ata(mint, pda([Buffer.from("roda_vault_auth"), flexVault.toBuffer()])).toBase58(),
      owner: payer.publicKey.toBase58(),
    })
    .rpc();
  const closed = await connection.getAccountInfo(flexVault);
  check("close_vault → account gone", closed === null);

  // ── CIRCLES ────────────────────────────────────────────────────────────────
  console.log("\nCIRCLES");
  const circleId = 0;
  const circle = pda([Buffer.from("roda_circle"), Buffer.from([0,0,0,0,0,0,0,0])]);
  const circleAuth = pda([Buffer.from("roda_circle_auth"), circle.toBuffer()]);
  const circleAta = ata(mint, circleAuth);

  await program.methods
    .createCircle("Test Susu", 2, new anchor.BN(USDC(10)), new anchor.BN(600))
    .accounts({
      config: cfg.toBase58(),
      circle: circle.toBase58(),
      creatorMember: pda([Buffer.from("roda_member"), circle.toBuffer(), payer.publicKey.toBuffer()]).toBase58(),
      circleAuthority: circleAuth.toBase58(),
      tokenMint: mint.toBase58(),
      circleTokenAccount: circleAta.toBase58(),
      creator: payer.publicKey.toBase58(),
    })
    .rpc();
  let c = await program.account.circle.fetch(circle);
  check("create_circle → id 0, 1 member, Active", c.id.toString() === "0" && c.memberCount === 1 && (c.status.active !== undefined || c.status === 0));

  await friendProgram.methods
    .joinCircle(new anchor.BN(circleId))
    .accounts({
      circle: circle.toBase58(),
      memberAccount: pda([Buffer.from("roda_member"), circle.toBuffer(), friend.publicKey.toBuffer()]).toBase58(),
      member: friend.publicKey.toBase58(),
    })
    .rpc();
  c = await program.account.circle.fetch(circle);
  check("join_circle → 2 members", c.memberCount === 2);

  const contributeFrom = async (kp, prog) =>
    prog.methods
      .contribute(new anchor.BN(USDC(10)))
      .accounts({
        config: cfg.toBase58(),
        circle: circle.toBase58(),
        memberAccount: pda([Buffer.from("roda_member"), circle.toBuffer(), kp.publicKey.toBuffer()]).toBase58(),
        circleAuthority: circleAuth.toBase58(),
        tokenMint: mint.toBase58(),
        userTokenAccount: ata(mint, kp.publicKey).toBase58(),
        circleTokenAccount: circleAta.toBase58(),
        owner: kp.publicKey.toBase58(),
      })
      .rpc();

  await contributeFrom(payer, program);
  await contributeFrom(friend, friendProgram);
  c = await program.account.circle.fetch(circle);
  const treasury = await getAccount(connection, circleAta);
  check(
    "both contributed → pool 20 USDC, paid 2/2",
    c.poolBalance.toString() === String(USDC(20)) && c.paidCount === 2 && Number(treasury.amount) === USDC(20)
  );

  // round 0 recipient = members[0] = payer; friend must be rejected
  const friendClaim = () =>
    friendProgram.methods
      .claimPayout()
      .accounts({
        config: cfg.toBase58(),
        circle: circle.toBase58(),
        circleAuthority: circleAuth.toBase58(),
        tokenMint: mint.toBase58(),
        recipientTokenAccount: ata(mint, friend.publicKey).toBase58(),
        circleTokenAccount: circleAta.toBase58(),
        recipient: friend.publicKey.toBase58(),
      })
      .rpc();
  await expectError("non-recipient claim rejected", friendClaim(), "NotYourPayout");

  const payerClaim = () =>
    program.methods
      .claimPayout()
      .accounts({
        config: cfg.toBase58(),
        circle: circle.toBase58(),
        circleAuthority: circleAuth.toBase58(),
        tokenMint: mint.toBase58(),
        recipientTokenAccount: myAta.toBase58(),
        circleTokenAccount: circleAta.toBase58(),
        recipient: payer.publicKey.toBase58(),
      })
      .rpc();
  const payerBalBefore = Number((await getAccount(connection, myAta)).amount);
  await payerClaim();
  const payerBalAfter = Number((await getAccount(connection, myAta)).amount);
  c = await program.account.circle.fetch(circle);
  check(
    "payer claims round 0 → +20 USDC, round advanced",
    payerBalAfter - payerBalBefore === USDC(20) && c.currentRound === 1 && c.paidCount === 0
  );

  // round 1: both contribute, friend (round 1 recipient) claims → Completed
  await contributeFrom(payer, program);
  await contributeFrom(friend, friendProgram);
  const friendBalBefore = Number((await getAccount(connection, friendAta)).amount);
  await friendProgram.methods
    .claimPayout()
    .accounts({
      config: cfg.toBase58(),
      circle: circle.toBase58(),
      circleAuthority: circleAuth.toBase58(),
      tokenMint: mint.toBase58(),
      recipientTokenAccount: friendAta.toBase58(),
      circleTokenAccount: circleAta.toBase58(),
      recipient: friend.publicKey.toBase58(),
    })
    .rpc();
  const friendBalAfter = Number((await getAccount(connection, friendAta)).amount);
  c = await program.account.circle.fetch(circle);
  const statusDone = c.status.completed !== undefined || c.status === 1;
  check(
    "friend claims round 1 → +20 USDC, circle Completed",
    friendBalAfter - friendBalBefore === USDC(20) && statusDone
  );

  const late = Keypair.generate();
  await provider.sendAndConfirm(
    new Transaction().add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: late.publicKey, lamports: 0.01 * LAMPORTS_PER_SOL })
    )
  );
  await expectError(
    "join after completion rejected",
    program.methods
      .joinCircle(new anchor.BN(circleId))
      .accounts({
        circle: circle.toBase58(),
        memberAccount: pda([Buffer.from("roda_member"), circle.toBuffer(), late.publicKey.toBuffer()]).toBase58(),
        member: late.publicKey.toBase58(),
      })
      .signers([late])
      .rpc(),
    "CircleNotJoinable"
  );

  await program.methods
    .closeCircle()
    .accounts({
      circle: circle.toBase58(),
      circleAuthority: circleAuth.toBase58(),
      circleTokenAccount: circleAta.toBase58(),
      creator: payer.publicKey.toBase58(),
    })
    .rpc();
  check("close_circle → account gone", (await connection.getAccountInfo(circle)) === null);

  // ── USERNAMES ──────────────────────────────────────────────────────────────
  console.log("\nUSERNAMES");
  const claimName = (prog, kp, name, oldRecord = null) =>
    prog.methods
      .claimName(name)
      .accounts({
        profile: pda([Buffer.from("roda_profile"), kp.publicKey.toBuffer()]).toBase58(),
        nameRecord: pda([Buffer.from("roda_name"), Buffer.from(name)]).toBase58(),
        oldNameRecord: oldRecord ? oldRecord.toBase58() : null,
        owner: kp.publicKey.toBase58(),
      })
      .rpc();

  await claimName(program, payer, "alice");
  let profile = await program.account.nameProfile.fetch(pda([Buffer.from("roda_profile"), payer.publicKey.toBuffer()]));
  check("claim_name(alice) → profile set", profile.name === "alice");

  await expectError("name taken by other wallet", claimName(friendProgram, friend, "alice"), "NameTaken");
  await expectError("rename during cooldown", claimName(program, payer, "alice2"), "CooldownActive");
  await expectError("invalid chars rejected", claimName(program, payer, "ALICE!"), "InvalidNameChars");

  const aliceRecord = pda([Buffer.from("roda_name"), Buffer.from("alice")]);
  await program.methods
    .releaseName()
    .accounts({
      profile: pda([Buffer.from("roda_profile"), payer.publicKey.toBuffer()]).toBase58(),
      nameRecord: aliceRecord.toBase58(),
      owner: payer.publicKey.toBase58(),
    })
    .rpc();
  check("release_name → record closed", (await connection.getAccountInfo(aliceRecord)) === null);

  // friend's profile is fresh → can take the released name immediately
  await claimName(friendProgram, friend, "alice");
  profile = await program.account.nameProfile.fetch(pda([Buffer.from("roda_profile"), friend.publicKey.toBuffer()]));
  check("released name claimable by another wallet", profile.name === "alice");

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
