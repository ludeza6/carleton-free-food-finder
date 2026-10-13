import { socialAccounts } from "../collectors/social/accounts";
import { collectAllSocialEvents } from "../collectors/social/collect-all";

async function main() {
  if (!socialAccounts.bluesky.length) {
    console.log("No Bluesky accounts configured. Add verified public handles to collectors/social/accounts.ts.");
    return;
  }
  console.log(JSON.stringify(await collectAllSocialEvents(), null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
