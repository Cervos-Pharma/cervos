import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { type ComponentProps } from "react";
import type { ColorValue } from "react-native";

export interface PlatformIconProps {
  sf: SFSymbol;
  md: ComponentProps<typeof MaterialIcons>["name"];
  color: ColorValue;
  size?: number;
}

export function PlatformIcon({ sf, md, color, size = 20 }: PlatformIconProps) {
  if (process.env.EXPO_OS === "ios") {
    return (
      <SymbolView
        name={sf}
        tintColor={color}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
      />
    );
  }
  return <MaterialIcons name={md} size={size} color={color as string} />;
}
