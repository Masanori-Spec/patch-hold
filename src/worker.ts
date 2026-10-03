import { solve } from "./solver.ts";
// The UI cancels by terminating this worker; no shared state or network exists.
self.onmessage = (event: MessageEvent) => {
  const { id, project, budget } = event.data;
  try {
    self.postMessage({ id, result: solve(project, budget) });
  } catch {
    self.postMessage({
      id,
      error: "Internal planning error; no exports were produced.",
    });
  }
};
