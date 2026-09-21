import { Container, Section, Eyebrow } from "./ui";
import { ClaimUsername } from "./ClaimUsername";

export function UsernameSection() {
  return (
    <Section id="username" className="bg-white">
      <Container>
        <div className="mx-auto mb-14 max-w-lg text-center">
          <Eyebrow>On-chain identity</Eyebrow>
          <h2 className="mt-5 text-[2rem] font-semibold leading-[1.15] tracking-tight text-charcoal sm:text-4xl">
            Claim your Roda name
          </h2>
          <p className="mt-5 text-[15px] leading-7 text-muted">
            One name, tied to your wallet. It shows on every circle, payout, and
            member row.
          </p>
        </div>

        <ClaimUsername />

        <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {[
            "Visible to members",
            "Unique",
            "Change anytime (24h cooldown)",
            "Gas only",
          ].map((f) => (
            <li key={f} className="text-[13px] text-muted">
              {f}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
