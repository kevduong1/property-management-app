/** Standard return shape for server actions used by client dialog forms. */
export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export function actionError(error: string): ActionResult {
  return { ok: false, error };
}

/** Wrap a server action body, converting thrown errors into ActionResult. */
export async function runAction(
  fn: () => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    return await fn();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message };
  }
}
