import { host, useHostRevision } from "./host";

/**
 * Renders every enabled plugin's contribution to a named slot, in order.
 * Slots used by the shell: "app.page" (routed at /p/<id>), "app.overlay" (always mounted),
 * "settings.section", "library.action", "builder.toolbar".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Slot({ name, ...props }: { name: string } & Record<string, any>) {
  useHostRevision();
  return (
    <>
      {host.slots(name).map((s) => (
        <s.component key={s.id} {...props} />
      ))}
    </>
  );
}

export const useHasSlot = (name: string, id?: string) => {
  useHostRevision();
  return host.slots(name).some((s) => !id || s.id === id);
};
