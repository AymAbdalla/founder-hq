import { FakeGitHub } from "../support/fake-github";

// Starts the one fake GitHub that the whole browser test run shares; returns its stop step.
export default async function globalSetup() {
  const fake = new FakeGitHub();
  await fake.start();
  return () => fake.stop();
}
