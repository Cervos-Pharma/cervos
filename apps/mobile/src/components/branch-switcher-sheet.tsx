import { useState } from "react";
import { Host, BottomSheet, Column, Text as UiText, List, ListItem } from "@expo/ui";
import { useMobileSession } from "@/context/session-context";
import { useBrandColors } from "@/theme";

export function BranchSwitcherSheet({
  isPresented,
  onDismiss,
}: {
  isPresented: boolean;
  onDismiss: () => void;
}) {
  const { workspace, canManageAdmin, orgScope, setOrgScope, activeCentre, switchCentre, lang } =
    useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isSw = lang === "SW";
  const centres = workspace?.centres ?? [];

  return (
    <Host seedColor={brand.accent}>
      <BottomSheet
        isPresented={isPresented}
        onDismiss={onDismiss}
        snapPoints={["half"]}
      >
        <Column spacing={10}>
          <UiText textStyle={{ fontSize: 17, fontWeight: "700" }}>
            {isSw ? "Chagua Tawi au Shirika Zima" : "Switch Branch Scope"}
          </UiText>
          <List>
            {canManageAdmin && centres.length > 0 && (
              <ListItem
                supportingText={
                  orgScope === "all"
                    ? isSw ? "Inaonesha matawi yote pamoja" : "Active — combined org totals"
                    : isSw ? "Jumlisha mauzo na stoo zote" : "View combined organization totals"
                }
                onPress={() => {
                  setOrgScope("all");
                  onDismiss();
                }}
              >
                {isSw ? "Matawi Yote (All Branches)" : "All Branches Overview"}
              </ListItem>
            )}
            {centres.map((c) => {
              const isSelected = orgScope === "branch" && c.id === activeCentre?.id;
              return (
                <ListItem
                  key={c.id}
                  supportingText={`${c.region} · ${c.address}${isSelected ? (isSw ? " (Hai)" : " (Active)") : ""}${busyId === c.id ? " ..." : ""}`}
                  onPress={async () => {
                    setBusyId(c.id);
                    try {
                      await switchCentre(c.id);
                      onDismiss();
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {c.name}
                </ListItem>
              );
            })}
          </List>
          <UiText textStyle={{ fontSize: 12, color: brand.staticMuted }}>
            {isSw ? "Kila tawi linatenganisha stoo, mauzo, na soga." : "Inventory, sales & chat stay isolated per branch."}
          </UiText>
        </Column>
      </BottomSheet>
    </Host>
  );
}
