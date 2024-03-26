import type { LoaderArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";

export async function loader(args: LoaderArgs) {
  // console.log("readConfig");
  // console.log(readConfig);
  const counter = args.context.COUNTER as DurableObjectNamespace;
  try {
    return await counter.get(counter.idFromName("counter")).fetch(args.request);
  } catch (err) {
    return json({ error: err });
  }
}
