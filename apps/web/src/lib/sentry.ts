export { isSentryEnabled } from "@haccp/shared";

export function getTracePropagationTargets(): Array<string | RegExp> {
  const targets: Array<string | RegExp> = [/^\//];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return targets;
  }

  try {
    const { host } = new URL(apiUrl);
    targets.push(host);
  } catch {
  }

  return targets;
}
