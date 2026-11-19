import { useMemo } from "react";
import { View } from "react-native";
import { generateQrMatrix } from "@/utils/qr-matrix";

export function QrMatrixView({
  value,
  moduleSize = 4,
}: {
  value: string;
  moduleSize?: number;
}) {
  const matrix = useMemo(() => generateQrMatrix(value), [value]);
  const n = matrix.length;
  const totalPx = n * moduleSize;

  return (
    <View
      style={{
        padding: moduleSize * 2,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        alignSelf: "center",
      }}
    >
      <View style={{ width: totalPx, height: totalPx }}>
        {matrix.map((row, r) => {
          const runs: Array<{ x: number; w: number }> = [];
          let start = -1;
          for (let c = 0; c <= n; c++) {
            const dark = c < n && row[c];
            if (dark && start === -1) start = c;
            else if (!dark && start !== -1) {
              runs.push({ x: start, w: c - start });
              start = -1;
            }
          }
          if (runs.length === 0) return null;
          return (
            <View
              key={r}
              style={{
                position: "absolute",
                top: r * moduleSize,
                left: 0,
                height: moduleSize,
                width: totalPx,
              }}
            >
              {runs.map((run) => (
                <View
                  key={run.x}
                  style={{
                    position: "absolute",
                    left: run.x * moduleSize,
                    width: run.w * moduleSize,
                    height: moduleSize,
                    backgroundColor: "#111317",
                  }}
                />
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}
